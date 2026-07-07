import { ALERT_META, type WeatherSnapshot } from "@/lib/types";

interface WeatherBannerProps {
  weather: WeatherSnapshot | null;
  error: string | null;
}

export default function WeatherBanner({ weather, error }: WeatherBannerProps) {
  if (error) {
    return (
      <section
        role="status"
        className="rounded-xl border border-zinc-300 bg-zinc-50 p-4 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
      >
        Weather is unavailable right now ({error}). Station reports below still work.
      </section>
    );
  }

  if (!weather) {
    return (
      <section
        role="status"
        className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400"
      >
        Checking Mumbai weather…
      </section>
    );
  }

  const meta = ALERT_META[weather.alertLevel];
  const updatedAt = new Date(weather.fetchedAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <section
      role="status"
      aria-live="polite"
      className="rounded-xl border p-4"
      style={{ borderColor: meta.color, backgroundColor: `${meta.color}18` }}
    >
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden
          className={`h-3 w-3 shrink-0 rounded-full ${
            weather.alertLevel === "red" ? "motion-safe:animate-pulse" : ""
          }`}
          style={{ backgroundColor: meta.color }}
        />
        <h2 className="font-semibold">{meta.label}</h2>
      </div>
      <p className="mt-2 text-sm">
        Rain <strong>{weather.precipitationMm} mm</strong> in the last hour · Wind{" "}
        <strong>{Math.round(weather.windKph)} km/h</strong>
        {weather.windGustKph !== null && (
          <> (gusts {Math.round(weather.windGustKph)} km/h)</>
        )}
        {weather.temperatureC !== null && <> · {Math.round(weather.temperatureC)}°C</>}
      </p>
      <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
        Derived from Open-Meteo rainfall &amp; wind — a heuristic, not an official IMD
        alert. Updated {updatedAt}.
      </p>
    </section>
  );
}
