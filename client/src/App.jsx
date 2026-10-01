import { useEffect, useState } from "react";

const MAX_FIELD_CHARS = 20000;

export default function App() {
  const [resume, setResume] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [coverLetter, setCoverLetter] = useState("");
  const [error, setError] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [backendStatus, setBackendStatus] = useState("checking");

  useEffect(() => {
    fetch("/api/health")
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then(() => setBackendStatus("online"))
      .catch(() => setBackendStatus("offline"));
  }, []);

  async function handleGenerate() {
    setError("");
    setCoverLetter("");

    // Mirrors the server checks so obvious mistakes are caught before an API call
    if (resume.trim().length < 30) {
      setError("Please paste a more complete resume (at least 30 characters).");
      return;
    }
    if (jobDescription.trim().length < 30) {
      setError("Please paste the job description you are applying for (at least 30 characters).");
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch("/api/cover-letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resume: resume.trim(),
          jobDescription: jobDescription.trim(),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = data.details
          ? `${data.error ?? "Invalid request."} ${data.details.join(" ")}`
          : (data.error ?? `Request failed with status ${response.status}.`);
        setError(message);
        return;
      }
      setCoverLetter(data.coverLetter ?? "");
    } catch {
      setError("Could not reach the backend. Is the server running on port 5000?");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <main className="page">
      <header className="page-header">
        <h1>AI Cover Letter</h1>
        <span className={`status status-${backendStatus}`}>
          Backend {backendStatus}
        </span>
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

      <button
        type="button"
        className="generate-button"
        onClick={handleGenerate}
        disabled={isGenerating || !resume.trim() || !jobDescription.trim()}
      >
        {isGenerating ? "Generating..." : "Generate Cover Letter"}
      </button>

      {error && <p className="error">{error}</p>}

      <section className="output">
        <h2>Generated cover letter (raw Markdown)</h2>
        {coverLetter ? (
          <pre className="cover-letter">{coverLetter}</pre>
        ) : (
          <p className="hint">
            The generated cover letter will appear here as raw Markdown.
            Formatting and copy-to-clipboard arrive in Phase 2.
          </p>
        )}
      </section>
    </main>
  );
}
