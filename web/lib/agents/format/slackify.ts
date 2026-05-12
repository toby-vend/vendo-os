/**
 * Slackify — post-processor that turns agent-generated markdown into
 * Slack-flavoured mrkdwn so chat.postMessage renders it correctly.
 *
 * Why this exists: the agent's system prompt already asks for Slack
 * mrkdwn, but LLMs drift back to CommonMark (`**bold**`, `[label](url)`,
 * `---` rules, narration like "Here's the briefing:"). This is the
 * safety net — applied once on the way out so the user never sees raw
 * markdown in Slack.
 *
 * Conversions:
 *   `**bold**`           → `*bold*`
 *   `[label](url)`       → `<url|label>`
 *   `---` (own line)     → removed
 *   leading narration    → stripped (everything before `*Morning,` line)
 *   `gid:NNN`            → `<https://app.asana.com/0/0/NNN|Asana task>`
 *                          (with title context if available on same line)
 *   `meeting NNN`/`mtg…` → `<APP_URL/meetings/NNN|meeting NNN>`
 *
 * `slackifyAgentOutput()` runs all of these in sequence. Each helper is
 * exported individually so unit tests can pin the behaviour of each
 * transformation.
 */

const APP_URL = process.env.APP_URL
  || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://vendo-os.vercel.app');

// ───────────────────────────────────────────────────────────────────────
// Bold + italics: convert CommonMark double markers to Slack singles.
// We deliberately don't touch single-asterisk runs because those are
// already valid Slack bold. Pattern is non-greedy and requires the
// content not to span newlines.
// ───────────────────────────────────────────────────────────────────────

export function convertBoldItalic(text: string): string {
  // `**bold**` → `*bold*`. Tempered-greedy body: any char that isn't a
  // newline AND isn't the start of another `**` — that way pairs on the
  // same line don't collapse into one span.
  return text.replace(/\*\*((?:(?!\*\*)[^\n])+?)\*\*/g, '*$1*');
}

// ───────────────────────────────────────────────────────────────────────
// Markdown links: `[label](url)` → `<url|label>`.
// Bare `<https://…|label>` already in the text is left untouched.
// ───────────────────────────────────────────────────────────────────────

export function convertMarkdownLinks(text: string): string {
  return text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<$2|$1>');
}

// ───────────────────────────────────────────────────────────────────────
// Strip standalone `---` / `***` rules and trim a known preamble such as
// "Here's the briefing:" or "I now have everything I need.". The brief
// is expected to start with `*Morning,` — if found, everything before it
// is dropped.
// ───────────────────────────────────────────────────────────────────────

export function stripPreambleAndRules(text: string): string {
  // Remove horizontal rule lines (--- or *** or ___, optional whitespace).
  let out = text.replace(/^[ \t]*(?:-{3,}|\*{3,}|_{3,})[ \t]*$/gm, '');

  // Strip stray `<invoke name="...">` / `</invoke>` tool-call tags the
  // model sometimes leaks into prose when it confuses tool invocation
  // with its own output. Same for `<tool_use>` / `<thinking>` fragments.
  out = out.replace(/<\/?(?:invoke|tool_use|thinking)\b[^>]*>/gi, '');

  // Anchor on the LAST `*Morning,` (or `**Morning,`) occurrence — when
  // the model retries (writes the brief multiple times), the clean
  // final version is the trailing one. Tolerate `>` blockquote prefix.
  const anchor = /(?:^|\n)([ \t>]*\*+Morning[, ])/g;
  let lastMatch: RegExpExecArray | null = null;
  let m: RegExpExecArray | null;
  while ((m = anchor.exec(out)) !== null) lastMatch = m;
  if (lastMatch && lastMatch.index !== undefined) {
    out = out.slice(lastMatch.index + (lastMatch[0].startsWith('\n') ? 1 : 0));
  }

  // Collapse 3+ blank lines down to 2.
  return out.replace(/\n{3,}/g, '\n\n').trimStart();
}

// ───────────────────────────────────────────────────────────────────────
// Asana task GIDs.
//
// Three input shapes we see in practice:
//   `gid:1213538510904151` — *Bright Ortho Onboarding Tracker* (overdue)
//   gid:1213538510904151 — **Bright Ortho Onboarding Tracker** (overdue)
//   `gid:1213538510904151` standalone, no title nearby
//
// Output: `<https://app.asana.com/0/0/NNN|Title>` when we can grab a
// title from the same bullet, otherwise `<URL|Asana task>` as fallback.
// ───────────────────────────────────────────────────────────────────────

const ASANA_GID_RE = /`?gid:(\d{10,})`?(\s*[—\-:]+\s*\*+([^*\n][^\n]*?)\*+)?/g;

export function linkifyAsanaGids(text: string): string {
  return text.replace(ASANA_GID_RE, (_match, gid: string, _afterTitle: string | undefined, title: string | undefined) => {
    const url = `https://app.asana.com/0/0/${gid}`;
    if (title?.trim()) {
      const cleanTitle = title.trim().replace(/\|/g, '/'); // pipe is the link delimiter
      return `<${url}|${cleanTitle}>`;
    }
    return `<${url}|Asana task>`;
  });
}

// ───────────────────────────────────────────────────────────────────────
// Meeting IDs.
//
// Input shapes:
//   meeting 145119629
//   mtg 145119629
//   (meeting 145119629)
//   `meeting 145119629`
//
// We preserve any parenthesis / backticks around the match by only
// linking the inner `meeting NNN` token. The link points at the Vendo OS
// meeting detail page.
// ───────────────────────────────────────────────────────────────────────

const MEETING_RE = /\b(meeting|mtg)\s+(\d{6,})\b/gi;

export function linkifyMeetingIds(text: string): string {
  return text.replace(MEETING_RE, (_match, word: string, id: string) => {
    const url = `${APP_URL}/meetings/${id}`;
    return `<${url}|${word} ${id}>`;
  });
}

// ───────────────────────────────────────────────────────────────────────
// Full pipeline.
// ───────────────────────────────────────────────────────────────────────

export function slackifyAgentOutput(raw: string): string {
  let out = raw;
  out = stripPreambleAndRules(out);
  out = convertBoldItalic(out);
  out = convertMarkdownLinks(out);
  // Linkify Asana first because the GID regex consumes the surrounding
  // title; meeting linkification then operates on the remainder.
  out = linkifyAsanaGids(out);
  out = linkifyMeetingIds(out);
  return out.trim();
}
