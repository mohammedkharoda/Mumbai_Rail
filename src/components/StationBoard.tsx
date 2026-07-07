import { timeAgo } from "@/lib/format";
import { LINE_META, STATIONS_BY_ID } from "@/lib/stations";
import {
  REPORT_TYPES,
  REPORT_TYPE_META,
  SEVERITY_META,
  type LineFilter,
  type ReportsRollup,
  type StationSeverity,
  type TypeFilter,
} from "@/lib/types";

interface StationBoardProps {
  rollup: ReportsRollup | null;
  error: string | null;
  selectedStationId: string | null;
  onSelect: (stationId: string) => void;
  lineFilter: LineFilter;
  typeFilter: TypeFilter;
}

const MAX_ROWS = 12;

function countsSummary(severity: StationSeverity): string {
  return REPORT_TYPES.filter((t) => severity.counts[t] > 0)
    .map(
      (t) =>
        `${REPORT_TYPE_META[t].icon} ${severity.counts[t]} ${REPORT_TYPE_META[
          t
        ].label.toLowerCase()}`,
    )
    .join("  ·  ");
}

export default function StationBoard({
  rollup,
  error,
  selectedStationId,
  onSelect,
  lineFilter,
  typeFilter,
}: StationBoardProps) {
  const visible = (rollup?.stations ?? []).filter((severity) => {
    const station = STATIONS_BY_ID.get(severity.stationId);
    if (lineFilter !== "all" && station?.line !== lineFilter) return false;
    if (typeFilter !== "all" && severity.counts[typeFilter] === 0) return false;
    return true;
  });

  return (
    <section aria-label="Station board">
      <div className="flex items-baseline justify-between gap-2 px-1">
        <h2 className="text-base font-semibold">Affected stations</h2>
        <p className="text-xs text-ink-3">Crowdsourced · fades over 6h</p>
      </div>

      {error && (
        <p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-400">
          {error}. Retrying automatically.
        </p>
      )}

      {!error && !rollup && <p className="mt-2 text-sm text-ink-3">Loading reports…</p>}

      {rollup && rollup.stations.length === 0 && (
        <div className="mt-2 rounded-2xl border border-dashed border-hairline bg-surface p-6 text-center">
          <p aria-hidden className="text-2xl">
            🌤️
          </p>
          <p className="mt-2 text-sm font-medium">No active reports</p>
          <p className="mt-1 text-xs text-ink-3">
            Either the lines are running clean or nobody has reported yet — be the
            first.
          </p>
        </div>
      )}

      {rollup && rollup.stations.length > 0 && visible.length === 0 && (
        <p className="mt-2 rounded-2xl border border-dashed border-hairline bg-surface p-4 text-center text-sm text-ink-3">
          No stations match the current filters.
        </p>
      )}

      {visible.length > 0 && (
        <ul className="mt-2 space-y-2">
          {visible.slice(0, MAX_ROWS).map((severity) => {
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
                  className={`relative w-full overflow-hidden rounded-xl border bg-surface p-3 pl-4 text-left shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-safe:transition-colors ${
                    selected
                      ? "border-accent ring-1 ring-accent"
                      : "border-hairline hover:border-ink-3"
                  }`}
                >
                  {/* Severity accent bar — color is always paired with the chip label. */}
                  <span
                    aria-hidden
                    className="absolute inset-y-0 left-0 w-1"
                    style={{ backgroundColor: levelMeta.color }}
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">
                      {station?.name ?? severity.stationId}
                    </span>
                    {line && (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-ink-2">
                        <span
                          aria-hidden
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: line.cssVar }}
                        />
                        {line.label}
                      </span>
                    )}
                    <span
                      className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                      style={{ backgroundColor: levelMeta.color, color: levelMeta.fg }}
                    >
                      {levelMeta.label}
                    </span>
                    {severity.lastReportAt && (
                      <span className="ml-auto text-xs whitespace-nowrap text-ink-3">
                        {timeAgo(severity.lastReportAt)}
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 text-[13px] text-ink-2">
                    {countsSummary(severity)}
                  </p>
                  {latestNote && (
                    <p className="mt-1 text-[13px] text-ink-3 italic">
                      &ldquo;{latestNote}&rdquo;
                    </p>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {visible.length > MAX_ROWS && (
        <p className="mt-2 text-xs text-ink-3">
          …and {visible.length - MAX_ROWS} more affected station
          {visible.length - MAX_ROWS === 1 ? "" : "s"}.
        </p>
      )}
    </section>
  );
}
