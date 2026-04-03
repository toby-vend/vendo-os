/**
 * Server-side markdown → HTML renderer for Eta templates.
 *
 * Usage in templates:
 *   <%~ md(it.meeting.summary) %>
 *
 * This is registered as a global helper on the Eta instance in server.ts.
 */

import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

// Configure marked for safe, clean output
marked.setOptions({
  breaks: true,       // Convert \n to <br>
  gfm: true,          // GitHub Flavoured Markdown
});

// Allowlist for sanitise-html — permits standard Markdown output, strips scripts
const SANITIZE_OPTS: sanitizeHtml.IOptions = {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'mark', 'del', 'ins']),
  allowedAttributes: {
    ...sanitizeHtml.defaults.allowedAttributes,
    img: ['src', 'alt', 'title', 'width', 'height'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
};

/**
 * Render markdown string to sanitised HTML.
 * Returns empty string for null/undefined input.
 */
export function md(input: string | null | undefined): string {
  if (!input) return '';
  const html = marked.parse(input) as string;
  return sanitizeHtml(html, SANITIZE_OPTS);
}

/**
 * Sanitise pre-rendered HTML (e.g. FTS snippets with <mark> tags).
 */
export function sanitiseHtml(input: string): string {
  return sanitizeHtml(input, SANITIZE_OPTS);
}
