import { Router } from "express";
import { generateCoverLetter, streamCoverLetter } from "../geminiClient.js";
import { validateCoverLetterRequest } from "../validate.js";
import { clientGoneSignal, sendEvent, startSse } from "./sse.js";

const router = Router();

const MAX_FIELD_CHARS = 20000;
const GENERATION_TIMEOUT_MS = 120000;

/**
 * Shared preflight: body validation and provider configuration.
 * Returns the prepared { resume, jobDescription }, or answers the request
 * itself (400/503) and returns null.
 */
function preflight(req, res) {
  const { resume, jobDescription } = req.body ?? {};

  const invalidRequest = validateCoverLetterRequest(resume, jobDescription, MAX_FIELD_CHARS);
  if (invalidRequest) {
    res.status(invalidRequest.status).json(invalidRequest.body);
    return null;
  }
  if (!process.env.GEMINI_API_KEY) {
    res.status(503).json({
      error: "Gemini is not configured on this server. Set GEMINI_API_KEY in server/.env.",
    });
    return null;
  }
  return { resume: resume.trim(), jobDescription: jobDescription.trim() };
}

// Phase 1 endpoint: complete raw Markdown in one JSON response
router.post("/", async (req, res) => {
  const inputs = preflight(req, res);
  if (!inputs) return;

  try {
    const coverLetter = await generateCoverLetter(inputs);
    return res.json({ coverLetter });
  } catch (err) {
    return replyWithSafeError(res, err);
  }
});

// Phase 3 endpoint: the same generation streamed as Server-Sent Events.
// Events:  {"token": "..."} | {"retry": {attempt, delayMs}} | {"done": true} | {"error": "..."}
router.post("/stream", async (req, res) => {
  const inputs = preflight(req, res);
  if (!inputs) return;

  startSse(res);
  const signal = AbortSignal.any([
    AbortSignal.timeout(GENERATION_TIMEOUT_MS),
    clientGoneSignal(req, res),
  ]);

  await streamCoverLetter({
    ...inputs,
    signal,
    onToken: (token) => sendEvent(res, { token }),
    onRetry: (attempt, delayMs) => sendEvent(res, { retry: { attempt, delayMs } }),
  }).catch((err) => {
    // Client stopped it or vanished: nothing left to report.
    if (res.writableEnded || res.destroyed || signal.aborted) return;
    if (!err.status) console.error("Unhandled stream error:", err);
    sendEvent(res, { error: err.message ?? "Cover letter generation failed." });
    res.end();
  });

  if (!res.writableEnded && !res.destroyed) {
    sendEvent(res, { done: true });
    res.end();
  }
});

function replyWithSafeError(res, err) {
  // Errors from geminiClient are already sanitized; anything else is our bug
  // and only the fact that it happened is reported, never its text.
  if (!err.status) {
    console.error("Unhandled error in cover letter route:", err);
    return res.status(500).json({ error: "Cover letter generation failed." });
  }
  return res.status(err.status).json({ error: err.message });
}

export default router;
