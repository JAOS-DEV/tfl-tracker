# London Bus Tracker

Monitor London bus routes with live TfL Open Data predictions, schematic loop views, stop arrivals, favourites, local service alerts, and schedule-aware bus intelligence powered by TfL iBus static data.

This is an **independent project** — not affiliated with or endorsed by Transport for London.

## What it does

- **Track up to 3 routes** at once with live arrival predictions refreshed every ~30 seconds.
- **Schematic loop view** — buses positioned along a simplified route diagram (not real geography or GPS).
- **List view** — traditional stop-by-stop arrival list for the selected direction.
- **Early / late / on-time badges** — estimated by matching live TfL predictions to iBus compact route schedules (when a schedule file exists for that route).
- **Schedule ghosts** — optional markers for scheduled journeys that appear active but have no matching live bus.
- **Feed ghosts** — optional detection when a live prediction disappears from refreshes (possible ghost bus; inferred, not confirmed).
- **Running numbers, fleet numbers, and registrations** — resolved from TfL iBus static data, with optional Bustimes fallback for fleet numbers.
- **Service health** — local heuristics for bunching, gaps, stale data, late buses, and related alerts (not an official TfL score).
- **Favourites and recents** — routes and stops stored in browser `localStorage`.
- **Shareable URLs** — e.g. `?routes=337,220` to open specific routes.
- **Stop detail** — tap a stop for live arrivals; search nearby stops with geolocation.
- **Route history** — snapshots recorded locally while the app is open (exportable from Settings).
- **PWA** — installable on iPhone/Android/desktop for a standalone app experience.

## Tech stack

| Layer | Choice |
| --- | --- |
| Framework | [Next.js 16](https://nextjs.org/) (App Router, React 19) |
| Styling | Tailwind CSS 4 |
| Data fetching | TanStack React Query |
| Validation | Zod |
| Tests | Vitest + Testing Library |
| Hosting | Vercel (recommended) |

All TfL API calls go through **Next.js API routes** under `app/api/tfl/*` so your API key never reaches the browser.

## Quick start

### Prerequisites

- Node.js 22+ (matches CI)
- A [TfL Open Data API key](https://api-portal.tfl.gov.uk/)

### Local development

1. Clone the repository and install dependencies:

```bash
npm install
```

2. Copy the environment template and add your API key:

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:

```
TFL_API_KEY=your_tfl_api_key_here
```

3. Start the dev server:

```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000).

The app works without running the iBus importer if compact static JSON is available locally (`public/data/ibus/`) or via `NEXT_PUBLIC_IBUS_DATA_BASE_URL`. Re-run the importer when you need a newer TfL base version or additional route schedules.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Next.js dev server |
| `npm run build` | Production build |
| `npm start` | Run production server (after build) |
| `npm test` | Run unit tests (Vitest) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run typecheck` | TypeScript check (`tsc --noEmit`) |
| `npm run lint` | ESLint |
| `npm run check:ibus-base-versions` | Compare active XML, remote probes, and local imported versions |
| `npm run import:ibus` | Import iBus static JSON (optional route schedules via env) |
| `npm run import:ibus:active` | Import all routes for the active base version from `Base_Version.xml` |
| `npm run rebuild:ibus-manifest` | Rebuild `public/data/ibus/current.json` from local folders |
| `npm run verify:ibus-local` | Verify local manifest and active version are ready to deploy |
| `npm run export:ibus-data` | Copy `public/data/ibus/` to `dist/ibus-data/data/ibus/` for external upload |
| `npm run generate:icons` | Regenerate PWA icon assets |

## How the app works

### Main screen

1. **Search** for a route by number or name (TfL line search API).
2. **Add** up to three routes to the active list. The first route auto-expands when you have multiple routes open.
3. Each **route card** loads route sequence (stops), live arrivals, line status, and — when expanded — full route intelligence (schedule matching, ghosts, history).

### Data flow (expanded route card)

```
TfL line arrivals API
        ↓
Vehicle positions on schematic loop (estimated from predictions)
        ↓
iBus running-number / fleet / registration enrichment (tripId lookup)
        ↓
Schedule timing (iBus compact route schedule, or TfL timetable if enabled)
        ↓
Feed ghost tracking (prediction disappearance)
        ↓
Schedule ghost candidates (active scheduled journeys without live match)
        ↓
Terminus layover state
        ↓
Service health metrics + user-configurable alerts
```

**Lite mode** (collapsed cards and multi-route dashboard summary) skips heavy schedule matching and ghost generation to keep polling cheap when you have several routes open.

### Bus markers on the loop

| Visual | Meaning |
| --- | --- |
| Green ring + `OK` | Trusted on-time vs schedule |
| Amber/yellow ring + `-N` | Trusted early (N minutes) |
| Red/amber ring + `+N` | Trusted late (N minutes) |
| Blue ring, no badge | Unknown or untrusted schedule match |
| Dashed / ghost styling | Possible feed ghost or schedule ghost |
| Terminus connector | Bus waiting at terminus (layover) |

Positions are **estimated** from arrival predictions and route stop order — not live GPS.

### Settings (gear icon)

Stored in `localStorage` under `tfl-tracker:display-settings`:

- Default view: loop or list
- Smooth bus movement on the loop
- Show schedule ghosts
- Show bus registration / fleet / running number on markers
- Show timing points (schedule-derived; QSI reserved for verified import)
- Service details and history panels inline
- **Advanced diagnostics** — extra ghost detail, registration diagnostics, and low-confidence schedule ghosts
- Global alert defaults (bunching, stale data, late buses, etc.)
- Theme (light / dark / system)
- Export route history JSON
- Reset app to defaults
- About / data sources

### URL parameters

| Parameter | Example | Effect |
| --- | --- | --- |
| `routes` | `?routes=14,N22` | Open up to 3 routes (comma-separated) |
| `view` | `?view=list` | Default visual mode for shared routes |
| `stop` | `?stop=490000123A` | Open stop arrivals modal |

### What stays on your device

Favourites, recents, alert preferences, display settings, theme, route history snapshots, and prediction-tracking state (for ghost detection) are stored in **browser local storage**. Nothing is synced to a server.

## iBus static data and base versions

The app matches live buses against **compact TfL iBus JSON** stored under `public/data/ibus/`. There is no database or hosted importer — you run import scripts locally, commit the active version, and deploy.

### Why base versions matter

- Live TfL arrival predictions include a **`baseVersion`** field (e.g. `20250619`).
- TfL’s [`Base_Version.xml`](https://ibus.data.tfl.gov.uk/Base_Version.xml) also indicates the **active** iBus base version.
- The newest-looking folder on `ibus.data.tfl.gov.uk` is **not always** the version live predictions use right now.
- Running/block lookup and schedule matching use trip IDs from that active base version. If imported static data is for a different version, lookups fail.
- **Blue/unknown buses** often mean: the bus is live and position-known, but schedule timing is unknown or untrusted — commonly because `liveBaseVersion` and the imported static `baseVersion` do not align.

Example mismatch (fix by importing the active version):

| Source | Value |
| --- | --- |
| Live predictions / `Base_Version.xml` | `20250619` |
| Repo static data (before update) | `20260606` |

When that happens, diagnostics may show `static-trip-not-found-live-version-differs` for many vehicles.

### What the importer does

1. Fetches `Base_Version.xml` for the active base version.
2. Downloads matching zip files via direct URLs (server-side / Node only — never in the browser).
3. Parses Vehicle, Garage, operator schedule, and compact per-route schedules.
4. Writes JSON under `public/data/ibus/{baseVersion}/`.
5. Updates `public/data/ibus/current.json` with available local versions and `activeBaseVersionFromXml`.

The app reads `current.json` and only fetches a route schedule when you **expand** that route. It does not load all schedules on page load.

### What iBus data powers

| Feature | Source |
| --- | --- |
| Fleet numbers | `Vehicle_{baseVersion}.zip` → registration → bonnet number |
| Running / block numbers | Running-number shards keyed by `tripId` (256 shards) |
| Garage lookup | Garage XML |
| Early/late/on-time | Compact per-route schedule JSON |
| Schedule ghosts | Same compact schedules + live vehicle matching |

Running numbers are resolved via **tripId + baseVersion** — never from tripId alone.

**Bustimes** remains an optional server-side fallback for fleet number only (`/api/vehicles/fleet-fallback`).

## Free local iBus data workflow

This is the **default, free approach** we use today:

- Keep **one active all-route** iBus base version in `public/data/ibus/`.
- Do **not** set `NEXT_PUBLIC_IBUS_DATA_BASE_URL`.
- Runtime uses local `/data/ibus/`.
- When TfL’s active base version changes, manually import the new version and redeploy.

### Routine update (recommended)

```bash
npm run check:ibus-base-versions
npm run import:ibus:active
npm run rebuild:ibus-manifest
npm run verify:ibus-local
npm run typecheck
npm run lint
npm test
npm run build
```

| Command | Purpose |
| --- | --- |
| `check:ibus-base-versions` | Shows active version from `Base_Version.xml`, remote probes, and what is imported locally |
| `import:ibus:active` | Imports **all routes** for the active base version and rebuilds the manifest |
| `rebuild:ibus-manifest` | Refreshes `public/data/ibus/current.json` from local version folders |
| `verify:ibus-local` | Checks manifest, active folder, route count; warns if too many local versions or remote URL is set |

Deploy after the active compact data is updated.

### Manual explicit version fallback

If you need a specific version (e.g. active XML says `20250619` but you want to pin it explicitly):

```bash
IBUS_BASE_VERSION=20250619 IBUS_ROUTE_SCHEDULES=all npm run import:ibus
npm run rebuild:ibus-manifest
npm run verify:ibus-local
```

(`IBUS_BASE_VERSION` selects one version; `import:ibus:active` always follows live `Base_Version.xml`.)

### Replacing an old local base version

To switch from an old version to the new active one and keep the repo smaller:

```bash
# Optional: remove old local version folder
git rm -r public/data/ibus/20260606

# Add manifest and force-add the active version folder (version dirs are gitignored)
git add public/data/ibus/current.json
git add -f public/data/ibus/20250619

git commit -m "Update iBus static data to active base version 20250619"
git push
```

**Why `git add -f`?** `/public/data/ibus/[0-9]{8}/` is gitignored to prevent accidental multi-version commits (~1.9 GB if all versions are imported). The **one active** local version must be intentionally force-added.

### Other import commands

Default import (vehicle, garage, running shards — route schedules only if `IBUS_ROUTE_SCHEDULES` is set):

```bash
npm run import:ibus
```

Selected routes:

```bash
IBUS_ROUTE_SCHEDULES="337,156" npm run import:ibus
```

All routes for active or selected version:

```bash
IBUS_ROUTE_SCHEDULES=all npm run import:ibus
```

Force fresh download:

```bash
IBUS_FORCE_DOWNLOAD=1 IBUS_ROUTE_SCHEDULES=all npm run import:ibus:active
```

Multi-version experiment (large — not for default app repo):

```bash
IBUS_ALLOW_LARGE_STATIC=1 IBUS_BASE_VERSIONS=all IBUS_ROUTE_SCHEDULES=all npm run import:ibus:versions
```

## Optional external iBus data hosting

External hosting support **exists but is not used by default**. It is kept for later: all routes × all base versions is estimated around **1.9 GB**, too large for a comfortable app-repo / Vercel deployment.

When you eventually host compact JSON externally:

```env
NEXT_PUBLIC_IBUS_DATA_BASE_URL=https://your-static-host.example.com/data/ibus
```

- If unset, the app uses local `/data/ibus/`.
- External hosting would allow multiple versions without bloating the app repo.
- **We are not using this now** — options like Cloudflare R2 may require a payment method. Do not remove this support; see [docs/ibus-external-hosting.md](docs/ibus-external-hosting.md).

Export artifact for upload:

```bash
npm run export:ibus-data
```

## Troubleshooting blue buses

A **blue** bus usually means:

```text
The bus is live/position-known, but schedule timing is unknown or untrusted.
```

Useful diagnostics (enable **Advanced diagnostics** in Settings):

| Field | Meaning |
| --- | --- |
| `liveBaseVersion` | Base version from live TfL prediction |
| `activeBaseVersionFromXml` | Active version from manifest / TfL XML |
| `selectedBaseVersion` | Version used for schedule + running lookup |
| `selectedBecause` | Why that version was chosen |
| `runningLookupStatus` | Whether tripId matched running shards |
| `lookupAttemptedKeys` | Keys tried during version selection |

If many buses show:

```text
static-trip-not-found-live-version-differs
```

the likely fix is:

```text
Import the active/live baseVersion (npm run import:ibus:active) and redeploy.
```

Run `npm run check:ibus-base-versions` to compare live XML vs local folders.


## Project structure

```
app/
  api/tfl/          # TfL API proxy routes (server-side key)
  api/vehicles/     # Fleet enrichment / Bustimes fallback
  page.tsx          # Main single-page app
  layout.tsx        # Root layout, PWA metadata

components/         # UI (RouteCard, loop, modals, settings, …)
hooks/              # React Query hooks (arrivals, intelligence, history, …)
lib/
  tfl/              # TfL client, normalizers, types
  ibus/             # iBus import, compact schedule decode, parsers
  routeIntelligence.ts   # Core pipeline: positions → timing → ghosts → metrics
  ibusScheduleDeviation.ts
  scheduledGhostBuses.ts / scheduledGhostVehicles.ts
  scheduleDeviation.ts
  localRouteHistory.ts
  displaySettings.ts / routeAlerts.ts / storage.ts
public/data/ibus/   # Manifest + optional local dev fixtures (heavy versions gitignored)
scripts/
  exportIbusData.ts  # Copy public/data/ibus → dist/ibus-data for external upload
  importIbusStatic.ts
```

## API routes

| Route | Purpose |
| --- | --- |
| `/api/tfl/line-arrivals` | Live predictions for a route |
| `/api/tfl/route-sequence` | Stop sequence for loop/list |
| `/api/tfl/line-status` | Line disruptions |
| `/api/tfl/line-search` | Route search |
| `/api/tfl/stop-arrivals` | Arrivals at a stop |
| `/api/tfl/stop-search` | Stop search |
| `/api/tfl/nearby-stops` | Stops near lat/lon |
| `/api/tfl/stop-disruptions` | Stop-level disruptions |
| `/api/tfl/timetable` | TfL timetable (optional; not used by default on route cards) |
| `/api/vehicles/enrichment` | Batch vehicle registration enrichment |
| `/api/vehicles/fleet-fallback` | Bustimes fleet fallback |

## Deploy to Vercel

1. Push this repository to GitHub.
2. Import the project in [Vercel](https://vercel.com/new).
3. In **Project Settings → Environment Variables**, add:
   - `TFL_API_KEY` — your TfL Open Data API key
4. Deploy.

The browser calls relative paths like `/api/tfl/line-arrivals`; the key stays server-side.

No custom `vercel.json` is required for a standard Next.js deployment.

**Note:** Production can load iBus JSON from an external static host (`NEXT_PUBLIC_IBUS_DATA_BASE_URL`) so the app repo stays small. The importer is a maintainer workflow, not part of the Vercel build. See [docs/ibus-external-hosting.md](docs/ibus-external-hosting.md).

## Install on iPhone (PWA)

Safari does not show an automatic install prompt.

1. Open the site in Safari.
2. Tap **Share**.
3. Choose **Add to Home Screen**.

Location for “Find stops near me” uses the normal Safari permission prompt the first time you use it.

## CI

`.github/workflows/ci.yml` runs on pull requests and pushes to `main`:

- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build` (with `TFL_API_KEY` from GitHub secrets)

Deployment is handled by Vercel’s GitHub integration.

## Environment variables

| Variable | Where | Description |
| --- | --- | --- |
| `TFL_API_KEY` | Server only (`.env.local` / Vercel) | TfL Open Data API key |

Importer-only (local shell environment, not required for `npm run dev`):

| Variable | Description |
| --- | --- |
| `IBUS_ROUTE_SCHEDULES` | `none` (default), comma-separated route IDs, or `all` |
| `IBUS_FORCE_DOWNLOAD` | `1` to ignore cached zip downloads |
| `IBUS_CLEAN_OLD` | `1` to delete old `public/data/ibus/<version>/` folders after import |

## Limitations (read before relying on this app)

- Bus positions are **estimated**, not GPS.
- Early/late status depends on schedule matching quality; branches, missing schedules, and night routes can be uncertain.
- Ghost buses are **inferred** — possible, not confirmed.
- Local history only records while the app is open on this device.
- Service health is a local heuristic, not official TfL operational data.
- The loop is schematic and does not reflect real roads.
- Do not use for safety-critical travel decisions.

## License / attribution

Powered by **TfL Open Data**. See in-app **Settings → About data & limitations** for the full disclaimer shown to users.
