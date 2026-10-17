# Fieldnote Farm Planner

A farm planning dashboard for plot assignments, planting schedules, and harvest records. Built with Next.js App Router and TypeScript.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The first request seeds `data/farm-data.json`; subsequent changes are saved to that file and survive server restarts.

## Deploy

The app can be deployed to Vercel with Neon PostgreSQL and Gemini:

1. Import `dhrroemer/fieldnote` into Vercel.
2. Create a Neon database and add its connection string as `DATABASE_URL` in Vercel.
3. Add `OWNER_PASSWORD`, `SESSION_SECRET`, and `GEMINI_API_KEY` as encrypted Vercel environment variables. Optionally set `GEMINI_MODEL`.
4. Deploy. Public visitors can view records; editing requires the owner password.

Generate `SESSION_SECRET` locally with a password generator or a cryptographically secure random generator. Never commit real values or share them in chat.

For local development, records remain in `data/farm-data.json` and editing is enabled without owner secrets. To copy that file into an empty Neon database, put `DATABASE_URL` in an ignored `.env.local` file and run `npm run migrate:data`. The migration refuses to overwrite existing cloud data unless `--overwrite` is passed directly to the script.

The AI assistant sends relevant plot, active planting, and recent harvest data to Gemini only when a question is submitted. Chat history stays in the browser. Set `GEMINI_API_KEY` to enable online answers. Ollama can still be used for local-only experimentation by changing the assistant route.

## API

- `GET /api/farm` returns plots, plantings, and harvests.
- `POST /api/plots` adds a plot. Requires `name`, positive `area`, and `soil`.
- `POST /api/plantings` schedules a crop. Requires `plotId`, `crop`, `variety`, `plantedOn`, and `expectedHarvest`. A plot can have one unharvested crop at a time.
- `POST /api/harvests` records a yield. Requires `plantingId`, positive `quantity`, `unit`, and `harvestedOn`; `notes` is optional. Saving a harvest marks its planting complete.

The JSON store is intended for a local, single-process deployment. Use a shared database before running multiple server instances or deploying to ephemeral/serverless hosting.

## Checks

```bash
npm run lint
npm run build
```
