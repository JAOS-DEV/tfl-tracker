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

## Deploy to Vercel

1. Push this repository to GitHub.
2. Import the project in [Vercel](https://vercel.com/new).
3. In Vercel Project Settings → Environment Variables, add:
   - `TFL_API_KEY` — your TfL Open Data API key
4. Deploy.

Vercel runs the Next.js app and the API routes in `app/api/tfl/*`. The browser calls relative paths like `/api/tfl/line-arrivals`; the TfL API key stays server-side and is never sent to the client.

No extra `vercel.json` is required — Vercel’s Next.js defaults are sufficient.

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
