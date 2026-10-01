import { useEffect, useMemo, useRef, useState } from "react";
import { parseSseEvents } from "./sseParser.js";
import { renderMarkdownToSafeHtml } from "./markdown.js";

const MAX_FIELD_CHARS = 20000;

export default function App() {
  const [resume, setResume] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [coverLetter, setCoverLetter] = useState("");
  const [error, setError] = useState("");
  const [retryInfo, setRetryInfo] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copyState, setCopyState] = useState("idle"); // idle | copied | failed
  const abortControllerRef = useRef(null);

  // Stop an in-flight stream if the component goes away
  useEffect(() => () => abortControllerRef.current?.abort(), []);

  // Reset the "Copied!" badge after a moment
  useEffect(() => {
    if (copyState !== "copied") return;
    const t = setTimeout(() => setCopyState("idle"), 2000);
    return () => clearTimeout(t);
  }, [copyState]);

  async function handleGenerate() {
    if (isGenerating) return; // one generation at a time
    setError("");
    setRetryInfo(null);
    setCoverLetter("");
    setCopyState("idle");

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
    let streamOpened = false;

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
      streamOpened = true;

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
        setError(
          streamOpened
            ? "The stream was interrupted before the letter finished."
            : "Could not reach the backend. Is the server running on port 5000?"
        );
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

  async function handleCopy() {
    try {
      // The clipboard gets the raw Markdown, not the rendered HTML
      await navigator.clipboard.writeText(coverLetter);
      setCopyState("copied");
    } catch {
      // Happens without permission or in a non-secure context
      setCopyState("failed");
    }
  }

  // Memoized so re-renders during typing/scrolling do not re-parse the Markdown
  const letterHtml = useMemo(() => renderMarkdownToSafeHtml(coverLetter), [coverLetter]);

  return (
    <main className="page">
      <header className="page-header">
        <div className="brand">
          <h1>
            AI Cover Letter <span className="brand-accent">Generator</span>
          </h1>
          <p className="subtitle">
            Paste your resume and the job description — the cover letter streams in below.
          </p>
        </div>
        <div className="badges">
          <span className="badge">
            <span className="badge-dot badge-dot-blue" />
            devloped by Pratyush shukla
            
          </span>
          <span className="badge">
            <span className="badge-dot badge-dot-green" />
            Secure &amp; Private
          </span>
          <span className="badge">
            <span className="badge-dot badge-dot-purple" />
            Professional · ATS-friendly
          </span>
        </div>
      </header>

      <section className="inputs">
        <label className="field field-resume">
          <span className="field-head">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <path d="M14 2v6h6" />
            </svg>
            Your resume
          </span>
          <textarea
            value={resume}
            onChange={(event) => setResume(event.target.value)}
            maxLength={MAX_FIELD_CHARS}
            placeholder="Paste your resume text here..."
            rows={14}
          />
        </label>

        <label className="field field-jd">
          <span className="field-head">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="2" y="7" width="20" height="14" rx="2" />
              <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
            </svg>
            Target job description
          </span>
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
      {copyState === "failed" && (
        <p className="error">Copy failed — clipboard access was blocked by the browser.</p>
      )}

      <section className="output">
        <div className="output-head">
          <h2>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4z" />
            </svg>
            Generated Cover Letter
          </h2>
          {coverLetter && !isGenerating && (
            <button type="button" className="copy-button" onClick={handleCopy}>
              {copyState === "copied" ? "Copied!" : copyState === "failed" ? "Copy failed" : "Copy to Clipboard"}
            </button>
          )}
        </div>
        {coverLetter ? (
          // Safe: letterHtml is Markdown run through marked + DOMPurify; this is
          // React's standard escape hatch for sanitizer-approved HTML.
          <div
            className="cover-letter cover-letter-rendered"
            aria-live="polite"
            dangerouslySetInnerHTML={{ __html: letterHtml }}
          />
        ) : (
          <p className="hint">
            The cover letter streams in here word by word as the model writes it,
            rendered from its Markdown.
          </p>
        )}
      </section>
    </main>
  );
}
