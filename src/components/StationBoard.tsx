import { LINE_META, STATIONS_BY_ID } from "@/lib/stations";
import {
  REPORT_TYPES,
  REPORT_TYPE_META,
  SEVERITY_META,
  type ReportsRollup,
  type StationSeverity,
} from "@/lib/types";

interface StationBoardProps {
  rollup: ReportsRollup | null;
  error: string | null;
  selectedStationId: string | null;
  onSelect: (stationId: string) => void;
}

const MAX_ROWS = 12;

function timeAgo(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m ago`;
}

function countsSummary(severity: StationSeverity): string {
  return REPORT_TYPES.filter((t) => severity.counts[t] > 0)
    .map((t) => `${severity.counts[t]}× ${REPORT_TYPE_META[t].label.toLowerCase()}`)
    .join(" · ");
}

export default function StationBoard({
  rollup,
  error,
  selectedStationId,
  onSelect,
}: StationBoardProps) {
  return (
    <section aria-label="Station board">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-semibold">Affected stations</h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Crowdsourced · fades over 6h
        </p>
      </div>

      {error && (
        <p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-400">
          {error}. Retrying automatically.
        </p>
      )}

      {!error && !rollup && (
        <p className="mt-2 text-sm text-zinc-500">Loading reports…</p>
      )}

      {rollup && rollup.stations.length === 0 && (
        <p className="mt-2 rounded-lg border border-dashed border-zinc-300 p-4 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          No active reports. Either the lines are running clean or nobody has
          reported yet — be the first.
        </p>
      )}

      {rollup && rollup.stations.length > 0 && (
        <ul className="mt-2 space-y-2">
          {rollup.stations.slice(0, MAX_ROWS).map((severity) => {
            const station = STATIONS_BY_ID.get(severity.stationId);
            const line = station ? LINE_META[station.line] : null;
            const levelMeta = SEVERITY_META[severity.level];
            const latestNote = severity.recent.find((r) => r.note)?.note;
            const selected = severity.stationId === selectedStationId;
            return (
              <li key={severity.stationId}>
                <button
                  type="button"
                  onClick={() => onSelect(severity.stationId)}
                  aria-pressed={selected}
                  className={`w-full rounded-lg border p-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
                    selected
                      ? "border-blue-600 dark:border-blue-500"
                      : "border-zinc-200 dark:border-zinc-800"
                  } bg-white hover:border-zinc-400 dark:bg-zinc-950 dark:hover:border-zinc-600`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">
                      {station?.name ?? severity.stationId}
                    </span>
                    {line && (
                      <span
                        className="rounded-full border px-2 py-0.5 text-xs font-medium"
                        style={{ borderColor: line.color, color: line.color }}
                      >
                        {line.label}
                      </span>
                    )}
                    <span
                      className="rounded-full px-2 py-0.5 text-xs font-medium text-white"
                      style={{ backgroundColor: levelMeta.color }}
                    >
                      {levelMeta.label}
                    </span>
                    {severity.lastReportAt && (
                      <span className="ml-auto text-xs text-zinc-500 dark:text-zinc-400">
                        {timeAgo(severity.lastReportAt)}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                    {countsSummary(severity)}
                  </p>
                  {latestNote && (
                    <p className="mt-1 text-sm text-zinc-500 italic dark:text-zinc-400">
                      &ldquo;{latestNote}&rdquo;
                    </p>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {rollup && rollup.stations.length > MAX_ROWS && (
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          …and {rollup.stations.length - MAX_ROWS} more affected station
          {rollup.stations.length - MAX_ROWS === 1 ? "" : "s"}.
        </p>
      )}
    </section>
  );
}
