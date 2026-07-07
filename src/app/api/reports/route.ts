import { NextResponse } from "next/server";
import { z } from "zod";

import { STATION_IDS } from "@/lib/stations";
import { addReport, getRollup } from "@/lib/store";
import { REPORT_TYPES, type ReportsRollup } from "@/lib/types";

// The rollup must always reflect the latest reports — never cache this route.
export const dynamic = "force-dynamic";

const reportInputSchema = z.object({
  stationId: z.string().refine((id) => STATION_IDS.has(id), "Unknown station id"),
  type: z.enum(REPORT_TYPES),
  note: z
    .string()
    .trim()
    .max(280, "Note must be 280 characters or fewer")
    .optional(),
});

export async function GET(): Promise<NextResponse<ReportsRollup>> {
  const stations = await getRollup();
  return NextResponse.json({ generatedAt: new Date().toISOString(), stations });
}

// A report is a few hundred bytes; reject anything absurdly large before
// parsing it into memory. Best-effort (chunked requests have no length).
const MAX_BODY_BYTES = 10_000;

export async function POST(request: Request): Promise<NextResponse> {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Request body too large" }, { status: 413 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be valid JSON" }, { status: 400 });
  }

  const parsed = reportInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid report",
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.map(String).join("."),
          message: issue.message,
        })),
      },
      { status: 400 },
    );
  }

  const result = await addReport(parsed.data, clientIp(request));
  if (!result.ok) {
    return NextResponse.json(
      {
        error: "You already reported this station recently — try again shortly.",
        retryAfterSec: result.retryAfterSec,
      },
      { status: 429, headers: { "Retry-After": String(result.retryAfterSec) } },
    );
  }

  return NextResponse.json({ report: result.report }, { status: 201 });
}

/**
 * Best-effort client IP for rate limiting. Behind a proxy/CDN it arrives in
 * x-forwarded-for; in local dev there is no header, so everyone shares one
 * bucket. Trusting this header is spoofable — acceptable as a v1 spam
 * deterrent, not a security boundary.
 */
function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0].trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip") ?? "local";
}
