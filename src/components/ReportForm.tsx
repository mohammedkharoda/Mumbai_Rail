"use client";

import { useState, type FormEvent } from "react";

import { LINE_META, STATIONS } from "@/lib/stations";
import {
  LINES,
  REPORT_TYPES,
  REPORT_TYPE_META,
  type ReportType,
} from "@/lib/types";

interface ReportFormProps {
  stationId: string | null;
  onStationChange: (stationId: string | null) => void;
  /** Called after a report is accepted so the parent can refresh the rollup. */
  onReported: () => void;
}

type Status =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

const inputClasses =
  "w-full rounded-xl border border-hairline bg-surface-2 px-3 py-2.5 text-sm " +
  "text-foreground placeholder:text-ink-3 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export default function ReportForm({
  stationId,
  onStationChange,
  onReported,
}: ReportFormProps) {
  const [type, setType] = useState<ReportType>("delay");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!stationId || status.kind === "sending") return;
    setStatus({ kind: "sending" });
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stationId,
          type,
          ...(note.trim() ? { note: note.trim() } : {}),
        }),
      });
      if (res.status === 201) {
        setNote("");
        setStatus({
          kind: "success",
          message: "Report submitted — thanks for helping fellow commuters.",
        });
        onReported();
        return;
      }
      const body = (await res.json()) as { error?: string; retryAfterSec?: number };
      if (res.status === 429) {
        setStatus({
          kind: "error",
          message: `You already reported this station. Try again in ${body.retryAfterSec ?? 120}s.`,
        });
        return;
      }
      setStatus({
        kind: "error",
        message: body.error ?? `Something went wrong (HTTP ${res.status}).`,
      });
    } catch {
      setStatus({ kind: "error", message: "Network error — are you offline?" });
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="h-fit rounded-2xl border border-hairline bg-surface p-4 shadow-sm sm:p-5 lg:sticky lg:top-4"
    >
      <h2 className="text-base font-semibold">Report a disruption</h2>
      <p className="mt-1 text-xs text-ink-3">
        One report per station every 2 minutes. Reports fade out after ~6 hours.
      </p>

      <label htmlFor="station" className="mt-4 block text-sm font-medium">
        Station
      </label>
      <select
        id="station"
        required
        value={stationId ?? ""}
        onChange={(e) => onStationChange(e.target.value || null)}
        className={`mt-1.5 ${inputClasses}`}
      >
        <option value="" disabled>
          Select a station…
        </option>
        {LINES.map((line) => (
          <optgroup key={line} label={`${LINE_META[line].label} line`}>
            {STATIONS.filter((s) => s.line === line).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>

      <fieldset className="mt-4">
        <legend className="text-sm font-medium">What&apos;s happening?</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {REPORT_TYPES.map((t) => (
            <label
              key={t}
              className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm select-none motion-safe:transition-colors has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent ${
                type === t
                  ? "border-transparent bg-accent-solid font-medium text-white shadow-sm"
                  : "border-hairline bg-surface-2 text-ink-2 hover:border-ink-3"
              }`}
            >
              <input
                type="radio"
                name="report-type"
                value={t}
                checked={type === t}
                onChange={() => setType(t)}
                className="sr-only"
              />
              <span aria-hidden className="mr-1">
                {REPORT_TYPE_META[t].icon}
              </span>
              {REPORT_TYPE_META[t].label}
            </label>
          ))}
        </div>
      </fieldset>

      <label htmlFor="note" className="mt-4 block text-sm font-medium">
        Note <span className="font-normal text-ink-3">(optional)</span>
      </label>
      <textarea
        id="note"
        rows={2}
        maxLength={280}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="e.g. Tracks flooded near platform 2, trains held"
        className={`mt-1.5 resize-y ${inputClasses}`}
      />

      <button
        type="submit"
        disabled={!stationId || status.kind === "sending"}
        className="mt-5 w-full rounded-xl bg-accent-solid px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-accent-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50 motion-safe:transition-colors"
      >
        {status.kind === "sending" ? "Submitting…" : "Submit report"}
      </button>

      {status.kind === "success" && (
        <p role="status" className="mt-3 text-sm text-emerald-700 dark:text-emerald-400">
          {status.message}
        </p>
      )}
      {status.kind === "error" && (
        <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-400">
          {status.message}
        </p>
      )}
    </form>
  );
}
