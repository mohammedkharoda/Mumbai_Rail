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
 * banner) uses the same labels and colors. Hex values rather than Tailwind
 * classes because Leaflet path options need raw colors.
 */

export const REPORT_TYPE_META: Record<ReportType, { label: string }> = {
  waterlogging: { label: "Waterlogging" },
  cancelled: { label: "Cancelled" },
  delay: { label: "Delay" },
  crowding: { label: "Heavy crowding" },
  "all-clear": { label: "All clear" },
};

export const SEVERITY_META: Record<SeverityLevel, { label: string; color: string }> = {
  clear: { label: "Clear", color: "#64748b" },
  minor: { label: "Minor", color: "#ca8a04" },
  moderate: { label: "Moderate", color: "#ea580c" },
  severe: { label: "Severe", color: "#dc2626" },
};

export const ALERT_META: Record<AlertLevel, { label: string; color: string }> = {
  green: { label: "Green — no significant weather", color: "#16a34a" },
  yellow: { label: "Yellow — rain around, stay updated", color: "#ca8a04" },
  orange: { label: "Orange — heavy rain, be prepared", color: "#ea580c" },
  red: { label: "Red — severe conditions, avoid travel", color: "#dc2626" },
};
