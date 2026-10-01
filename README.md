# AI Cover Letter — Sprint 04

React + JavaScript (Vite) frontend, Node.js + Express backend, OpenAI via the official
Node.js SDK on the server only. MongoDB is intentionally not used: the Sprint 04
directive requires no persistent storage.

## Structure

```
ai-cover-letter/
├── client/          # UI: resume input, job description input, generate button, raw-Markdown output
└── server/
    ├── index.js             # express app, CORS, 32kb limit, /api/health, JSON error handling
    ├── routes/coverLetter.js# POST /api/cover-letter
    ├── validate.js          # input validation
    └── openaiClient.js      # OpenAI SDK client + strict system prompt (Phase 1)
```

## Run locally

```bash
# Terminal 1 — backend (http://localhost:5000)
cd server && npm install
cp .env.example .env   # then paste your OpenAI key into .env
npm run dev

# Terminal 2 — frontend (http://localhost:5173, proxies /api to the backend)
cd client && npm install
npm run dev
```

The OpenAI key lives only in `server/.env` (git-ignored). React never sees it; all LLM
traffic goes through the Express backend.

## API

`POST /api/cover-letter` — JSON body `{ "resume": "...", "jobDescription": "..." }`

| Result | Status |
| --- | --- |
| Valid request + key configured | `200 { "coverLetter": "<raw Markdown>" }` |
| Missing / wrong-type / empty / too short/long fields | `400` with `details` |
| Payload over 32 KB | `413` |
| `OPENAI_API_KEY` not set on server | `503` |
| OpenAI auth error / rate limit / server error / unreachable | `401`, `429` or `502` with a safe message (provider details stay in server logs only) |

`POST /api/cover-letter/stream` — same body and validation, but the generation is
delivered as Server-Sent Events while the model writes it:

```
data: {"token":"# Cover Letter\n\n"}   # one per model delta
data: {"retry":{"attempt":1,"delayMs":1000}}   # transient failure being backed off
data: {"error":"..."}                 # safe message, stream then closes
data: {"done":true}
```

The client reads it with `fetch` + `response.body.getReader()` (EventSource cannot
POST). `GET /api/health` → `{ "status": "ok", "llmConfigured": <bool> }`

## Retry policy (Phase 3)

- 429, 5xx and network errors retry with exponential backoff: 1s, 2s, 4s,
  max 3 retries, honoring a sane `Retry-After` header when the provider sends one.
- Never retried: invalid input (rejected with 400 before any provider call),
  401/403 credential/config problems.
- After exhaustion the browser gets one safe message; the full error stays server-side.
- Once any token has been streamed the connection is never retried mid-letter;
  the error is reported instead. The Stop button (AbortController) cancels cleanly.

## Sprint 04 phases

- [x] Phase 1 — OpenAI SDK integration, strict system prompt (forced Markdown
      structure, resume-only facts, no invented content), secure server-side POST
- [ ] Phase 2 — Markdown parsing → HTML rendering, Clipboard API copy
- [x] Phase 3 — 429 exponential backoff with bounded retries, SSE streaming with
      progressive word-by-word rendering in React

## Test notes

Integration testing of the full request pipeline (auth header, payload shape,
response parsing, error mapping) was done against a local mock endpoint via the
optional `OPENAI_BASE_URL` override, because no paid API key is available in the
dev sandbox. Unset `OPENAI_BASE_URL` and the official SDK talks to `api.openai.com`
directly. The project contains no fake AI responses.
