# MW Recruitment Platform

A single-page dashboard for Market Wave recruiters and administrators. The interface is backed by lightweight serverless APIs so it can be deployed as a full stack application on Vercel without managing dedicated infrastructure.

## Project structure

- `index.html` – application shell and layout markup.
- `styles.css` – global styling, theming, and layout rules.
- `scripts/app.js` – client-side logic that talks to the API routes and renders dashboard widgets.
- `api/` – Vercel-compatible serverless functions providing the backend.
- `lib/` – shared utilities used by the serverless routes (data store + request parsing).
- `data/seed.json` – bootstrap dataset that seeds the runtime datastore on first request.

## Running locally

1. Install [Node.js 18+](https://nodejs.org) and the [Vercel CLI](https://vercel.com/docs/cli) (`npm i -g vercel`).
2. From the repository root run `vercel dev` to start the local serverless runtime.
3. Open [http://localhost:3000](http://localhost:3000) to use the dashboard.

> The CLI stores API data in `/tmp/mw-recruitment-data.json` by default. Provide a `DATA_STORE_PATH` environment variable to use a custom location while developing (`DATA_STORE_PATH=./.data/mw.json vercel dev`).

## Deploying to Vercel

1. Authenticate the CLI (`vercel login`) and initialise the project (`vercel`).
2. Push the repository to a git host (GitHub/GitLab/Bitbucket) and connect it to Vercel, or deploy directly with `vercel --prod`.
3. Vercel will detect the `api/` directory, build the static assets, and expose the serverless routes automatically.

## API overview

- `GET /api/state` – returns the full dashboard dataset (candidates, recruiters, interviews, baseline metrics).
- `PATCH /api/candidates` – updates a candidate's assignment, stage, notes or CV metadata.
- `GET /api/candidates` – list all candidates (primarily for debugging/integration).
- `POST /api/interviews` – schedules an interview and automatically moves the candidate to "Interview Scheduled".
- `GET /api/interviews` – returns interview entries for inspection/testing.
- `POST /api/recruiters` – adds a recruiter to the roster.
- `DELETE /api/recruiters` – removes a recruiter and unassigns their candidates.

All endpoints return JSON and disable caching so client interactions are immediately reflected in the UI. The datastore is in-memory with optional persistence to a JSON file for local development.

## Notes

- If the API is unavailable the front-end falls back to `data/seed.json` in read-only mode and surfaces a warning toast.
- The dashboard retains the existing light/dark theming toggle and CSV export features.
- For production deployments consider replacing the JSON datastore with a managed database or Vercel KV/Blob for persistence beyond the lifetime of a single serverless instance.
