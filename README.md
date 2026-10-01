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

`GET /api/health` → `{ "status": "ok", "llmConfigured": <bool> }`

## Sprint 04 phases

- [x] Phase 1 — OpenAI SDK integration, strict system prompt (forced Markdown
      structure, resume-only facts, no invented content), secure server-side POST
- [ ] Phase 2 — Markdown parsing → HTML rendering, Clipboard API copy
- [ ] Phase 3 — HTTP 429 handling, exponential backoff, streamed progressive rendering

## Test notes

Integration testing of the full request pipeline (auth header, payload shape,
response parsing, error mapping) was done against a local mock endpoint via the
optional `OPENAI_BASE_URL` override, because no paid API key is available in the
dev sandbox. Unset `OPENAI_BASE_URL` and the official SDK talks to `api.openai.com`
directly. The project contains no fake AI responses.
