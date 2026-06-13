# London Bus Tracker

Monitor London bus routes with live TfL Open Data predictions, schematic loop views, stop arrivals, favourites, and local service alerts.

## Local development

1. Copy `.env.local.example` to `.env.local` and add your [TfL API key](https://api-portal.tfl.gov.uk/).
2. Install dependencies and start the dev server:

```bash
npm install
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000).

The app uses Next.js API routes under `/api/tfl/*` to proxy TfL requests and keep your API key on the server.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Next.js dev server |
| `npm run build` | Production build |
| `npm test` | Run unit tests |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint |
| `npm run import:ibus` | Download and build TfL iBus static JSON under `public/data/ibus/` |

## Updating TfL iBus static data

The app uses static iBus JSON generated locally on your machine. There is no database, hosted importer, or cron job — you run the importer, commit the generated files, and Vercel serves them as static assets.

### What the importer does

1. Fetches [`Base_Version.xml`](https://ibus.data.tfl.gov.uk/Base_Version.xml) to find the current base version (for example `20260606`).
2. Downloads matching TfL iBus zip files using **direct file URLs** such as `https://ibus.data.tfl.gov.uk/Base_Version_20260606/Vehicle_20260606.zip`. The browser hash route (`#!Base_Version_...`) and folder listing URL (`/Base_Version_20260606/`) are not used for downloads.
3. Parses Vehicle, Garage, operator schedule (Journey/Block), and optional route schedule data.
4. Writes compact JSON under `public/data/ibus/`.
5. Updates `public/data/ibus/current.json` so the app knows which base version and route schedules are available.

The app only loads route schedule JSON for routes listed in `current.json` → `routeScheduleRoutes` when you open that route. It does not load all schedules on page load.

### Commands

Default / core update (vehicle, garage, running-number shards, manifest, import report — no route schedules unless already present):

```powershell
npm run import:ibus
```

Selected route schedules (for example routes 337 and 156):

```powershell
$env:IBUS_ROUTE_SCHEDULES="337,156"
npm run import:ibus
```

All route schedules:

```powershell
$env:IBUS_ROUTE_SCHEDULES="all"
npm run import:ibus
```

Force fresh download (ignore local cache):

```powershell
$env:IBUS_FORCE_DOWNLOAD="1"
$env:IBUS_ROUTE_SCHEDULES="all"
npm run import:ibus
```

Optional: remove old `public/data/ibus/<oldBaseVersion>/` folders after a successful import:

```powershell
$env:IBUS_CLEAN_OLD="1"
npm run import:ibus
```

### After importing

```bash
git add public/data/ibus
git commit -m "Update iBus static data"
git push
```

- `.ibus-cache/` is local only (gitignored) and speeds up repeated imports.
- Commit `public/data/ibus/current.json` and `public/data/ibus/<baseVersion>/`.
- Re-run when TfL publishes a new base version.

This powers fleet numbers, running numbers, garage lookup, and possible ghost bus detection.

## TfL iBus static import (details)

Fleet numbers and running numbers use official TfL iBus static data shipped as JSON in the repo — no database, cron, or always-running backend.

- **Fleet numbers** — `Registration_Number` → `Bonnet_No` from `Vehicle_<baseVersion>.zip`
- **Running numbers** — `${baseVersion}:${tripId}` → Journey `aJourney_Idx` → Block `aBlock_Idx` → `Running_No` (never match tripId alone)
- **Bustimes** — optional server-side fallback for fleet number only when iBus Vehicle lookup misses
- **Headway** — not used

Running-number shards are split 256 ways (`tripId % 256`) so the app loads one small JSON file per lookup.

## Deploy to Vercel

1. Push this repository to GitHub.
2. Import the project in [Vercel](https://vercel.com/new).
3. In Vercel Project Settings → Environment Variables, add:
   - `TFL_API_KEY` — your TfL Open Data API key
4. Deploy.

Vercel runs the Next.js app and the API routes in `app/api/tfl/*`. The browser calls relative paths like `/api/tfl/line-arrivals`; the TfL API key stays server-side and is never sent to the client.

No extra `vercel.json` is required — Vercel’s Next.js defaults are sufficient.

## Install on iPhone (PWA)

The app is a Progressive Web App. On iPhone, Safari does not show an automatic install popup. To add it to your Home Screen:

1. Open the site in Safari.
2. Tap the **Share** button.
3. Choose **Add to Home Screen**.

After that, it opens like a standalone app. Location access still uses Safari’s normal permission prompt the first time you tap **Find stops near me**.

## CI

`.github/workflows/ci.yml` runs on pull requests and pushes to `main`:

- typecheck
- lint
- tests
- `npm run build`

Deployment is handled by Vercel’s GitHub integration.

## Environment variables

| Variable | Where used | Description |
| --- | --- | --- |
| `TFL_API_KEY` | Server only | TfL Open Data API key (local `.env.local` or Vercel project settings) |
