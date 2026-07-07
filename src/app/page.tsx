"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";

import logo from "../../public/logo.png";
import FeedbackForm from "@/components/FeedbackForm";
import FilterBar from "@/components/FilterBar";
import NewsPanel from "@/components/NewsPanel";
import ReportForm from "@/components/ReportForm";
import StationBoard from "@/components/StationBoard";
import WeatherBanner from "@/components/WeatherBanner";
import type {
  LineFilter,
  ReportsRollup,
  StationSeverity,
  TypeFilter,
  WeatherSnapshot,
} from "@/lib/types";

// Leaflet reads `window` at import time — load the map in the browser only.
const StationMap = dynamic(() => import("@/components/StationMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center text-sm text-ink-3">
      Loading map…
    </div>
  ),
});

const REPORTS_POLL_MS = 60_000;
const WEATHER_POLL_MS = 5 * 60_000;

// Hard-stop segments in the four line colors — a little rail-map flourish.
const LINE_STRIP =
  "linear-gradient(90deg, var(--line-western) 0 25%, var(--line-central) 25% 50%, var(--line-harbour) 50% 75%, var(--line-trans-harbour) 75% 100%)";

export default function Home() {
  const [rollup, setRollup] = useState<ReportsRollup | null>(null);
  const [reportsError, setReportsError] = useState<string | null>(null);
  const [weather, setWeather] = useState<WeatherSnapshot | null>(null);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);
  const [lineFilter, setLineFilter] = useState<LineFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");

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
      <div aria-hidden className="h-1 w-full" style={{ background: LINE_STRIP }} />

      <header className="border-b border-hairline bg-surface">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-4">
          {/* Decorative: the app name sits right beside it. */}
          <Image src={logo} alt="" priority className="h-11 w-auto shrink-0" />
          <div className="min-w-0">
            <h1 className="text-lg font-bold tracking-tight sm:text-xl">
              Mumbai Rail Pulse
            </h1>
            <p className="text-[13px] text-ink-2">
              Crowdsourced monsoon disruption tracker for Mumbai local trains.
            </p>
          </div>
          <span className="ml-auto hidden items-center gap-1.5 rounded-full border border-hairline bg-surface-2 px-2.5 py-1 text-xs font-medium whitespace-nowrap text-ink-2 sm:inline-flex">
            <span
              aria-hidden
              className="h-1.5 w-1.5 rounded-full bg-emerald-500 motion-safe:animate-pulse"
            />
            Live · refreshes every 60s
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-4 sm:py-5">
        <WeatherBanner weather={weather} error={weatherError} />

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="min-w-0 space-y-4">
            <FilterBar
              lineFilter={lineFilter}
              typeFilter={typeFilter}
              onLineChange={setLineFilter}
              onTypeChange={setTypeFilter}
            />

            <section className="overflow-hidden rounded-2xl border border-hairline bg-surface shadow-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-x-2 border-b border-hairline px-4 py-3">
                <h2 className="text-sm font-semibold">Network map</h2>
                <p className="text-xs text-ink-3">
                  Tap a station to pre-fill the report form
                </p>
              </div>
              <div className="h-[46vh] min-h-80">
                <StationMap
                  severities={severities}
                  selectedStationId={selectedStationId}
                  onSelect={setSelectedStationId}
                  lineFilter={lineFilter}
                  typeFilter={typeFilter}
                />
              </div>
            </section>

            <StationBoard
              rollup={rollup}
              error={reportsError}
              selectedStationId={selectedStationId}
              onSelect={setSelectedStationId}
              lineFilter={lineFilter}
              typeFilter={typeFilter}
            />
          </div>

          <div className="min-w-0 space-y-4">
            <ReportForm
              stationId={selectedStationId}
              onStationChange={setSelectedStationId}
              onReported={() => void refreshReports()}
            />
            <FeedbackForm />
            <NewsPanel />
          </div>
        </div>
      </main>

      <footer className="border-t border-hairline py-6">
        <p className="mx-auto w-full max-w-6xl px-4 text-center text-xs text-ink-3">
          Community project · Reports are crowdsourced and the weather alert is
          derived from Open-Meteo. Not affiliated with Indian Railways or IMD.
        </p>
      </footer>
    </>
  );
}
