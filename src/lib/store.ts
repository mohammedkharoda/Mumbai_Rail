import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

import { neon } from "@neondatabase/serverless";

import type {
  Feedback,
  Report,
  ReportType,
  SeverityLevel,
  StationSeverity,
} from "./types";
import { REPORT_TYPES } from "./types";

/*
 * All persistence lives in this module behind two async functions:
 * addReport() and getRollup(). Two interchangeable backends:
 *
 *  - Neon Postgres, used when DATABASE_URL is set. Required in production:
 *    serverless filesystems (Vercel) are read-only and instances don't share
 *    memory, so both reports and the rate limiter must live in the database.
 *  - JSON file + in-memory, used when DATABASE_URL is absent — zero-config
 *    local development. Single-instance only.
 */

/** A report's influence fades linearly to zero over this window. */
const DECAY_WINDOW_MS = 6 * 60 * 60 * 1000;

/** One report per IP per station within this window. */
const RATE_LIMIT_WINDOW_MS = 2 * 60 * 1000;

const RECENT_REPORTS_CAP = 3;

/** Sentinel "station" for feedback rate-limit rows — real station ids are
 *  kebab-case names, so this can never collide. */
const FEEDBACK_RATE_KEY = "__feedback__";

/** How strongly each report type pushes a station's severity score. */
const TYPE_WEIGHTS: Record<ReportType, number> = {
  waterlogging: 5,
  cancelled: 4,
  delay: 2,
  crowding: 1.5,
  "all-clear": -3, // pulls the score back down as conditions recover
};

export interface NewReportInput {
  stationId: string;
  type: ReportType;
  note?: string;
}

export type AddReportResult =
  | { ok: true; report: Report }
  | { ok: false; reason: "rate-limited"; retryAfterSec: number };

/**
 * Add a report, enforcing the per-IP-per-station rate limit. The IP is a
 * spam deterrent, not a security boundary — x-forwarded-for is spoofable
 * outside a trusted proxy.
 */
export async function addReport(input: NewReportInput, ip: string): Promise<AddReportResult> {
  const url = process.env.DATABASE_URL;
  return url ? neonAddReport(url, input, ip) : fileAddReport(input, ip);
}

/**
 * Severity rollup for every station with at least one report inside the decay
 * window, sorted worst-first. Stations absent from the result are clear.
 */
export async function getRollup(): Promise<StationSeverity[]> {
  const url = process.env.DATABASE_URL;
  return url ? neonGetRollup(url) : fileGetRollup();
}

export interface NewFeedbackInput {
  message: string;
  email?: string;
}

export type AddFeedbackResult =
  | { ok: true }
  | { ok: false; reason: "rate-limited"; retryAfterSec: number };

/**
 * Store app feedback (same per-IP rate window as reports). There is no read
 * API for feedback in v1 — the owner reads it straight from the `feedback`
 * table (or data/feedback.json locally).
 */
export async function addFeedback(
  input: NewFeedbackInput,
  ip: string,
): Promise<AddFeedbackResult> {
  const url = process.env.DATABASE_URL;
  return url ? neonAddFeedback(url, input, ip) : fileAddFeedback(input, ip);
}

/* ------------------------------------------------------------------ */
/* Severity scoring (shared by both backends)                          */
/* ------------------------------------------------------------------ */

function levelForScore(score: number): SeverityLevel {
  if (score < 0.5) return "clear";
  if (score < 3) return "minor";
  if (score < 7) return "moderate";
  return "severe";
}

function severityFor(stationId: string, reports: Report[], now: number): StationSeverity {
  const counts = Object.fromEntries(REPORT_TYPES.map((t) => [t, 0])) as Record<
    ReportType,
    number
  >;
  let score = 0;
  let lastReportMs = 0;

  for (const r of reports) {
    const ageMs = now - Date.parse(r.createdAt);
    // Linear decay: full weight when fresh, zero at DECAY_WINDOW_MS.
    const freshness = Math.max(0, 1 - ageMs / DECAY_WINDOW_MS);
    score += TYPE_WEIGHTS[r.type] * freshness;
    counts[r.type] += 1;
    lastReportMs = Math.max(lastReportMs, Date.parse(r.createdAt));
  }

  score = Math.max(0, Math.round(score * 10) / 10);
  const recent = [...reports]
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, RECENT_REPORTS_CAP);

  return {
    stationId,
    score,
    level: levelForScore(score),
    reportCount: reports.length,
    counts,
    lastReportAt: lastReportMs ? new Date(lastReportMs).toISOString() : null,
    recent,
  };
}

function rollupFromReports(reports: Report[], now: number): StationSeverity[] {
  const byStation = new Map<string, Report[]>();
  for (const r of reports) {
    const list = byStation.get(r.stationId);
    if (list) list.push(r);
    else byStation.set(r.stationId, [r]);
  }

  const rollup = [...byStation.entries()].map(([stationId, stationReports]) =>
    severityFor(stationId, stationReports, now),
  );
  rollup.sort(
    (a, b) =>
      b.score - a.score ||
      Date.parse(b.lastReportAt ?? "0") - Date.parse(a.lastReportAt ?? "0"),
  );
  return rollup;
}

/* ------------------------------------------------------------------ */
/* Backend 1: Neon Postgres (DATABASE_URL set)                         */
/* ------------------------------------------------------------------ */

type NeonSql = ReturnType<typeof neon>;

interface ReportRow {
  id: string;
  station_id: string;
  type: string;
  note: string | null;
  /** extract(epoch from …) * 1000 — numeric arrives as a string. */
  created_at_ms: string | number;
}

let neonClient: NeonSql | null = null;
let schemaReady: Promise<void> | null = null;

function db(url: string): NeonSql {
  neonClient ??= neon(url);
  return neonClient;
}

/** Create tables on first use so there is no separate migration step. Runs
 *  once per server instance (one extra round trip after each cold start). */
function ensureSchema(sql: NeonSql): Promise<void> {
  schemaReady ??= (async () => {
    await sql`CREATE TABLE IF NOT EXISTS reports (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      station_id text NOT NULL,
      type text NOT NULL,
      note text,
      created_at timestamptz NOT NULL DEFAULT now()
    )`;
    await sql`CREATE INDEX IF NOT EXISTS reports_created_at_idx ON reports (created_at)`;
    await sql`CREATE TABLE IF NOT EXISTS report_rate_limits (
      ip text NOT NULL,
      station_id text NOT NULL,
      last_accepted_at timestamptz NOT NULL,
      PRIMARY KEY (ip, station_id)
    )`;
    await sql`CREATE TABLE IF NOT EXISTS feedback (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      message text NOT NULL,
      email text,
      created_at timestamptz NOT NULL DEFAULT now()
    )`;
  })().catch((err: unknown) => {
    schemaReady = null; // let the next request retry
    throw err;
  });
  return schemaReady;
}

function rowToReport(row: ReportRow): Report {
  return {
    id: row.id,
    stationId: row.station_id,
    // Rows are only written through the zod-validated API, so the cast is
    // safe; getRollup additionally filters unknown types defensively.
    type: row.type as ReportType,
    ...(row.note ? { note: row.note } : {}),
    createdAt: new Date(Number(row.created_at_ms)).toISOString(),
  };
}

async function neonAddReport(
  url: string,
  input: NewReportInput,
  ip: string,
): Promise<AddReportResult> {
  const sql = db(url);
  await ensureSchema(sql);
  const windowSec = RATE_LIMIT_WINDOW_MS / 1000;

  // One atomic statement: the rate-limit upsert acts as a gate — the report
  // row is only inserted when the gate accepts (no prior report from this IP
  // for this station inside the window). Atomicity means concurrent requests
  // can't slip past the limiter.
  const inserted = (await sql`
    WITH gate AS (
      INSERT INTO report_rate_limits (ip, station_id, last_accepted_at)
      VALUES (${ip}, ${input.stationId}, now())
      ON CONFLICT (ip, station_id) DO UPDATE SET last_accepted_at = now()
      WHERE report_rate_limits.last_accepted_at <= now() - make_interval(secs => ${windowSec})
      RETURNING 1
    )
    INSERT INTO reports (station_id, type, note)
    SELECT ${input.stationId}, ${input.type}, ${input.note ?? null}
    FROM gate
    RETURNING id, station_id, type, note,
      extract(epoch from created_at) * 1000 AS created_at_ms
  `) as ReportRow[];

  if (inserted.length === 0) {
    const retryAfterSec = await rateLimitRetryAfter(sql, ip, input.stationId, windowSec);
    return { ok: false, reason: "rate-limited", retryAfterSec };
  }

  // Opportunistic cleanup instead of a scheduled job. Only runs on accepted
  // writes, which the limiter already keeps infrequent.
  await Promise.all([
    sql`DELETE FROM reports
        WHERE created_at < now() - make_interval(secs => ${DECAY_WINDOW_MS / 1000})`,
    sql`DELETE FROM report_rate_limits
        WHERE last_accepted_at < now() - make_interval(secs => ${RATE_LIMIT_WINDOW_MS / 1000})`,
  ]);

  return { ok: true, report: rowToReport(inserted[0]) };
}

/** Seconds until the (ip, key) rate-limit row expires. */
async function rateLimitRetryAfter(
  sql: NeonSql,
  ip: string,
  key: string,
  windowSec: number,
): Promise<number> {
  const rows = (await sql`
    SELECT ceil(extract(epoch from
      last_accepted_at + make_interval(secs => ${windowSec}) - now()
    )) AS retry_sec
    FROM report_rate_limits
    WHERE ip = ${ip} AND station_id = ${key}
  `) as { retry_sec: string | number }[];
  return Math.max(1, Number(rows[0]?.retry_sec ?? windowSec));
}

async function neonAddFeedback(
  url: string,
  input: NewFeedbackInput,
  ip: string,
): Promise<AddFeedbackResult> {
  const sql = db(url);
  await ensureSchema(sql);
  const windowSec = RATE_LIMIT_WINDOW_MS / 1000;

  // Same atomic gate pattern as reports, keyed on the feedback sentinel.
  const inserted = (await sql`
    WITH gate AS (
      INSERT INTO report_rate_limits (ip, station_id, last_accepted_at)
      VALUES (${ip}, ${FEEDBACK_RATE_KEY}, now())
      ON CONFLICT (ip, station_id) DO UPDATE SET last_accepted_at = now()
      WHERE report_rate_limits.last_accepted_at <= now() - make_interval(secs => ${windowSec})
      RETURNING 1
    )
    INSERT INTO feedback (message, email)
    SELECT ${input.message}, ${input.email ?? null}
    FROM gate
    RETURNING id
  `) as { id: string }[];

  if (inserted.length === 0) {
    const retryAfterSec = await rateLimitRetryAfter(sql, ip, FEEDBACK_RATE_KEY, windowSec);
    return { ok: false, reason: "rate-limited", retryAfterSec };
  }
  return { ok: true };
}

async function neonGetRollup(url: string): Promise<StationSeverity[]> {
  const sql = db(url);
  await ensureSchema(sql);

  const rows = (await sql`
    SELECT id, station_id, type, note,
      extract(epoch from created_at) * 1000 AS created_at_ms
    FROM reports
    WHERE created_at > now() - make_interval(secs => ${DECAY_WINDOW_MS / 1000})
  `) as ReportRow[];

  const reports = rows
    .filter((r) => (REPORT_TYPES as readonly string[]).includes(r.type))
    .map(rowToReport);
  return rollupFromReports(reports, Date.now());
}

/* ------------------------------------------------------------------ */
/* Backend 2: JSON file + in-memory (local dev fallback)               */
/* ------------------------------------------------------------------ */

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "reports.json");

interface FileStoreState {
  reports: Report[];
  /** `${ip}|${stationId}` → epoch ms of the last accepted report. */
  lastAcceptedAt: Map<string, number>;
  loaded: boolean;
}

// Stashed on globalThis so the store survives Next.js dev-server HMR, which
// re-evaluates this module but keeps the process (and globalThis) alive.
const g = globalThis as typeof globalThis & { __railPulseStore?: FileStoreState };

function fileState(): FileStoreState {
  g.__railPulseStore ??= { reports: [], lastAcceptedAt: new Map(), loaded: false };
  return g.__railPulseStore;
}

function isReport(value: unknown): value is Report {
  if (typeof value !== "object" || value === null) return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r.id === "string" &&
    typeof r.stationId === "string" &&
    typeof r.type === "string" &&
    (REPORT_TYPES as readonly string[]).includes(r.type) &&
    (r.note === undefined || typeof r.note === "string") &&
    typeof r.createdAt === "string" &&
    !Number.isNaN(Date.parse(r.createdAt))
  );
}

async function ensureLoaded(): Promise<FileStoreState> {
  const s = fileState();
  if (s.loaded) return s;
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      s.reports = parsed.filter(isReport);
    }
  } catch {
    // Missing or corrupt file → start empty. Acceptable for local dev.
  }
  s.loaded = true;
  return s;
}

/** Drop fully-decayed reports and expired rate-limit entries on every
 *  read/write — this is what lets the fallback skip a cleanup job. */
function prune(s: FileStoreState, now: number): void {
  s.reports = s.reports.filter((r) => now - Date.parse(r.createdAt) < DECAY_WINDOW_MS);
  for (const [key, ts] of s.lastAcceptedAt) {
    if (now - ts >= RATE_LIMIT_WINDOW_MS) s.lastAcceptedAt.delete(key);
  }
}

async function persist(s: FileStoreState): Promise<void> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(DATA_FILE, JSON.stringify(s.reports, null, 2), "utf8");
  } catch (err) {
    // Read-only filesystem → memory-only. Set DATABASE_URL in production.
    console.warn("store: could not persist reports to disk", err);
  }
}

async function fileAddReport(input: NewReportInput, ip: string): Promise<AddReportResult> {
  const s = await ensureLoaded();
  const now = Date.now();
  prune(s, now);

  const key = `${ip}|${input.stationId}`;
  const last = s.lastAcceptedAt.get(key);
  if (last !== undefined && now - last < RATE_LIMIT_WINDOW_MS) {
    const retryAfterSec = Math.ceil((RATE_LIMIT_WINDOW_MS - (now - last)) / 1000);
    return { ok: false, reason: "rate-limited", retryAfterSec };
  }

  const report: Report = {
    id: randomUUID(),
    stationId: input.stationId,
    type: input.type,
    ...(input.note ? { note: input.note } : {}),
    createdAt: new Date(now).toISOString(),
  };
  s.reports.push(report);
  s.lastAcceptedAt.set(key, now);
  await persist(s);
  return { ok: true, report };
}

async function fileGetRollup(): Promise<StationSeverity[]> {
  const s = await ensureLoaded();
  const now = Date.now();
  prune(s, now);
  return rollupFromReports(s.reports, now);
}

const FEEDBACK_FILE = path.join(DATA_DIR, "feedback.json");

async function fileAddFeedback(
  input: NewFeedbackInput,
  ip: string,
): Promise<AddFeedbackResult> {
  const s = await ensureLoaded();
  const now = Date.now();
  prune(s, now);

  const key = `${ip}|${FEEDBACK_RATE_KEY}`;
  const last = s.lastAcceptedAt.get(key);
  if (last !== undefined && now - last < RATE_LIMIT_WINDOW_MS) {
    const retryAfterSec = Math.ceil((RATE_LIMIT_WINDOW_MS - (now - last)) / 1000);
    return { ok: false, reason: "rate-limited", retryAfterSec };
  }

  const entry: Feedback = {
    id: randomUUID(),
    message: input.message,
    ...(input.email ? { email: input.email } : {}),
    createdAt: new Date(now).toISOString(),
  };
  s.lastAcceptedAt.set(key, now);
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    let existing: unknown = [];
    try {
      existing = JSON.parse(await fs.readFile(FEEDBACK_FILE, "utf8"));
    } catch {
      // Missing or corrupt file → start a fresh list.
    }
    const list = Array.isArray(existing) ? existing : [];
    list.push(entry);
    await fs.writeFile(FEEDBACK_FILE, JSON.stringify(list, null, 2), "utf8");
  } catch (err) {
    // Read-only filesystem → feedback is lost. Set DATABASE_URL in production.
    console.warn("store: could not persist feedback to disk", err);
  }
  return { ok: true };
}
