import type { Line, Station } from "./types";

/**
 * Display metadata for the four suburban lines, roughly following the
 * conventional Mumbai rail-map palette (Western blue, Central red, Harbour
 * green, Trans-Harbour purple). Two steps per line: `color` for light
 * surfaces, `colorDark` for dark ones — Leaflet needs raw hex, so the map
 * picks by mode. CSS surfaces use `cssVar` (defined in globals.css) and swap
 * automatically. Both sets pass adjacent-pair CVD separation (ΔE ≥ 12) and
 * 3:1 contrast on their surface.
 */
export const LINE_META: Record<
  Line,
  { label: string; color: string; colorDark: string; cssVar: string }
> = {
  western: { label: "Western", color: "#2563eb", colorDark: "#3b82f6", cssVar: "var(--line-western)" },
  central: { label: "Central", color: "#dc2626", colorDark: "#ef4444", cssVar: "var(--line-central)" },
  harbour: { label: "Harbour", color: "#059669", colorDark: "#059669", cssVar: "var(--line-harbour)" },
  "trans-harbour": { label: "Trans-Harbour", color: "#7c3aed", colorDark: "#8b5cf6", cssVar: "var(--line-trans-harbour)" },
};

/**
 * Static v1 station list — a representative subset of each corridor, not every
 * halt. Coordinates are approximate (good enough for map display, not for
 * navigation). Junction stations (CSMT, Dadar, Kurla, Thane) get one entry per
 * line — commuters report against a specific line's platforms — with a tiny
 * coordinate offset so both markers stay clickable.
 */
export const STATIONS: Station[] = [
  // Western line (Churchgate → Virar)
  { id: "churchgate", name: "Churchgate", line: "western", lat: 18.9352, lng: 72.8273 },
  { id: "marine-lines", name: "Marine Lines", line: "western", lat: 18.9457, lng: 72.8236 },
  { id: "charni-road", name: "Charni Road", line: "western", lat: 18.9526, lng: 72.8193 },
  { id: "grant-road", name: "Grant Road", line: "western", lat: 18.9629, lng: 72.8155 },
  { id: "mumbai-central", name: "Mumbai Central", line: "western", lat: 18.9711, lng: 72.8193 },
  { id: "mahalaxmi", name: "Mahalaxmi", line: "western", lat: 18.9827, lng: 72.8232 },
  { id: "lower-parel", name: "Lower Parel", line: "western", lat: 18.9962, lng: 72.8302 },
  { id: "prabhadevi", name: "Prabhadevi", line: "western", lat: 19.0048, lng: 72.8353 },
  { id: "dadar-w", name: "Dadar (W)", line: "western", lat: 19.0212, lng: 72.8424 },
  { id: "mahim", name: "Mahim Jn", line: "western", lat: 19.0405, lng: 72.8406 },
  { id: "bandra", name: "Bandra", line: "western", lat: 19.0546, lng: 72.8407 },
  { id: "khar-road", name: "Khar Road", line: "western", lat: 19.07, lng: 72.8375 },
  { id: "santacruz", name: "Santacruz", line: "western", lat: 19.0815, lng: 72.8391 },
  { id: "vile-parle", name: "Vile Parle", line: "western", lat: 19.0995, lng: 72.8443 },
  { id: "andheri", name: "Andheri", line: "western", lat: 19.1187, lng: 72.8471 },
  { id: "jogeshwari", name: "Jogeshwari", line: "western", lat: 19.1345, lng: 72.848 },
  { id: "goregaon", name: "Goregaon", line: "western", lat: 19.1644, lng: 72.8493 },
  { id: "malad", name: "Malad", line: "western", lat: 19.1873, lng: 72.8484 },
  { id: "kandivali", name: "Kandivali", line: "western", lat: 19.2044, lng: 72.8511 },
  { id: "borivali", name: "Borivali", line: "western", lat: 19.2296, lng: 72.857 },
  { id: "dahisar", name: "Dahisar", line: "western", lat: 19.2495, lng: 72.8593 },
  { id: "mira-road", name: "Mira Road", line: "western", lat: 19.2813, lng: 72.8686 },
  { id: "bhayandar", name: "Bhayandar", line: "western", lat: 19.3016, lng: 72.8512 },
  { id: "vasai-road", name: "Vasai Road", line: "western", lat: 19.3826, lng: 72.8312 },
  { id: "nallasopara", name: "Nallasopara", line: "western", lat: 19.4176, lng: 72.819 },
  { id: "virar", name: "Virar", line: "western", lat: 19.455, lng: 72.8114 },

  // Central line (CSMT → Kalyan / Badlapur)
  { id: "csmt-c", name: "CSMT (Central)", line: "central", lat: 18.9402, lng: 72.8356 },
  { id: "byculla", name: "Byculla", line: "central", lat: 18.9757, lng: 72.8332 },
  { id: "parel", name: "Parel", line: "central", lat: 19.0089, lng: 72.8378 },
  { id: "dadar-c", name: "Dadar (C)", line: "central", lat: 19.0186, lng: 72.8446 },
  { id: "matunga", name: "Matunga", line: "central", lat: 19.0273, lng: 72.85 },
  { id: "sion", name: "Sion", line: "central", lat: 19.0466, lng: 72.8637 },
  { id: "kurla-c", name: "Kurla (Central)", line: "central", lat: 19.0655, lng: 72.879 },
  { id: "ghatkopar", name: "Ghatkopar", line: "central", lat: 19.0858, lng: 72.908 },
  { id: "vikhroli", name: "Vikhroli", line: "central", lat: 19.1109, lng: 72.9278 },
  { id: "bhandup", name: "Bhandup", line: "central", lat: 19.1441, lng: 72.9377 },
  { id: "mulund", name: "Mulund", line: "central", lat: 19.1718, lng: 72.9563 },
  { id: "thane-c", name: "Thane (Central)", line: "central", lat: 19.1866, lng: 72.9754 },
  { id: "dombivli", name: "Dombivli", line: "central", lat: 19.2183, lng: 73.0868 },
  { id: "kalyan", name: "Kalyan Jn", line: "central", lat: 19.2437, lng: 73.1355 },
  { id: "ambernath", name: "Ambernath", line: "central", lat: 19.2093, lng: 73.186 },
  { id: "badlapur", name: "Badlapur", line: "central", lat: 19.1668, lng: 73.2367 },

  // Harbour line (CSMT → Panvel)
  { id: "csmt-h", name: "CSMT (Harbour)", line: "harbour", lat: 18.9394, lng: 72.8364 },
  { id: "wadala-road", name: "Wadala Road", line: "harbour", lat: 19.0166, lng: 72.859 },
  { id: "kurla-h", name: "Kurla (Harbour)", line: "harbour", lat: 19.0662, lng: 72.8798 },
  { id: "chembur", name: "Chembur", line: "harbour", lat: 19.0622, lng: 72.8972 },
  { id: "govandi", name: "Govandi", line: "harbour", lat: 19.0546, lng: 72.912 },
  { id: "mankhurd", name: "Mankhurd", line: "harbour", lat: 19.048, lng: 72.931 },
  { id: "vashi", name: "Vashi", line: "harbour", lat: 19.0654, lng: 72.999 },
  { id: "nerul", name: "Nerul", line: "harbour", lat: 19.0333, lng: 73.0186 },
  { id: "belapur", name: "Belapur CBD", line: "harbour", lat: 19.0189, lng: 73.0397 },
  { id: "kharghar", name: "Kharghar", line: "harbour", lat: 19.035, lng: 73.062 },
  { id: "panvel", name: "Panvel", line: "harbour", lat: 18.9902, lng: 73.1204 },

  // Trans-Harbour line (Thane → Vashi / Nerul; services continue onto the
  // Harbour-line stations listed above)
  { id: "thane-th", name: "Thane (Trans-Harbour)", line: "trans-harbour", lat: 19.1874, lng: 72.9762 },
  { id: "airoli", name: "Airoli", line: "trans-harbour", lat: 19.156, lng: 72.9985 },
  { id: "rabale", name: "Rabale", line: "trans-harbour", lat: 19.135, lng: 73.005 },
  { id: "ghansoli", name: "Ghansoli", line: "trans-harbour", lat: 19.116, lng: 73.0086 },
  { id: "kopar-khairane", name: "Kopar Khairane", line: "trans-harbour", lat: 19.1032, lng: 73.0095 },
  { id: "turbhe", name: "Turbhe", line: "trans-harbour", lat: 19.07, lng: 73.016 },
];

export const STATIONS_BY_ID: ReadonlyMap<string, Station> = new Map(
  STATIONS.map((s) => [s.id, s]),
);

export const STATION_IDS: ReadonlySet<string> = new Set(STATIONS.map((s) => s.id));
