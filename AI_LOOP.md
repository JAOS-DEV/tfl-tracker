# AI_LOOP — tfl-tracker (“Where's My Bus?”)

Project-specific adapter for the Cursor AI feature-development loop  
(`/ai-spec` → `/ai-build` → `/ai-review` → `/ai-status`).

Agents must read this file before specification, implementation, or review work.  
Do not invent commands or treat missing checks as passing.

---

## Project

| Field | Value |
| --- | --- |
| **Name** | `tfl-tracker` (product name: **Where's My Bus?**) |
| **Purpose** | Monitor London bus routes with live TfL Open Data predictions, schematic loop views, stop arrivals, favourites, local service alerts, and schedule-aware bus intelligence powered by TfL iBus static data. Independent project — not affiliated with or endorsed by Transport for London. |
| **Default branch** | `main` |
| **Package manager** | npm (`package-lock.json`; CI uses `npm ci`) |
| **Node** | CI uses Node **24**. Local development: Node 22+ per README; prefer matching CI when possible. |

---

## Technology stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router), React 19 |
| Styling | Tailwind CSS 4 |
| Data fetching | TanStack React Query |
| Validation | Zod |
| Tests | Vitest + Testing Library |
| Maps | Leaflet (interactive route map) |
| Hosting | Vercel (recommended; GitHub integration) |

All TfL API calls go through Next.js API routes under `app/api/tfl/*` so `TFL_API_KEY` never reaches the browser.

**Next.js note:** This repo’s Next.js version may differ from training data. Before writing Next.js-specific code, read the relevant guide under `node_modules/next/dist/docs/` and heed deprecation notices (see `AGENTS.md`).

---

## Commands

| Purpose | Command |
| --- | --- |
| Install dependencies | `npm install` (local) / `npm ci` (CI) |
| Local development | `npm run dev` |
| Dev server URL | [http://localhost:3000](http://localhost:3000) (Next.js default) |
| Lint | `npm run lint` |
| Type-check | `npm run typecheck` |
| Automated tests | `npm test` (`vitest run`) |
| Tests (watch) | `npm run test:watch` |
| Production build | `npm run build` |
| Production server | `npm start` (after build) |

### Maintainer / iBus scripts (not required for every feature)

| Purpose | Command |
| --- | --- |
| Compare TfL vs local iBus base versions | `npm run check:ibus-base-versions` |
| Import active iBus base version | `npm run import:ibus:active` |
| Rebuild iBus manifest | `npm run rebuild:ibus-manifest` |
| Verify local iBus data | `npm run verify:ibus-local` |
| Export iBus data for external host | `npm run export:ibus-data` |
| Regenerate PWA icons | `npm run generate:icons` |

---

## Existing CI

### `.github/workflows/ci.yml` (PR + push to `main`)

Runs on `ubuntu-latest` with Node 24 and `npm ci`:

1. `npm run typecheck`
2. `npm run lint`
3. `npm test`
4. `npm run build` (with `TFL_API_KEY` from GitHub secrets)

### `.github/workflows/check-ibus-base-version.yml` (scheduled)

- Daily at 06:00 UTC (+ manual `workflow_dispatch`)
- Runs `npm run check:ibus-base-versions -- --fail-on-outdated`
- Opens/updates/closes a GitHub issue with label `ibus-base-version` when outdated
- **Not** a PR gate; do not treat it as part of PR CI green/red for feature PRs unless the change touches iBus versioning

### Checks that are unavailable / not configured

- No dedicated Prettier / format script in `package.json`
- No E2E / Playwright / Cypress suite
- No coverage gate in CI
- No `vercel.json` in repo (standard Next.js Vercel deploy)
- No user-facing authentication test suite (there is no end-user auth)

Missing required CI must **not** be treated as passing CI.

---

## Local browser testing

| Item | Detail |
| --- | --- |
| Available? | **Yes**, when Node deps are installed and `TFL_API_KEY` is set in `.env.local` |
| Start | `npm run dev` → [http://localhost:3000](http://localhost:3000) |
| Prerequisite | Copy `.env.local.example` → `.env.local` and set `TFL_API_KEY` |
| Automated browser suite | **None** — browser verification is manual / agent-driven against the dev server |
| If unavailable | Record affected journeys as **pending** (do not claim they passed). Common blockers: missing API key, deps not installed, port conflict, no browser tooling in the session |

---

## Architecture (important paths)

```
app/                    # Next.js App Router
  page.tsx              # Main single-page UI
  layout.tsx            # Root layout, PWA metadata
  api/tfl/*             # TfL proxy routes (server-side API key)
  api/vehicles/*        # Fleet enrichment / Bustimes fallback
components/             # UI (RouteCard, loop, map, settings, modals, …)
hooks/                  # React Query and UI hooks
lib/
  tfl/                  # TfL client, schemas, normalizers, apiRouter
  ibus/                 # iBus import, compact schedules, version selection
  schedulePipeline/     # Live schedule matching / ghost generation pipeline
  vehicles/             # Registration / enrichment / Bustimes helpers
  routeIntelligence.ts  # Core expanded-route pipeline
  storage.ts, displaySettings.ts, routeAlerts.ts, localRouteHistory.ts
public/data/ibus/       # Manifest + active compact static data
scripts/                # iBus import / verify / export tooling
docs/                   # Project docs (e.g. ibus-external-hosting.md)
```

Persistence model:

- **No application database.** Favourites, recents, display settings, alerts, theme, route history, and prediction-tracking state live in **browser `localStorage`**.
- **Static iBus JSON** under `public/data/ibus/` (or optional external host via `NEXT_PUBLIC_IBUS_DATA_BASE_URL`) powers fleet/running numbers and schedule matching.
- Heavy per-version folders under `public/data/ibus/[0-9]{8}/` are gitignored; the one active version must be force-added intentionally.

Authentication / secrets:

- **No end-user login.**
- Server-only `TFL_API_KEY` (`.env.local` / Vercel / GitHub Actions secrets), validated in `lib/env.ts`.
- Optional Bustimes fallback is server-side only (`/api/vehicles/fleet-fallback`).

Deployment:

- Vercel via GitHub integration (recommended).
- Env: at minimum `TFL_API_KEY`.
- Optional public env flags: `NEXT_PUBLIC_ENABLE_ADVANCED_DIAGNOSTICS`, `NEXT_PUBLIC_ENABLE_AFTER_MIDNIGHT_REPLAY`, map tile URLs, `NEXT_PUBLIC_IBUS_DATA_BASE_URL`.
- Preview deployments follow Vercel’s GitHub PR previews when the project is linked.

---

## Important user journeys (manual / browser verification)

When a feature touches these flows, verify in the browser (and on small phone widths when UI changes). Use the approved issue’s test plan first; fall back to these journeys when relevant:

1. **Search and add routes** — search by number/name; add up to 3 routes; shareable `?routes=` URLs.
2. **Expanded route card** — live arrivals refresh (~30s), schematic loop, list view, map view toggles.
3. **Schedule timing badges** — early/late/on-time when iBus schedule exists; blue/unknown when unmatched.
4. **Ghost behaviours** — schedule ghosts and feed ghosts (inferred; settings toggles).
5. **Stop detail** — stop arrivals modal; nearby stops / geolocation; `?stop=` URLs.
6. **Favourites / recents / settings** — localStorage persistence, theme, alert defaults, export history, reset defaults.
7. **Multi-route / lite mode** — collapsed cards and dashboard summary stay responsive without heavy schedule work.
8. **PWA** — installability and basic standalone behaviour when relevant.
9. **API key safety** — browser network tab must not expose `TFL_API_KEY`; clients call `/api/tfl/*` only.

---

## Protected / high-risk files and behaviours

Treat changes here as requiring human review and extra caution:

| Area | Paths / behaviour |
| --- | --- |
| Secrets / env | `.env.local`, `.env.local.example`, `lib/env.ts`, Vercel/GitHub secrets |
| TfL proxy | `app/api/tfl/**`, `lib/tfl/**` (especially key handling / routing) |
| Vehicle enrichment | `app/api/vehicles/**`, Bustimes fallback |
| iBus static data | `public/data/ibus/**`, `scripts/import*.ts`, `scripts/*Ibus*`, import env vars |
| Schedule / ghost intelligence | `lib/routeIntelligence.ts`, `lib/schedulePipeline/**`, ghost/schedule deviation modules — incorrect logic can mislead travellers |
| Caching / deploy headers | `next.config.ts` iBus cache headers |
| CI secrets | `.github/workflows/ci.yml` build step needing `TFL_API_KEY` |

Never expose, print, or commit secrets. Do not force-add large multi-version iBus trees unless the approved spec explicitly requires an intentional active-version update.

High-risk categories that always need human review: authentication, permissions, payments/billing, database migrations, deployment, secrets, security rules, infrastructure, production data access, and destructive data changes. (Several are N/A today but remain gated.)

---

## Project-specific agent instructions

1. **Read this file** and `.cursor/rules/ai-loop-governance.mdc` before spec/build/review work.
2. **One approved feature issue per branch and PR.** Acceptance criteria and non-goals are binding.
3. **Do not** make unrelated refactors, drive-by cleanups, or opportunistic iBus data refreshes.
4. Prefer existing patterns: App Router API routes, React Query hooks, Zod schemas, colocated `*.test.ts(x)`, Tailwind utilities.
5. Keep TfL credentials server-side. Prefer extending `app/api/tfl/*` rather than calling TfL from the client.
6. Schedule matching, ghost detection, and service-health heuristics are **inferred** — do not present them as official TfL operational truth in UI copy.
7. If changing iBus import/manifest behaviour, document manual verify steps (`check` / `import` / `rebuild` / `verify`) in the PR; do not treat the daily iBus workflow as PR CI.
8. A dirty working tree is a firm stop for `/ai-build` implementation. Report unrelated changes; do not stash/reset/delete them.
9. **Specification approval:** Only a human may approve a completed specification. After **explicit** human approval in the active `/ai-spec` conversation, the spec agent may create the GitHub issue and apply `agent-ready`. Never apply `agent-ready` without that explicit approval.
10. **Autonomous `/ai-build` verification:** Implement, then run every relevant command from this file. At minimum for typical app changes: `npm run typecheck`, `npm run lint`, `npm test`; also `npm run build` when the change could affect production build or env usage. Perform available browser verification against the journeys above and the issue test plan. Do not claim a check or browser test passed unless it actually ran successfully. If browser tools, credentials, test data, or the env are unavailable, record verification as **pending**.
11. **Internal review before PR:** When available, use a fresh read-only reviewer subagent against the approved contract, current diff, tests, and verification evidence. Address must-fix findings and re-verify. Allow **at most two** internal correction rounds; then stop for human review. If fresh subagents are unavailable, do not describe the builder’s own review as independent.
12. **Final `/ai-review`:** Must run in a separate fresh Cursor chat that did not implement the feature. Reviewer is read-only; reviews the exact current PR commit; never edits, pushes, merges, or enables auto-merge.
13. Stop for human input on product ambiguity and all high-risk categories above.
14. Never merge a pull request. Never enable auto-merge. Only a human may merge.
15. After two unsuccessful correction rounds (internal or final-review loop), stop and require human review (`needs-human-review` / `loop-stuck` as appropriate).

---

## Workflow labels (GitHub)

| Label | Meaning |
| --- | --- |
| `agent-ready` | Spec approved; issue is ready for `/ai-build` (applied by human or by spec agent only after explicit human approval) |
| `blocked` | Work cannot proceed until a blocker is cleared |
| `loop-changes-requested` | Reviewer requested corrections |
| `loop-approved` | Independent review approved the current PR commit |
| `needs-human-review` | Escalation: product/security/infra decision or failed correction rounds |
| `loop-stuck` | Loop cannot make progress; human must unblock |

Only a human may approve a specification or merge. Agents never merge or enable auto-merge.

---

## Removing this setup

Delete:

- `AI_LOOP.md`
- `.cursor/rules/ai-loop-governance.mdc`
- `docs/ai-loop/README.md`

Optional: remove the workflow labels from the GitHub repo. Global Cursor commands (`/ai-spec`, etc.) can remain installed; they simply will not have this project adapter.
