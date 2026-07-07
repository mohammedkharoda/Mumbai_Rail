import { ALERT_META, type WeatherSnapshot } from "@/lib/types";

interface WeatherBannerProps {
  weather: WeatherSnapshot | null;
  error: string | null;
}

const cardClasses = "rounded-2xl border border-hairline bg-surface shadow-sm";

function StatTile({
  icon,
  label,
  value,
  unit,
  sub,
}: {
  icon: string;
  label: string;
  value: string;
  unit: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl bg-surface-2 px-3 py-2.5">
      <dt className="flex items-center gap-1.5 text-[11px] font-medium text-ink-3">
        <span aria-hidden>{icon}</span>
        {label}
      </dt>
      <dd className="mt-0.5 text-xl font-semibold tracking-tight sm:text-2xl">
        {value} <span className="text-xs font-normal text-ink-3">{unit}</span>
      </dd>
      {sub && <dd className="mt-0.5 text-[11px] text-ink-3">{sub}</dd>}
    </div>
  );
}

export default function WeatherBanner({ weather, error }: WeatherBannerProps) {
  if (error) {
    return (
      <section role="status" className={`${cardClasses} p-4 text-sm text-ink-3`}>
        Weather is unavailable right now ({error}). Station reports below still work.
      </section>
    );
  }

  if (!weather) {
    return (
      <section role="status" className={`${cardClasses} p-4 text-sm text-ink-3`}>
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
    <section role="status" aria-live="polite" className={`${cardClasses} overflow-hidden`}>
      <div aria-hidden className="h-1" style={{ backgroundColor: meta.color }} />
      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold tracking-wide uppercase"
            style={{ backgroundColor: meta.color, color: meta.fg }}
          >
            <span
              aria-hidden
              className={`h-1.5 w-1.5 rounded-full ${
                weather.alertLevel === "red" ? "motion-safe:animate-pulse" : ""
              }`}
              style={{ backgroundColor: meta.fg }}
            />
            {meta.label} alert
          </span>
          <h2 className="text-sm font-semibold sm:text-base">{meta.headline}</h2>
          <span className="ml-auto text-xs whitespace-nowrap text-ink-3">
            Updated {updatedAt}
          </span>
        </div>

        <dl className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
          <StatTile
            icon="🌧️"
            label="Rain · last hour"
            value={String(weather.precipitationMm)}
            unit="mm"
          />
          <StatTile
            icon="💨"
            label="Wind"
            value={String(Math.round(weather.windKph))}
            unit="km/h"
            sub={
              weather.windGustKph !== null
                ? `gusts ${Math.round(weather.windGustKph)} km/h`
                : undefined
            }
          />
          <StatTile
            icon="🌡️"
            label="Temperature"
            value={weather.temperatureC !== null ? String(Math.round(weather.temperatureC)) : "—"}
            unit="°C"
          />
        </dl>

        <p className="mt-3 text-xs text-ink-3">
          Derived from Open-Meteo rainfall &amp; wind — a heuristic, not an official IMD
          alert.
        </p>
      </div>
    </section>
  );
}
