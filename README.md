# Fieldnote Farm Planner

A farm planning dashboard for plot assignments, planting schedules, and harvest records. Built with Next.js App Router and TypeScript.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The first request seeds `data/farm-data.json`; subsequent changes are saved to that file and survive server restarts.

## AI assistant

The assistant uses a local Ollama server. Install Ollama, pull a chat model, and start Ollama before asking the assistant a question:

```bash
ollama pull qwen2.5:1.5b
npm run dev
```

The default model is `qwen2.5:1.5b`. Set `OLLAMA_MODEL` to use another installed model, or `OLLAMA_BASE_URL` if Ollama is not listening at `http://127.0.0.1:11434`. The app sends relevant plot, active planting, and recent harvest data only when a question is submitted. Chat history stays in the browser and is not written to the farm data file.

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
