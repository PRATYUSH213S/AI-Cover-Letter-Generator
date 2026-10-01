import { Router } from "express";
import { generateCoverLetter } from "../openaiClient.js";
import { validateCoverLetterRequest } from "../validate.js";

const router = Router();

const MAX_FIELD_CHARS = 20000;

router.post("/", async (req, res) => {
  const { resume, jobDescription } = req.body ?? {};

  const invalidRequest = validateCoverLetterRequest(resume, jobDescription, MAX_FIELD_CHARS);
  if (invalidRequest) {
    return res.status(invalidRequest.status).json(invalidRequest.body);
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({
      error: "OpenAI is not configured on this server. Set OPENAI_API_KEY in server/.env.",
    });
  }

  try {
    const coverLetter = await generateCoverLetter({
      resume: resume.trim(),
      jobDescription: jobDescription.trim(),
    });
    return res.json({ coverLetter });
  } catch (err) {
    // err from generateCoverLetter is already sanitized; anything else is a
    // real bug on our side and only its existence is logged, never its text.
    if (err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error("Unhandled error in cover letter route:", err);
    return res.status(500).json({ error: "Cover letter generation failed." });
  }
});

export default router;
