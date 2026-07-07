"use client";

import { divIcon, latLngBounds, type DivIcon } from "leaflet";
import { useEffect, useState } from "react";
import { CircleMarker, MapContainer, Marker, TileLayer, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";

import { timeAgo } from "@/lib/format";
import { LINE_META, STATIONS } from "@/lib/stations";
import {
  LINES,
  REPORT_TYPES,
  REPORT_TYPE_META,
  SEVERITY_LEVELS,
  SEVERITY_META,
  type LineFilter,
  type ReportType,
  type StationSeverity,
  type TypeFilter,
} from "@/lib/types";

interface StationMapProps {
  severities: ReadonlyMap<string, StationSeverity>;
  selectedStationId: string | null;
  onSelect: (stationId: string) => void;
  lineFilter: LineFilter;
  typeFilter: TypeFilter;
}

const NETWORK_BOUNDS = latLngBounds(
  STATIONS.map((s) => [s.lat, s.lng] as [number, number]),
);

// CARTO's free OSM basemaps: muted ground in both modes so the severity
// colors carry the signal. {r} serves retina tiles automatically.
const TILE_URL_LIGHT = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
const TILE_URL_DARK = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

/** A report younger than this gets the highlighted "fresh" pin ring. */
const FRESH_REPORT_MS = 15 * 60_000;

// Pin icons per report type (html is our emoji only — no user content).
// Styled via .report-pin in globals.css since divIcon HTML lives outside React.
function buildPins(fresh: boolean): Record<ReportType, DivIcon> {
  return Object.fromEntries(
    REPORT_TYPES.map((t) => [
      t,
      divIcon({
        className: "report-pin-anchor",
        html: `<div class="report-pin${fresh ? " report-pin--fresh" : ""}">${REPORT_TYPE_META[t].icon}</div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 30],
      }),
    ]),
  ) as Record<ReportType, DivIcon>;
}
const PIN_ICONS = buildPins(false);
const PIN_ICONS_FRESH = buildPins(true);

/** Tracks prefers-color-scheme so tiles and marker hexes follow the theme. */
function usePrefersDark(): boolean {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setDark(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setDark(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return dark;
}

function matchesFilters(
  stationLineOk: boolean,
  severity: StationSeverity | undefined,
  typeFilter: TypeFilter,
): boolean {
  if (!stationLineOk) return false;
  if (typeFilter === "all") return true;
  return (severity?.counts[typeFilter] ?? 0) > 0;
}

/**
 * Leaflet map of the network. This module touches `window` at import time, so
 * it must only ever be loaded via next/dynamic with ssr: false.
 * CircleMarkers aren't keyboard-focusable; the StationBoard list is the
 * keyboard-accessible way to browse and select stations.
 */
export default function StationMap({
  severities,
  selectedStationId,
  onSelect,
  lineFilter,
  typeFilter,
}: StationMapProps) {
  const dark = usePrefersDark();

  return (
    <div className="relative h-full w-full">
      <MapContainer
        bounds={NETWORK_BOUNDS}
        boundsOptions={{ padding: [24, 24] }}
        scrollWheelZoom
        className="h-full w-full"
      >
        <TileLayer
          key={dark ? "dark" : "light"}
          attribution={TILE_ATTRIBUTION}
          url={dark ? TILE_URL_DARK : TILE_URL_LIGHT}
        />

        {STATIONS.map((station) => {
          const severity = severities.get(station.id);
          const level = severity?.level ?? "clear";
          const selected = station.id === selectedStationId;
          const line = LINE_META[station.line];
          const lineOk = lineFilter === "all" || station.line === lineFilter;
          const matches = matchesFilters(lineOk, severity, typeFilter);
          return (
            <CircleMarker
              key={station.id}
              center={[station.lat, station.lng]}
              radius={selected ? 11 : 7}
              pathOptions={
                matches
                  ? {
                      color: dark ? line.colorDark : line.color,
                      weight: selected ? 3 : 2,
                      fillColor: SEVERITY_META[level].color,
                      fillOpacity: level === "clear" ? 0.55 : 0.95,
                    }
                  : {
                      // Filtered out: stay visible for geography, but recede.
                      color: dark ? line.colorDark : line.color,
                      opacity: 0.25,
                      weight: 1,
                      fillColor: SEVERITY_META[level].color,
                      fillOpacity: 0.12,
                    }
              }
              eventHandlers={{ click: () => onSelect(station.id) }}
            >
              <Tooltip>
                <span className="font-semibold">{station.name}</span> · {line.label}{" "}
                line
                <br />
                {SEVERITY_META[level].label}
                {severity &&
                  ` · ${severity.reportCount} report${
                    severity.reportCount === 1 ? "" : "s"
                  } in the last 6h`}
              </Tooltip>
            </CircleMarker>
          );
        })}

        {/* Latest-issue pins: an icon above every station with active reports;
            hover for the details of the most recent report. */}
        {STATIONS.map((station) => {
          const severity = severities.get(station.id);
          if (!severity || severity.recent.length === 0) return null;
          const lineOk = lineFilter === "all" || station.line === lineFilter;
          if (!matchesFilters(lineOk, severity, typeFilter)) return null;

          const latest = severity.recent[0];
          const pinType = typeFilter === "all" ? latest.type : typeFilter;
          const fresh = Date.now() - Date.parse(latest.createdAt) < FRESH_REPORT_MS;
          return (
            <Marker
              key={`pin-${station.id}`}
              position={[station.lat, station.lng]}
              icon={fresh ? PIN_ICONS_FRESH[pinType] : PIN_ICONS[pinType]}
              eventHandlers={{ click: () => onSelect(station.id) }}
            >
              <Tooltip direction="top" offset={[0, -30]}>
                <span className="font-semibold">{station.name}</span>
                <br />
                Latest: {REPORT_TYPE_META[latest.type].icon}{" "}
                {REPORT_TYPE_META[latest.type].label} · {timeAgo(latest.createdAt)}
                {latest.note && (
                  <>
                    <br />
                    <em>&ldquo;{latest.note}&rdquo;</em>
                  </>
                )}
                <br />
                {SEVERITY_META[severity.level].label} · {severity.reportCount} report
                {severity.reportCount === 1 ? "" : "s"} in the last 6h
              </Tooltip>
            </Marker>
          );
        })}
      </MapContainer>

      {/* z-1000 clears Leaflet's internal panes. */}
      <div className="pointer-events-none absolute bottom-3 left-3 z-1000 rounded-xl border border-hairline bg-surface/95 px-3 py-2 text-[11px] leading-5 text-foreground shadow-md backdrop-blur">
        <p className="font-semibold text-ink-2">Severity · last 6h</p>
        <ul className="mt-0.5 flex flex-wrap gap-x-3">
          {SEVERITY_LEVELS.map((level) => (
            <li key={level} className="flex items-center gap-1.5">
              <span
                aria-hidden
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: SEVERITY_META[level].color }}
              />
              {SEVERITY_META[level].label}
            </li>
          ))}
        </ul>
        <p className="mt-1.5 font-semibold text-ink-2">Lines</p>
        <ul className="mt-0.5 flex flex-wrap gap-x-3">
          {LINES.map((line) => (
            <li key={line} className="flex items-center gap-1.5">
              <span
                aria-hidden
                className="h-0.75 w-3.5 rounded-full"
                style={{ backgroundColor: LINE_META[line].cssVar }}
              />
              {LINE_META[line].label}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
