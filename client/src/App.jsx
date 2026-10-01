import { useEffect, useRef, useState } from "react";
import { parseSseEvents } from "./sseParser.js";

const MAX_FIELD_CHARS = 20000;

export default function App() {
  const [resume, setResume] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [coverLetter, setCoverLetter] = useState("");
  const [error, setError] = useState("");
  const [retryInfo, setRetryInfo] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const abortControllerRef = useRef(null);

  // Stop an in-flight stream if the component goes away
  useEffect(() => () => abortControllerRef.current?.abort(), []);

  async function handleGenerate() {
    if (isGenerating) return; // one generation at a time
    setError("");
    setRetryInfo(null);
    setCoverLetter("");

    // Mirrors the server checks so obvious mistakes never reach the provider
    if (resume.trim().length < 30) {
      setError("Please paste a more complete resume (at least 30 characters).");
      return;
    }
    if (jobDescription.trim().length < 30) {
      setError("Please paste the job description you are applying for (at least 30 characters).");
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsGenerating(true);

    try {
      const response = await fetch("/api/cover-letter/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resume: resume.trim(), jobDescription: jobDescription.trim() }),
        signal: controller.signal,
      });

      // Errors raised before streaming starts arrive as plain JSON
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError(data.error ?? `Request failed with status ${response.status}.`);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const { events, rest } = parseSseEvents(buffer);
        buffer = rest;

        for (const event of events) {
          if (event.token !== undefined) {
            setCoverLetter((current) => current + event.token);
          } else if (event.retry) {
            setRetryInfo(event.retry);
          } else if (event.error) {
            setError(event.error);
          }
        }
      }
    } catch (err) {
      if (err.name !== "AbortError") {
        setError("Could not reach the backend. Is the server running on port 5000?");
      }
    } finally {
      setIsGenerating(false);
      setRetryInfo(null);
      abortControllerRef.current = null;
    }
  }

  function handleStop() {
    abortControllerRef.current?.abort();
  }

  return (
    <main className="page">
      <header className="page-header">
        <h1>AI Cover Letter</h1>
      </header>

      <section className="inputs">
        <label className="field">
          <span>Your resume</span>
          <textarea
            value={resume}
            onChange={(event) => setResume(event.target.value)}
            maxLength={MAX_FIELD_CHARS}
            placeholder="Paste your resume text here..."
            rows={14}
          />
        </label>

        <label className="field">
          <span>Target job description</span>
          <textarea
            value={jobDescription}
            onChange={(event) => setJobDescription(event.target.value)}
            maxLength={MAX_FIELD_CHARS}
            placeholder="Paste the job description you are applying for..."
            rows={14}
          />
        </label>
      </section>

      <div className="actions">
        <button
          type="button"
          className="generate-button"
          onClick={handleGenerate}
          disabled={isGenerating}
        >
          {isGenerating ? "Generating..." : "Generate Cover Letter"}
        </button>
        {isGenerating && (
          <button type="button" className="stop-button" onClick={handleStop}>
            Stop
          </button>
        )}
      </div>

      {isGenerating && !coverLetter && (
        <p className="status-line">
          {retryInfo
            ? `Provider is rate limiting. Retrying in ${Math.ceil(retryInfo.delayMs / 1000)}s (attempt ${retryInfo.attempt})...`
            : "Waiting for the model to start answering..."}
        </p>
      )}

      {error && <p className="error">{error}</p>}

      <section className="output">
        <h2>Generated cover letter (raw Markdown)</h2>
        {coverLetter ? (
          <pre className="cover-letter" aria-live="polite">{coverLetter}</pre>
        ) : (
          <p className="hint">
            The cover letter streams in here word by word as the model writes it,
            as raw Markdown. Formatting and copy-to-clipboard arrive in Phase 2.
          </p>
        )}
      </section>
    </main>
  );
}
