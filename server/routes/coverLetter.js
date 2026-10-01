import { Router } from "express";
import { validateCoverLetterRequest } from "../validate.js";

const router = Router();

const MAX_FIELD_CHARS = 20000;

router.post("/", (req, res) => {
  const { resume, jobDescription } = req.body ?? {};

  const invalidRequest = validateCoverLetterRequest(resume, jobDescription, MAX_FIELD_CHARS);
  if (invalidRequest) {
    return res.status(invalidRequest.status).json(invalidRequest.body);
  }

  // LLM provider integration (OpenAI/Gemini) is Phase 1 of Sprint 04 and is
  // deliberately not implemented yet. No fake or placeholder responses.
  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({
      error:
        "LLM provider is not configured yet. Set OPENAI_API_KEY in server/.env. " +
        "Generation will be enabled with the Phase 1 provider integration.",
    });
  }

  return res.status(501).json({
    error: "LLM provider integration is not implemented yet (Sprint 04 Phase 1).",
  });
});

export default router;
