# AI Cover Letter — Sprint 04 (complete)

React + JavaScript (Vite) frontend, Node.js + Express backend, Google Gemini via the
official @google/genai SDK on the server only. No database: the Sprint 04 directive
requires no persistent storage, so MongoDB is intentionally absent.

## Structure

```
ai-cover-letter/
├── client/
│   ├── vite.config.js         # dev proxy: /api -> :5000
│   └── src/
│       ├── main.jsx
│       ├── App.jsx            # inputs, generate/stop/copy buttons, streaming render
│       ├── sseParser.js       # buffers incomplete SSE events across chunks
│       ├── markdown.js        # marked + DOMPurify -> safe HTML
│       └── styles.css
└── server/
    ├── index.js               # express app, CORS, 32kb limit, health, static dist
    ├── geminiClient.js        # SDK client, strict system prompt, backoff, streaming
    ├── validate.js            # input validation
    ├── routes/
    │   ├── coverLetter.js     # POST /api/cover-letter (+ /stream)
    │   └── sse.js             # tiny SSE helpers
    └── .env.example           # -> copy to .env (git-ignored)
```

## Run (development)

```bash
cd server && npm install && cp .env.example .env   # put your Gemini key in .env
npm run dev                                          # API on :5000

cd client && npm install && npm run dev              # UI on :5173
```

## Run (production, single service)

```bash
cd client && npm run build      # emits client/dist
cd ../server && npm start       # Express serves dist + the API on :PORT
```

The server serves `client/dist` automatically when it exists — one deployable
service. Set `CORS_ORIGIN` only if the frontend is hosted on a different origin.

Provider: Google Gemini, model `GEMINI_MODEL` (default `gemini-2.5-flash`, free-tier supported).

## API

`POST /api/cover-letter` — JSON body `{ "resume": "...", "jobDescription": "..." }`

| Result | Status |
| --- | --- |
| Valid request + key configured | `200 { "coverLetter": "<raw Markdown>" }` |
| Missing / wrong-type / empty / too short/long fields | `400` with `details` |
| Payload over 32 KB | `413` |
| `GEMINI_API_KEY` not set on server | `503` |
| Gemini auth / rate-limit / server / network error | `401`, `429` or `502`, safe message only (provider detail stays in server logs) |

`POST /api/cover-letter/stream` — same body/validation, delivers Server-Sent
Events while the model writes:

```
data: {"token":"..."}                      # one per model delta
data: {"retry":{"attempt":1,"delayMs":1000}}  # transient failure backing off
data: {"error":"..."} | data: {"done":true}
```

Read it with `fetch` + `response.body.getReader()` (EventSource cannot POST).
`GET /api/health` → `{ "status": "ok", "llmConfigured": <bool> }`

## Retry policy

429 / 5xx / network errors: exponential backoff 1s → 2s → 4s (cap 10s),
honoring a sane `Retry-After`, max 3 retries, never after partial output has been
streamed. 401/403 and invalid input are never retried.

## Security notes

- The Gemini key lives only in `server/.env` (git-ignored); the client bundle
  contains no key and no provider SDK.
- Model output is untrusted: raw Markdown is parsed with `marked` and always
  sanitized with `DOMPurify` before being rendered.
- Resume/job description are passed as delimited DATA in the user message; the
  system prompt explicitly refuses instructions found inside them.

## Sprint 04 status

- [x] Phase 1 — LLM SDK (@google/genai), strict system prompt, predictable Markdown, server-side POST
- [x] Phase 2 — Markdown parsed to sanitized HTML; one-click copy via `navigator.clipboard`
- [x] Phase 3 — 429 exponential backoff (bounded); real SSE streaming, no spinners

## Test notes (dev sandbox)

No paid API key exists in this sandbox. Full pipeline behavior (payload shape,
stream chunking, 429/backoff, error mapping) was verified against a local mock
speaking the real Gemini REST/SSE wire format; a real HTTPS request to
generativelanguage.googleapis.com was also made and correctly mapped its live
key-rejection response. UI, XSS and clipboard
states were verified end-to-end in headless Chromium.

## Deployment / hosting

Code is version-controlled in git. To complete the SUBMISSION checklist the repo
must be pushed to a remote and deployed — create a GitHub repo, then
`git remote add origin <url> && git push -u origin main`, and deploy `server`
(Railway/Render: start command `npm start`, build command `npm install`; add
`client` build `cd client && npm run build` before start; set `GEMINI_API_KEY`
in the host's environment). The sandbox used for development had no hosting
credentials, so this step remains for the account holder.
