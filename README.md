# Mumbai Rail Pulse

<!-- markdownlint-disable-next-line MD033 -->
<img src="public/logo.png" alt="Mumbai Rail Pulse logo" width="110" align="right" />

**Crowdsourced monsoon disruption tracker for Mumbai local trains.**

Commuters report delays, waterlogging, crowding and cancellations at their
stations. Reports are layered over live rainfall data so everyone can see —
in real time — which lines and stations are struggling.

`Next.js 16` · `TypeScript` · `Tailwind CSS 4` · `Leaflet` · `Neon Postgres` · `Zod`

> **Disclaimer:** Mumbai Rail Pulse is a community project. All disruption data
> is crowdsourced and the weather alert is a heuristic derived from
> [Open-Meteo](https://open-meteo.com). It is **not affiliated with Indian
> Railways, Central/Western Railway, or the IMD**, and should not be treated as
> an official source.

## Why

Mumbai's suburban railway moves ~7.5 million people a day, and every monsoon
the same story repeats: tracks flood, trains bunch up, and the only way to know
whether your line is running is a dozen WhatsApp groups. Rail Pulse gives that
collective knowledge one shared, live map.

## Features

- 🗺️ **Live station map** — 59 stations across the Western, Central, Harbour
  and Trans-Harbour lines, color-coded by crowd-reported severity
- 📢 **One-tap reporting** — waterlogging, cancellations, delays, crowding, or
  the all-important *all clear*
- ⏳ **Self-cleaning severity scores** — each report's influence decays
  linearly over 6 hours, so stale reports fade out without any cleanup job
- 🌧️ **Monsoon weather banner** — live Mumbai rainfall + wind from Open-Meteo,
  mapped to a green/yellow/orange/red alert level
- 🚦 **Spam-resistant** — one report per IP per station every 2 minutes,
  enforced atomically in Postgres
- ♿ **Accessible & mobile-first** — keyboard-navigable station board, visible
  focus states, `prefers-reduced-motion` respected

## How the scoring works

Each report type carries a weight, and its contribution decays linearly to
zero over 6 hours:

| Report type  | Weight |
| ------------ | -----: |
| Waterlogging |   +5.0 |
| Cancelled    |   +4.0 |
| Delay        |   +2.0 |
| Crowding     |   +1.5 |
| All clear    |   −3.0 |

A station's score is the decayed sum of its active reports, bucketed into
**clear** (< 0.5), **minor** (< 3), **moderate** (< 7) and **severe** (≥ 7).

The weather alert level is derived from rain over the last hour and wind
speed — thresholds loosely follow IMD intensity bands, but it is a heuristic,
not an official warning:

| Level     | Rain (mm/h) | Wind (km/h) |
| --------- | ----------- | ----------- |
| 🟢 Green  | < 2.5       | < 40        |
| 🟡 Yellow | ≥ 2.5       | ≥ 40        |
| 🟠 Orange | ≥ 7         | ≥ 55        |
| 🔴 Red    | ≥ 15        | ≥ 75        |

## API

| Endpoint       | Method | Description                                                    |
| -------------- | ------ | -------------------------------------------------------------- |
| `/api/reports` | `GET`  | Severity rollup for stations with active reports, worst-first  |
| `/api/reports` | `POST` | Submit `{ stationId, type, note? }` → `201` / `400` / `429`    |
| `/api/weather` | `GET`  | Live rainfall/wind + derived alert level (upstream cached 5m)  |

All inputs are validated with Zod against an allowlist of station IDs and
report types.

## Getting started

```bash
pnpm install
pnpm dev        # http://localhost:3000
```

That's it — with no configuration the app uses a local JSON-file store
(`./data/reports.json`), so it runs fully offline apart from weather and map
tiles.

### With a database (recommended, required in production)

1. Create a free [Neon](https://neon.tech) Postgres project
2. Copy the pooled connection string into `.env` (see [.env.example](.env.example)):

   ```ini
   DATABASE_URL=postgresql://...
   ```

3. Restart the dev server. Tables are created automatically on first request —
   there is no migration step.

## Deploying to Vercel

1. Push this repo to GitHub and import it in [Vercel](https://vercel.com)
2. Add `DATABASE_URL` under **Project → Settings → Environment Variables**
3. Deploy

`DATABASE_URL` is required on Vercel: serverless filesystems are read-only and
instances don't share memory, so both reports and the rate limiter live in
Postgres there.

## Architecture notes

```text
src/
  app/
    api/reports/route.ts   → GET severity rollup · POST new report
    api/weather/route.ts   → GET live weather + derived alert level
    page.tsx               → client page; polls reports (60s) & weather (5min)
  lib/
    types.ts               → all shared domain types
    stations.ts            → static station list (id, name, line, lat, lng)
    store.ts               → ALL persistence: Neon Postgres, JSON-file fallback
  components/
    WeatherBanner.tsx  StationMap.tsx  ReportForm.tsx  StationBoard.tsx
```

Decisions worth knowing about:

- **Single storage module.** Everything that touches persistence lives in
  `lib/store.ts` behind two async functions, which is what made the
  JSON-file → Neon swap a one-file change.
- **Atomic rate limiting.** The limiter is a single `INSERT … ON CONFLICT`
  gate CTE, so concurrent requests across serverless instances can't slip
  past it.
- **No cleanup jobs.** Decay math handles staleness at read time; expired
  rows are deleted opportunistically on writes.
- **Leaflet is browser-only.** The map is loaded with `next/dynamic`
  (`ssr: false`) because Leaflet touches `window` at import time.

## Roadmap

- [ ] Per-station weather (monsoon cells are localized; one city-wide reading
      is a v1 simplification)
- [ ] Line-level rollups and filtering
- [ ] Historical patterns ("Andheri floods first, every time")
- [ ] PWA install + push alerts for a chosen home line
