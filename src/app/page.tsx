"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";

import logo from "../../public/logo.png";

import ReportForm from "@/components/ReportForm";
import StationBoard from "@/components/StationBoard";
import WeatherBanner from "@/components/WeatherBanner";
import type { ReportsRollup, StationSeverity, WeatherSnapshot } from "@/lib/types";

// Leaflet reads `window` at import time — load the map in the browser only.
const StationMap = dynamic(() => import("@/components/StationMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center text-sm text-zinc-500">
      Loading map…
    </div>
  ),
});

const REPORTS_POLL_MS = 60_000;
const WEATHER_POLL_MS = 5 * 60_000;

export default function Home() {
  const [rollup, setRollup] = useState<ReportsRollup | null>(null);
  const [reportsError, setReportsError] = useState<string | null>(null);
  const [weather, setWeather] = useState<WeatherSnapshot | null>(null);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);

  const refreshReports = useCallback(async () => {
    try {
      const res = await fetch("/api/reports", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setRollup((await res.json()) as ReportsRollup);
      setReportsError(null);
    } catch {
      setReportsError("Could not load reports");
    }
  }, []);

  const refreshWeather = useCallback(async () => {
    try {
      const res = await fetch("/api/weather", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setWeather((await res.json()) as WeatherSnapshot);
      setWeatherError(null);
    } catch {
      setWeatherError("weather service unreachable");
    }
  }, []);

  useEffect(() => {
    void refreshReports();
    void refreshWeather();
    const reportsTimer = setInterval(() => void refreshReports(), REPORTS_POLL_MS);
    const weatherTimer = setInterval(() => void refreshWeather(), WEATHER_POLL_MS);
    return () => {
      clearInterval(reportsTimer);
      clearInterval(weatherTimer);
    };
  }, [refreshReports, refreshWeather]);

  const severities = useMemo(
    () =>
      new Map<string, StationSeverity>(
        rollup?.stations.map((s) => [s.stationId, s]) ?? [],
      ),
    [rollup],
  );

  return (
    <>
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-4">
          {/* Decorative: the app name sits right beside it. */}
          <Image src={logo} alt="" priority className="h-12 w-auto shrink-0" />
          <div>
            <h1 className="text-xl font-bold">Mumbai Rail Pulse</h1>
            <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">
              Crowdsourced monsoon disruption tracker for Mumbai local trains.
            </p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">
              Community reports + Open-Meteo weather. Not affiliated with Indian
              Railways or IMD.
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-4">
        <WeatherBanner weather={weather} error={weatherError} />

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="min-w-0 space-y-4">
            <div className="h-[45vh] min-h-72 overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
              <StationMap
                severities={severities}
                selectedStationId={selectedStationId}
                onSelect={setSelectedStationId}
              />
            </div>
            <StationBoard
              rollup={rollup}
              error={reportsError}
              selectedStationId={selectedStationId}
              onSelect={setSelectedStationId}
            />
          </div>

          <ReportForm
            stationId={selectedStationId}
            onStationChange={setSelectedStationId}
            onReported={() => void refreshReports()}
          />
        </div>
      </main>
    </>
  );
}
