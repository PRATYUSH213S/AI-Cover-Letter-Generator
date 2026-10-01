import DOMPurify from "dompurify";
import { marked } from "marked";

/**
 * Sprint 04 Phase 2: convert the model's raw Markdown into clean HTML.
 * marked only parses; DOMPurify is what makes the result safe, because the
 * Markdown is untrusted LLM output and may itself embed raw HTML or XSS attempts.
 */
export function renderMarkdownToSafeHtml(rawMarkdown) {
  if (!rawMarkdown) return "";
  const html = marked.parse(rawMarkdown, { async: false, gfm: true });
  // Default DOMPurify policy already drops <script>, event handler attributes
  // and javascript: URLs, which is exactly what we need here.
  return DOMPurify.sanitize(html);
}
