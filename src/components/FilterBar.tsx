"use client";

import { LINE_META } from "@/lib/stations";
import {
  LINES,
  REPORT_TYPES,
  REPORT_TYPE_META,
  type LineFilter,
  type TypeFilter,
} from "@/lib/types";

interface FilterBarProps {
  lineFilter: LineFilter;
  typeFilter: TypeFilter;
  onLineChange: (line: LineFilter) => void;
  onTypeChange: (type: TypeFilter) => void;
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-2.5 py-1 text-xs font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-safe:transition-colors ${
        active
          ? "border-transparent bg-accent-solid text-white shadow-sm"
          : "border-hairline bg-surface text-ink-2 hover:border-ink-3"
      }`}
    >
      {children}
    </button>
  );
}

/** Line + issue-type filters, applied to both the map and the board. */
export default function FilterBar({
  lineFilter,
  typeFilter,
  onLineChange,
  onTypeChange,
}: FilterBarProps) {
  return (
    <section aria-label="Filters" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="w-10 shrink-0 text-xs font-medium text-ink-3">Line</span>
        <Pill active={lineFilter === "all"} onClick={() => onLineChange("all")}>
          All
        </Pill>
        {LINES.map((line) => (
          <Pill
            key={line}
            active={lineFilter === line}
            onClick={() => onLineChange(line)}
          >
            {LINE_META[line].label}
          </Pill>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="w-10 shrink-0 text-xs font-medium text-ink-3">Issue</span>
        <Pill active={typeFilter === "all"} onClick={() => onTypeChange("all")}>
          All
        </Pill>
        {REPORT_TYPES.map((type) => (
          <Pill
            key={type}
            active={typeFilter === type}
            onClick={() => onTypeChange(type)}
          >
            <span aria-hidden className="mr-1">
              {REPORT_TYPE_META[type].icon}
            </span>
            {REPORT_TYPE_META[type].label}
          </Pill>
        ))}
      </div>
    </section>
  );
}
