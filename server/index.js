import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import coverLetterRouter from "./routes/coverLetter.js";

const app = express();

// Reject oversized payloads at the parser level (Sprint 04: request-size protection)
app.use(express.json({ limit: "32kb" }));

// Allow the Vite dev server origin, or a specific origin in production
const corsOrigin = process.env.CORS_ORIGIN?.trim() || "http://localhost:5173";
app.use(cors({ origin: corsOrigin }));

// Lightweight status endpoint so the UI can confirm the backend is reachable
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    llmConfigured: Boolean(process.env.GEMINI_API_KEY),
  });
});

app.use("/api/cover-letter", coverLetterRouter);

// Unknown /api/* paths should answer with JSON, not an HTML page
app.use("/api", (req, res) => {
  res.status(404).json({ error: `Not found: ${req.method} ${req.path}` });
});

// Production hosting: serve the built frontend from the same service.
// In development (no dist folder) Vite serves the UI instead.
const serverDir = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.join(serverDir, "../client/dist");
// express.static simply falls through when dist is absent (dev mode with Vite)
app.use(express.static(clientDist));
if (!fs.existsSync(clientDist)) {
  console.log("Note: client/dist not found, serving API only (run `npm run build` in client/ for production mode)");
}

// Keep JSON on every error path (parser failures included) and never
// leak stack traces to the client. (Express needs the 4-arg signature.)
app.use((err, req, res, next) => {
  if (err.type === "entity.too.large") {
    return res.status(413).json({ error: "Request body too large. Limit is 32 KB." });
  }
  if (err instanceof SyntaxError && "status" in err) {
    return res.status(400).json({ error: "Request body must be valid JSON." });
  }
  if (err.statusCode) {
    return res.status(err.statusCode).json({ error: err.message });
  }
  console.error(err);
  return res.status(500).json({ error: "Internal server error." });
});

export default app;

if (process.env.NODE_ENV !== "production") {
  const port = Number(process.env.PORT) || 5000;

  app.listen(port, "0.0.0.0", () => {
    console.log(`Server listening on http://localhost:${port}`);
  });
}
