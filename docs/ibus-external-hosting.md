# External iBus static data hosting

> **Status:** Supported in the app but **not used in production today**. We use the [free local workflow](../README.md#free-local-ibus-data-workflow) (one active version in `public/data/ibus/`). This doc is kept for when static data grows too large for the app repo, or when multi-version hosting is needed without paid object storage setup.

The app loads compact TfL iBus JSON at runtime. Full multi-version datasets (~1.9 GB for 12 base versions) are too large for the main app repo or a default Vercel deployment. Generate data locally, export an artifact, and host it on any static CDN.

We are **not** using Cloudflare R2 or similar paid storage right now. Free options such as GitHub Pages or GitHub Releases may suffice for a single-version export (~160 MB).

## URL shape

Set `NEXT_PUBLIC_IBUS_DATA_BASE_URL` to the folder that **contains** `current.json`:

```bash
NEXT_PUBLIC_IBUS_DATA_BASE_URL=https://your-static-host.example.com/data/ibus
```

Do **not** include a trailing slash. The app builds URLs like:

```text
https://your-static-host.example.com/data/ibus/current.json
https://your-static-host.example.com/data/ibus/20250619/route-schedules/337.json
https://your-static-host.example.com/data/ibus/20250619/running-shards/017.json
```

When unset, the app falls back to local `/data/ibus/...` from `public/data/ibus/`.

The browser never downloads original TfL ZIP files. Only compact JSON for the selected route/version is fetched.

## Generate and export

```bash
# Discover remote base versions
npm run check:ibus-base-versions

# Import all versions/routes (large; may require override)
IBUS_ALLOW_LARGE_STATIC=1 IBUS_BASE_VERSIONS="all" IBUS_ROUTE_SCHEDULES="all" npm run import:ibus:versions

# Build uploadable artifact
npm run export:ibus-data
```

Output:

```text
dist/ibus-data/data/ibus/current.json
dist/ibus-data/data/ibus/size-report.json
dist/ibus-data/data/ibus/{baseVersion}/route-schedules/{routeId}.json
dist/ibus-data/data/ibus/{baseVersion}/running-shards/{shard}.json
dist/ibus-data/data/ibus/{baseVersion}/vehicle-lookup.json
```

Upload preserving the `data/ibus/` path prefix on your host (or map the CDN root to that folder).

## Local development

1. Leave `NEXT_PUBLIC_IBUS_DATA_BASE_URL` unset.
2. Import a single version for dev:

```bash
IBUS_ROUTE_SCHEDULES=all npm run import:ibus
```

Or import selected routes only:

```bash
IBUS_ROUTE_SCHEDULES=337,14 npm run import:ibus
```

Heavy generated folders under `public/data/ibus/{YYYYMMDD}/` are gitignored by default. Only `current.json` is intended to stay in the app repo unless you opt in.

## Hosting options

The runtime only needs a public HTTPS base URL. Pick any option:

### Option A: Separate GitHub repository / GitHub Pages

1. Create a repo (e.g. `tfl-tracker-ibus-data`).
2. Copy `dist/ibus-data/data/ibus/` to the repo root or `docs/data/ibus/` for Pages.
3. Enable GitHub Pages on the branch/folder.
4. Set `NEXT_PUBLIC_IBUS_DATA_BASE_URL=https://<user>.github.io/<repo>/data/ibus`.

Good for experiments; watch repo size limits (~1 GB soft limit).

### Option B: Cloudflare R2 (+ public bucket or CDN)

1. Create an R2 bucket.
2. Upload `dist/ibus-data/data/ibus/` preserving keys.
3. Enable public access or attach a custom domain via Cloudflare CDN.
4. Set `NEXT_PUBLIC_IBUS_DATA_BASE_URL` to the public bucket/CDN URL ending in `/data/ibus`.

### Option C: Vercel Blob

1. Upload the export artifact to Vercel Blob storage.
2. Use the blob public URL base + `/data/ibus` path layout.
3. Set `NEXT_PUBLIC_IBUS_DATA_BASE_URL` accordingly.

### Option D: GitHub Releases artifact

1. Zip `dist/ibus-data/` and attach to a GitHub Release.
2. Host extracted files on any static server or sync to R2/Pages.
3. Point `NEXT_PUBLIC_IBUS_DATA_BASE_URL` at the served `/data/ibus` root.

Do not hard-code a provider in app code — only the base URL env var.

## CORS

The static host must allow browser `GET` from your app origin.

Example (Cloudflare R2 / S3-style):

```xml
<CORSRule>
  <AllowedOrigin>https://your-app.vercel.app</AllowedOrigin>
  <AllowedMethod>GET</AllowedMethod>
</CORSRule>
```

For public read-only JSON, some teams use `AllowedOrigin>*</AllowedOrigin>` on a dedicated CDN subdomain.

## Cache headers

Recommended:

| Path | Cache-Control |
|---|---|
| `/data/ibus/current.json` | `public, max-age=300` (5 minutes) |
| `/data/ibus/{baseVersion}/**` | `public, max-age=31536000, immutable` |

Version folders are immutable once published; bump the folder when importing a new base version.

## Vercel app deployment

In the app project:

```bash
NEXT_PUBLIC_IBUS_DATA_BASE_URL=https://your-static-host.example.com/data/ibus
```

The app repo stays small. Static iBus data lives only on the external host.

## Runtime selection (unchanged)

1. Live prediction `baseVersion` if present in manifest (local or remote).
2. Else `activeBaseVersionFromXml` from manifest.
3. Else latest available version for the route.
4. Else schedule matching unavailable.

Advanced diagnostics show `ibusDataSource`, `ibusDataBaseUrl`, `manifestLoadedFrom`, `routeScheduleLoadedFrom`, and `selectedBaseVersion`.
