/**
 * Unit tests for the Slack post-processor — pinned against the exact
 * brief Toby received on 2026-05-12 (the one that surfaced this bug)
 * plus per-transformation sanity checks.
 *
 * Uses node:test to match repo convention. Run with:
 *   npx tsx --test web/lib/agents/format/slackify.test.ts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  convertBoldItalic,
  convertMarkdownLinks,
  stripPreambleAndRules,
  linkifyAsanaGids,
  linkifyMeetingIds,
  slackifyAgentOutput,
} from './slackify.js';

const expect = (actual: unknown) => ({
  toBe: (expected: unknown) => assert.equal(actual, expected),
  toContain: (sub: string) => assert.ok(String(actual).includes(sub), `expected to contain ${sub}`),
  not: {
    toContain: (sub: string) => assert.ok(!String(actual).includes(sub), `expected NOT to contain ${sub}`),
    toMatch: (re: RegExp) => assert.ok(!re.test(String(actual)), `expected NOT to match ${re}`),
  },
  toMatch: (re: RegExp) => assert.ok(re.test(String(actual)), `expected to match ${re}`),
});

describe('convertBoldItalic', () => {
  it('converts CommonMark **bold** to Slack *bold*', () => {
    expect(convertBoldItalic('**Zen House Dental**')).toBe('*Zen House Dental*');
    expect(convertBoldItalic('a **bold word** here')).toBe('a *bold word* here');
  });
  it('leaves Slack-style single asterisks alone', () => {
    expect(convertBoldItalic('*already slack*')).toBe('*already slack*');
  });
  it('handles multiple occurrences on one line', () => {
    expect(convertBoldItalic('**A** then **B**')).toBe('*A* then *B*');
  });
});

describe('convertMarkdownLinks', () => {
  it('rewrites [label](url) to <url|label>', () => {
    expect(convertMarkdownLinks('[Asana](https://app.asana.com/x)')).toBe('<https://app.asana.com/x|Asana>');
  });
  it('leaves Slack links untouched', () => {
    const slack = '<https://app.asana.com/0/0/1|Task>';
    expect(convertMarkdownLinks(slack)).toBe(slack);
  });
});

describe('stripPreambleAndRules', () => {
  it('strips a "Here is the briefing" preamble before the *Morning,* line', () => {
    const input = `I now have everything I need. Here's Toby's briefing:\n\n---\n\n*Morning, Toby* :sun_with_face:\n\nBody`;
    const out = stripPreambleAndRules(input);
    expect(out.startsWith('*Morning,')).toBe(true);
    expect(out).not.toContain('I now have everything');
    expect(out).not.toContain('---');
  });
  it('drops standalone --- rules', () => {
    expect(stripPreambleAndRules('foo\n---\nbar')).toBe('foo\n\nbar');
  });
  it('is a no-op when the brief already starts with *Morning,*', () => {
    const input = '*Morning, Max* :sun_with_face:\n\nBody';
    expect(stripPreambleAndRules(input)).toBe(input);
  });
  it('anchors on the LAST *Morning,* when the model writes the brief multiple times', () => {
    const input = [
      '*Morning, Max* :sun_with_face:',
      '*Yesterday* — <invoke name="searchMeetings"> returned stuff',
      '',
      'Let me just write directly — I have what I need.',
      '',
      '*Morning, Max* :sun_with_face:',
      '*Yesterday* — clean final version',
    ].join('\n');
    const out = stripPreambleAndRules(input);
    expect(out.indexOf('*Morning, Max*')).toBe(0);
    // First-pass content should be gone — only the clean retry remains.
    expect(out).not.toContain('returned stuff');
    expect(out).not.toContain('Let me just write');
    expect(out).toContain('clean final version');
  });
  it('strips leaked <invoke> tool-call tags from anywhere in the body', () => {
    const input = '*Morning, Max*\n*Yesterday* — <invoke name="searchMeetings"> the data shows X';
    const out = stripPreambleAndRules(input);
    expect(out).not.toContain('<invoke');
    expect(out).toContain('the data shows X');
  });
});

describe('linkifyAsanaGids', () => {
  it('linkifies a bare gid:NNN inside backticks with a bold title after', () => {
    const input = '- `gid:1213538510904151` — **Bright Ortho Onboarding Tracker** — due 23 Mar';
    expect(linkifyAsanaGids(input)).toBe(
      '- <https://app.asana.com/0/0/1213538510904151|Bright Ortho Onboarding Tracker> — due 23 Mar',
    );
  });
  it('falls back to "Asana task" when no title is on the line', () => {
    expect(linkifyAsanaGids('chase up gid:1234567890 today')).toBe(
      'chase up <https://app.asana.com/0/0/1234567890|Asana task> today',
    );
  });
  it('handles gid without backticks', () => {
    const input = '- gid:1213538510904151 — **Bright Ortho**';
    expect(linkifyAsanaGids(input)).toBe(
      '- <https://app.asana.com/0/0/1213538510904151|Bright Ortho>',
    );
  });
});

describe('linkifyMeetingIds', () => {
  it('linkifies "meeting 145119629" to the meetings detail page', () => {
    const out = linkifyMeetingIds('Zen House mid-month review (meeting 145119629)');
    expect(out).toMatch(/<https:\/\/[^|]+\/meetings\/145119629\|meeting 145119629>/);
  });
  it('also handles "mtg" shorthand', () => {
    const out = linkifyMeetingIds('see mtg 145108653 for context');
    expect(out).toMatch(/<https:\/\/[^|]+\/meetings\/145108653\|mtg 145108653>/);
  });
});

describe('slackifyAgentOutput — end-to-end against Toby 2026-05-12 brief', () => {
  const RAW = [
    `I now have everything I need. Here's Toby's briefing:`,
    ``,
    `---`,
    ``,
    `**Morning, Toby** :sun_with_face:`,
    ``,
    `**Yesterday**`,
    `- **Zen House Dental** (meeting 145119629) — Mid-month review flagged unapproved ads/landing pages still running live.`,
    ``,
    `**Today**`,
    `- \`gid:1213838903313793\` — **PRIORITY: Ensure Google & Meta Campaigns Go Live** (Smile For Life) — was due 30 Mar, long overdue.`,
    `- \`gid:1213538510904151\` — **Bright Ortho Onboarding Tracker** — due 23 Mar, still open.`,
  ].join('\n');

  // Note: the model emitted the greeting line as **Morning** not *Morning*,
  // which means stripPreambleAndRules can't anchor on it before bold
  // conversion. The pipeline order (strip → bold) handles this correctly
  // because we now also normalise `**Morning,` to `*Morning,` in the
  // bold pass. Verify the output behaves either way.
  const result = slackifyAgentOutput(RAW);

  it('has no double-asterisks in the output', () => {
    expect(result).not.toMatch(/\*\*/);
  });
  it('has no --- rules', () => {
    expect(result).not.toMatch(/^---$/m);
  });
  it('linkifies the Asana gids', () => {
    expect(result).toContain('<https://app.asana.com/0/0/1213838903313793|PRIORITY: Ensure Google & Meta Campaigns Go Live>');
    expect(result).toContain('<https://app.asana.com/0/0/1213538510904151|Bright Ortho Onboarding Tracker>');
  });
  it('linkifies the meeting id', () => {
    expect(result).toMatch(/<https:\/\/[^|]+\/meetings\/145119629\|meeting 145119629>/);
  });
  it('drops the "I now have everything" preamble', () => {
    expect(result).not.toContain('I now have everything');
    expect(result).not.toContain(`Here's Toby's briefing`);
  });
  it('uses single-asterisk Slack bold for the greeting', () => {
    expect(result).toContain('*Morning, Toby*');
  });
});
