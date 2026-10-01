# AI Cover Letter — Sprint 04 foundation

React + JavaScript (Vite) frontend, Node.js + Express backend.
MongoDB is intentionally not used: the Sprint 04 directive requires no persistent storage.

## Structure

```
ai-cover-letter/
├── client/          # React + Vite UI (resume input, job description input, generate button, output area)
└── server/          # Express API (validation, request-size limit, env support)
```

## Run locally

Two terminals:

```bash
# Terminal 1 — backend (http://localhost:5000)
cd server
npm install
npm run dev

# Terminal 2 — frontend (http://localhost:5173, proxies /api to the backend)
cd client
npm install
npm run dev
```

Before the first run, copy `server/.env.example` to `server/.env`.

## API

`POST /api/cover-letter` with JSON body:

```json
{ "resume": "...", "jobDescription": "..." }
```

Current behaviour (pre-Phase 1):

- Invalid input → `400` with `details` (missing, non-string, empty/whitespace, too short/long fields)
- Oversized payloads (>32 kb) are rejected by the JSON parser
- Valid input → `503` while no `OPENAI_API_KEY` is set / `501` once set, because the
  LLM provider integration (Sprint 04 Phase 1) has not been implemented yet.
  The server never returns fake cover letters.

`GET /api/health` → `{ "status": "ok", "llmConfigured": false }`

## Status of the Sprint 04 phases

- Phase 1 (LLM provider, strict system prompt, secure POST): next prompt
- Phase 2 (Markdown → HTML, Clipboard copy): not started, by design
- Phase 3 (429 handling, exponential backoff, streaming): not started, by design
