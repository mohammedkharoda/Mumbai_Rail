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
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 " +
  "dark:border-zinc-700 dark:bg-zinc-900";

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
        setStatus({ kind: "success", message: "Report submitted — thanks for helping fellow commuters." });
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
      setStatus({ kind: "error", message: body.error ?? `Something went wrong (HTTP ${res.status}).` });
    } catch {
      setStatus({ kind: "error", message: "Network error — are you offline?" });
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="h-fit rounded-xl border border-zinc-200 bg-white p-4 lg:sticky lg:top-4 dark:border-zinc-800 dark:bg-zinc-950"
    >
      <h2 className="font-semibold">Report a disruption</h2>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
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
        className={`mt-1 ${inputClasses}`}
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
              className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm select-none has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-blue-600 ${
                type === t
                  ? "border-transparent bg-zinc-900 font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "border-zinc-300 text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
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
              {REPORT_TYPE_META[t].label}
            </label>
          ))}
        </div>
      </fieldset>

      <label htmlFor="note" className="mt-4 block text-sm font-medium">
        Note <span className="font-normal text-zinc-500">(optional)</span>
      </label>
      <textarea
        id="note"
        rows={2}
        maxLength={280}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="e.g. Tracks flooded near platform 2, trains held"
        className={`mt-1 resize-y ${inputClasses}`}
      />

      <button
        type="submit"
        disabled={!stationId || status.kind === "sending"}
        className="mt-4 w-full rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {status.kind === "sending" ? "Submitting…" : "Submit report"}
      </button>

      {status.kind === "success" && (
        <p role="status" className="mt-3 text-sm text-green-700 dark:text-green-400">
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
