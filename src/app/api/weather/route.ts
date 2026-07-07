import { NextResponse } from "next/server";
import { z } from "zod";

import type { AlertLevel, WeatherSnapshot } from "@/lib/types";

// Open-Meteo is free and keyless. One query for central Mumbai stands in for
// the whole network in v1 — monsoon cells are localized, so per-station
// weather is a real future improvement.
// timeformat=unixtime keeps hourly timestamps timezone-independent.
const OPEN_METEO_URL =
  "https://api.open-meteo.com/v1/forecast" +
  "?latitude=19.076&longitude=72.8777" +
  "&current=temperature_2m,precipitation,wind_speed_10m,wind_gusts_10m" +
  "&hourly=precipitation&forecast_days=1&timezone=Asia%2FKolkata&timeformat=unixtime";

// Always compute fresh (the upstream fetch below still caches for 5 min).
export const dynamic = "force-dynamic";

const openMeteoSchema = z.object({
  current: z.object({
    time: z.number(),
    temperature_2m: z.number().nullable(),
    precipitation: z.number().nullable(),
    wind_speed_10m: z.number().nullable(),
    wind_gusts_10m: z.number().nullable(),
  }),
  hourly: z.object({
    time: z.array(z.number()),
    precipitation: z.array(z.number().nullable()),
  }),
});

type OpenMeteoPayload = z.infer<typeof openMeteoSchema>;

export async function GET(): Promise<NextResponse> {
  let payload: OpenMeteoPayload;
  try {
    // revalidate: 300 → at most one upstream call per 5 minutes, regardless of
    // how often clients poll us.
    const res = await fetch(OPEN_METEO_URL, { next: { revalidate: 300 } });
    if (!res.ok) {
      return NextResponse.json({ error: "Weather source unavailable" }, { status: 502 });
    }
    const parsed = openMeteoSchema.safeParse(await res.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Weather source returned an unexpected payload" },
        { status: 502 },
      );
    }
    payload = parsed.data;
  } catch {
    return NextResponse.json({ error: "Weather source unreachable" }, { status: 502 });
  }

  const { current, hourly } = payload;
  const precipitationMm = lastHourPrecipMm(hourly, current);
  const windKph = current.wind_speed_10m ?? 0;

  const snapshot: WeatherSnapshot = {
    fetchedAt: new Date().toISOString(),
    precipitationMm,
    windKph,
    windGustKph: current.wind_gusts_10m,
    temperatureC: current.temperature_2m,
    alertLevel: deriveAlertLevel(precipitationMm, windKph),
    source: "open-meteo",
  };
  return NextResponse.json(snapshot);
}

/**
 * Rough "rain over the last hour" in mm. Open-Meteo hourly precipitation at
 * time T is the accumulation for the hour ending at T, and current.precipitation
 * covers the preceding 15 minutes (×4 ≈ hourly rate). We take the max of the
 * completed hour, the in-progress hour and the instantaneous rate so a burst
 * that just started still registers. Heuristic by design.
 */
function lastHourPrecipMm(
  hourly: OpenMeteoPayload["hourly"],
  current: OpenMeteoPayload["current"],
): number {
  let completedIdx = -1;
  for (let i = 0; i < hourly.time.length; i++) {
    if (hourly.time[i] <= current.time) completedIdx = i;
  }
  const at = (i: number): number => hourly.precipitation[i] ?? 0;
  const candidates = [
    completedIdx >= 0 ? at(completedIdx) : 0,
    completedIdx + 1 < hourly.time.length ? at(completedIdx + 1) : 0,
    (current.precipitation ?? 0) * 4,
  ];
  return Math.round(Math.max(0, ...candidates) * 10) / 10;
}

/**
 * Map precipitation (mm over the last hour) and wind (km/h) to an alert level.
 * Thresholds loosely follow IMD rainfall-intensity bands, but this is a
 * heuristic derived from Open-Meteo data — NOT an official IMD warning, and
 * the UI must say so.
 */
function deriveAlertLevel(precipMm: number, windKph: number): AlertLevel {
  if (precipMm >= 15 || windKph >= 75) return "red";
  if (precipMm >= 7 || windKph >= 55) return "orange";
  if (precipMm >= 2.5 || windKph >= 40) return "yellow";
  return "green";
}
