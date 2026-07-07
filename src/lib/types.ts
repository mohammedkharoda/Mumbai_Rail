/** Shared domain types for Mumbai Rail Pulse. All cross-module types live here. */

export const LINES = ["western", "central", "harbour", "trans-harbour"] as const;
export type Line = (typeof LINES)[number];

export const REPORT_TYPES = [
  "waterlogging",
  "cancelled",
  "delay",
  "crowding",
  "all-clear",
] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

export const SEVERITY_LEVELS = ["clear", "minor", "moderate", "severe"] as const;
export type SeverityLevel = (typeof SEVERITY_LEVELS)[number];

export const ALERT_LEVELS = ["green", "yellow", "orange", "red"] as const;
export type AlertLevel = (typeof ALERT_LEVELS)[number];

export interface Station {
  id: string;
  name: string;
  line: Line;
  lat: number;
  lng: number;
}

export interface Report {
  id: string;
  stationId: string;
  type: ReportType;
  note?: string;
  /** ISO 8601 */
  createdAt: string;
}

/** Rolled-up, decay-weighted view of one station's active reports. */
export interface StationSeverity {
  stationId: string;
  /** Decay-weighted sum of report weights; 0 means no active signal. */
  score: number;
  level: SeverityLevel;
  /** Reports still inside the 6-hour decay window. */
  reportCount: number;
  counts: Record<ReportType, number>;
  lastReportAt: string | null;
  /** Newest first, capped — enough for a board preview. */
  recent: Report[];
}

/** Shape of GET /api/reports. */
export interface ReportsRollup {
  generatedAt: string;
  stations: StationSeverity[];
}

/** App feedback (about the product itself, not a disruption report). */
export interface Feedback {
  id: string;
  message: string;
  email?: string;
  /** ISO 8601 */
  createdAt: string;
}

export interface NewsItem {
  title: string;
  link: string;
  source: string;
  publishedAt: string | null;
}

/** Shape of GET /api/news. */
export interface NewsFeed {
  fetchedAt: string;
  items: NewsItem[];
}

/** UI filters shared by the map and the station board. */
export type TypeFilter = ReportType | "all";
export type LineFilter = Line | "all";

/** Shape of GET /api/weather. */
export interface WeatherSnapshot {
  fetchedAt: string;
  /** Rain over roughly the last hour, in mm (heuristic — see api/weather). */
  precipitationMm: number;
  windKph: number;
  windGustKph: number | null;
  temperatureC: number | null;
  /** Derived from precipitation + wind thresholds — NOT an official IMD alert. */
  alertLevel: AlertLevel;
  source: "open-meteo";
}

/*
 * Display metadata kept beside the unions so every surface (map, board,
 * banner) uses the same labels, icons and colors. Hex values rather than
 * Tailwind classes because Leaflet path options need raw colors.
 *
 * Severity/alert hexes are status colors from a CVD-validated set (adjacent
 * ΔE ≥ 12). Yellow/orange sit below 3:1 on light surfaces by design — the
 * mitigation is that a status color is never shown without its text label,
 * and chips pair each background with the `fg` ink that passes contrast.
 */

export const REPORT_TYPE_META: Record<ReportType, { label: string; icon: string }> = {
  waterlogging: { label: "Waterlogging", icon: "🌊" },
  cancelled: { label: "Cancelled", icon: "🚫" },
  delay: { label: "Delay", icon: "⏳" },
  crowding: { label: "Heavy crowding", icon: "👥" },
  "all-clear": { label: "All clear", icon: "✅" },
};

export const SEVERITY_META: Record<
  SeverityLevel,
  { label: string; color: string; fg: string }
> = {
  clear: { label: "Clear", color: "#64748b", fg: "#ffffff" },
  minor: { label: "Minor", color: "#fab219", fg: "#1a1a19" },
  moderate: { label: "Moderate", color: "#ec835a", fg: "#1a1a19" },
  severe: { label: "Severe", color: "#d03b3b", fg: "#ffffff" },
};

export const ALERT_META: Record<
  AlertLevel,
  { label: string; headline: string; color: string; fg: string }
> = {
  green: {
    label: "Green",
    headline: "No significant weather — lines should run normally",
    color: "#0ca30c",
    fg: "#ffffff",
  },
  yellow: {
    label: "Yellow",
    headline: "Rain around — stay updated, minor delays possible",
    color: "#fab219",
    fg: "#1a1a19",
  },
  orange: {
    label: "Orange",
    headline: "Heavy rain — be prepared for delays and waterlogging",
    color: "#ec835a",
    fg: "#1a1a19",
  },
  red: {
    label: "Red",
    headline: "Severe conditions — avoid non-essential travel",
    color: "#d03b3b",
    fg: "#ffffff",
  },
};
