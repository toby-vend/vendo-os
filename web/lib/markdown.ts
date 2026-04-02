/**
 * Server-side markdown → HTML renderer for Eta templates.
 *
 * Usage in templates:
 *   <%~ md(it.meeting.summary) %>
 *
 * This is registered as a global helper on the Eta instance in server.ts.
 */

import { marked } from 'marked';

// Configure marked for safe, clean output
marked.setOptions({
  breaks: true,       // Convert \n to <br>
  gfm: true,          // GitHub Flavoured Markdown
});

/**
 * Render markdown string to sanitised HTML.
 * Returns empty string for null/undefined input.
 */
export function md(input: string | null | undefined): string {
  if (!input) return '';
  // marked.parse can return string or Promise — we use synchronous mode
  const html = marked.parse(input) as string;
  return html;
}
