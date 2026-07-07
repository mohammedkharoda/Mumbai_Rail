"use client";

import { latLngBounds } from "leaflet";
import { CircleMarker, MapContainer, TileLayer, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";

import { LINE_META, STATIONS } from "@/lib/stations";
import {
  SEVERITY_LEVELS,
  SEVERITY_META,
  type StationSeverity,
} from "@/lib/types";

interface StationMapProps {
  severities: ReadonlyMap<string, StationSeverity>;
  selectedStationId: string | null;
  onSelect: (stationId: string) => void;
}

const NETWORK_BOUNDS = latLngBounds(
  STATIONS.map((s) => [s.lat, s.lng] as [number, number]),
);

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
}: StationMapProps) {
  return (
    <div className="relative h-full w-full">
      <MapContainer
        bounds={NETWORK_BOUNDS}
        boundsOptions={{ padding: [24, 24] }}
        scrollWheelZoom
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {STATIONS.map((station) => {
          const severity = severities.get(station.id);
          const level = severity?.level ?? "clear";
          const selected = station.id === selectedStationId;
          return (
            <CircleMarker
              key={station.id}
              center={[station.lat, station.lng]}
              radius={selected ? 10 : 6}
              pathOptions={{
                color: LINE_META[station.line].color,
                weight: selected ? 3 : 1.5,
                fillColor: SEVERITY_META[level].color,
                fillOpacity: level === "clear" ? 0.45 : 0.9,
              }}
              eventHandlers={{ click: () => onSelect(station.id) }}
            >
              <Tooltip>
                <span className="font-semibold">{station.name}</span> ·{" "}
                {LINE_META[station.line].label} line
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
      </MapContainer>
      {/* z-[1000] clears Leaflet's internal panes (max z-index 400/1000). */}
      <div className="pointer-events-none absolute bottom-3 left-3 z-[1000] rounded-md bg-white/90 p-2 text-xs text-zinc-800 shadow dark:bg-zinc-900/90 dark:text-zinc-100">
        <p className="font-medium">Severity (reports, last 6h)</p>
        <ul className="mt-1 space-y-0.5">
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
      </div>
    </div>
  );
}
