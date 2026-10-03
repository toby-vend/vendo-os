/**
 * Frame.io folder audit — checks a project's folder tree against the
 * "Video Editor Asset Naming, Filing & Version Control" SOP (v1.2).
 *
 * Pure functions over the `frameio_assets` mirror: no API calls, no writes.
 * Report-only by design — renaming or moving assets in Frame.io can break
 * Meta Ads Manager name parity, so every fix is a suggestion for a human.
 *
 * Tree shape enforced (one Frame.io project per client, confirmed by Toby 3 Oct 2026):
 *   root
 *   ├── _Admin                                    (or inside each shoot folder)
 *   └── [Month Day 20YY] | Paid Ads & Organic Content     one folder per shoot day
 *       ├── Raw Footage
 *       ├── Social Ads > Treatments > [Treatment] > [Persona | Angle | Offer] > exports
 *       ├── Testimonials > Treatments > [Treatment] > exports
 *       ├── VSLs > Treatments > [Treatment] > exports
 *       ├── Walkthroughs > exports
 *       └── Organic / Team (optional)
 *
 * Full rules apply only to shoot folders dated on or after SOP_FROM. Older
 * (legacy) content only gets the basic checks: informal / duplicate markers
 * and loose files at the project root.
 */

export interface AuditNode {
  id: string;
  parent_id: string | null;
  type: string; // 'project' | 'folder' | 'file' | 'version_stack'
  name: string;
  view_url?: string | null;
}

export type Severity = 'error' | 'warning';

export interface AuditIssue {
  severity: Severity;
  rule: string;
  assetId: string;
  name: string;
  path: string;
  message: string;
  suggestion?: string;
  viewUrl?: string | null;
}

export const RATIOS = ['9x16', '4x5', '1x1', '16x9'] as const;
export const STATUSES = ['Working', 'Internal', 'Client Review', 'Final'] as const;
const ASSET_KINDS = ['Static', 'Thumb'];

/** Shoots dated on or after this get the full SOP rules (SOP v1.2 is dated 29 Sept 2026). */
export const SOP_FROM = '2026-10-01';

/** Sections allowed inside a shoot folder, with common off-SOP spellings mapped to the right name. */
const SECTIONS: Record<string, string[]> = {
  'Social Ads': ['social ads'],
  'Testimonials': ['testimonials'],
  'VSLs': ['vsls'],
  'Walkthroughs': ['walkthroughs'],
  'Raw Footage': ['raw footage'],
  '_Admin': ['_admin', 'project info'],
  'Organic': ['organic'],
  'Team': ['team'],
  '_Archive': ['_archive'],
};
const ALIASES: Record<string, string> = {
  social: 'Social Ads', socials: 'Social Ads', 'social ad': 'Social Ads', ads: 'Social Ads',
  raws: 'Raw Footage', raw: 'Raw Footage', 'raw files': 'Raw Footage', ingest: 'Raw Footage',
  testimonial: 'Testimonials', vsl: 'VSLs', walkthrough: 'Walkthroughs', admin: '_Admin',
};

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const pad2 = (n: number) => String(n).padStart(2, '0');

/**
 * Pull a date out of a shoot folder name. Handles "February 25th 2026 | …",
 * "25th February 2026", "January 2026", "December 2025 Shoot", "25.02.26",
 * "2026-02-25". Returns ISO yyyy-mm-dd (day 01 when only a month is given) or null.
 */
export function parseShootDate(name: string): string | null {
  const iso = name.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dotted = name.match(/\b(\d{1,2})[./](\d{1,2})[./](\d{4}|\d{2})\b/);
  if (dotted) {
    const y = dotted[3].length === 2 ? `20${dotted[3]}` : dotted[3];
    return `${y}-${pad2(Number(dotted[2]))}-${pad2(Number(dotted[1]))}`;
  }
  const mon = '(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\.?';
  // Day-first before month-first, so "25th October 2026" isn't read as just "October 2026"
  const dmy = name.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+${mon}\\s+(20\\d{2})\\b`, 'i'));
  if (dmy) return `${dmy[3]}-${pad2(MONTHS.indexOf(dmy[2].toLowerCase()) + 1)}-${pad2(Number(dmy[1]))}`;
  const mdy = name.match(new RegExp(`\\b${mon}\\s+(?:(\\d{1,2})(?:st|nd|rd|th)?,?\\s+)?(20\\d{2})\\b`, 'i'));
  if (mdy) return `${mdy[3]}-${pad2(MONTHS.indexOf(mdy[1].toLowerCase()) + 1)}-${pad2(Number(mdy[2] ?? 1))}`;
  return null;
}

/** SOP shoot-folder format, e.g. "February 25th 2026 | Paid Ads & Organic Content". */
const SHOOT_NAME = /^(January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}(st|nd|rd|th) 20\d{2} \| \S.*$/;

const norm = (s: string) => s.trim().toLowerCase();
const stripExt = (name: string) => name.replace(/\.[A-Za-z0-9]{2,4}$/, '');
const isAsset = (n: AuditNode) => n.type === 'file' || n.type === 'version_stack';
const isFolder = (n: AuditNode) => n.type === 'folder';

/**
 * Informal markers the SOP bans from filenames. "NEW" only counts in capitals so
 * offers like "£49 New Patient Exam" pass; "copy" only as a trailing duplicate marker.
 */
export function hasInformalMarker(base: string): boolean {
  return /final[\s_-]*final/i.test(base)
    || /\buse this\b/i.test(base)
    || /(^|[\s_|(-])NEW([\s_|).-]|$)/.test(base)
    || /[\s_-]copy(\s*\d+)?$/i.test(base)
    || /\(\d+\)$/.test(base)
    || /_final\d*$/i.test(base);
}
/** Ages in a persona label: "45-65", "45 to 65", "45+", "aged 40". */
const AGE = /(\b\d{2}\s*(?:-|–|to)\s*\d{2}\b|\b\d{2}\s*\+|\baged?\s*\d{2})/i;
/** Camera / phone default names — raw clips that shouldn't sit in delivery folders. */
const CAMERA_NAME = /^(?:[A-Z]{1,4}_?\d{3,}|IMG_\d+|MVI_\d+|DJI_\d+|GX\d+|GH\d+|C\d{4}|P\d{6,}|VID_\d+)/i;

const SMALL_WORDS = new Set(['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'in', 'of', 'on', 'or', 'the', 'to', 'with', 'via', 'vs']);

/** Title Case check: every main word starts with a capital (or a digit/£). */
export function isTitleCase(label: string): boolean {
  const words = label.split(/\s+/).filter(Boolean);
  return words.every((w, i) => {
    const first = w.replace(/^[^A-Za-z0-9£]+/, '')[0];
    if (!first) return true;
    if (/[0-9£]/.test(first)) return true;
    if (i > 0 && SMALL_WORDS.has(w.toLowerCase())) return true;
    return first === first.toUpperCase();
  });
}

/** Rebuild a pipe string with exactly " | " between non-empty parts. */
export function normalisePipes(s: string): string {
  return s.split('|').map((p) => p.trim().replace(/\s+/g, ' ')).filter(Boolean).join(' | ');
}

export interface ConceptCheck {
  ok: boolean;
  problems: string[];
  suggestion?: string;
}

/** Validate a concept folder name: `Persona | Angle | Offer`. */
export function checkConceptName(name: string): ConceptCheck {
  const problems: string[] = [];
  const parts = name.split('|').map((p) => p.trim());
  if (parts.length !== 3 || parts.some((p) => !p)) {
    problems.push(`needs exactly three parts "Persona | Angle | Offer" (found ${parts.filter(Boolean).length})`);
  }
  const fixed = normalisePipes(name);
  if (parts.length >= 2 && fixed !== name.trim()) problems.push('pipes need one space either side: " | "');
  const [persona = '', angle = ''] = parts;
  if (AGE.test(persona)) problems.push('persona contains an age range; personas never include ages');
  if (persona && !isTitleCase(persona)) problems.push('persona should be Title Case');
  if (angle && !isTitleCase(angle)) problems.push('angle should be Title Case');
  if (/[A-Za-z][-_][A-Za-z]/.test(persona.replace(/Pre-Retirement/g, '')) || /[a-z][A-Z]/.test(`${persona} ${angle}`)) {
    problems.push('use spaces between words, not hyphens, underscores or camelCase');
  }
  return { ok: problems.length === 0, problems, suggestion: problems.length && parts.length === 3 ? fixed : undefined };
}

export interface ParsedExport {
  concept: string;
  ratio: string;
  length: string;
  variant: string | null;
  version: string;
  status: string;
}

/**
 * Parse `Persona | Angle | Offer | Ratio | Length | [Variant] | vNN | Status.ext`.
 * Returns problems rather than throwing so the audit can report everything at once.
 */
export function checkExportName(fileName: string, conceptFolder: string): { parsed: ParsedExport | null; problems: string[]; suggestion?: string } {
  const problems: string[] = [];
  const base = stripExt(fileName);
  const parts = base.split('|').map((p) => p.trim());
  if (parts.length < 7) {
    if (CAMERA_NAME.test(base)) {
      return { parsed: null, problems: ['looks like a raw camera clip; raw footage belongs in Raw Footage, not a concept folder'] };
    }
    return { parsed: null, problems: ['does not follow "Persona | Angle | Offer | Ratio | Length | [Variant] | vXX | Status"'] };
  }
  const concept = parts.slice(0, 3).join(' | ');
  const [ratio, length] = [parts[3], parts[4]];
  const rest = parts.slice(5);
  const status = rest[rest.length - 1];
  const version = rest[rest.length - 2];
  const variant = rest.length > 2 ? rest.slice(0, -2).join(' | ') : null;

  if (concept !== normalisePipes(conceptFolder)) problems.push(`concept part "${concept}" does not match its folder "${conceptFolder}" word for word`);
  if (/^\d{1,2}:\d{1,2}$/.test(ratio)) problems.push(`ratio "${ratio}" uses a colon; write ${ratio.replace(':', 'x')}`);
  else if (!RATIOS.includes(ratio as (typeof RATIOS)[number])) problems.push(`ratio "${ratio}" is not one of ${RATIOS.join(', ')}`);
  if (!/^\d+s$/.test(length) && !ASSET_KINDS.includes(length)) problems.push(`length "${length}" should look like 30s (or Static / Thumb)`);
  if (!/^v\d{2,}$/.test(version)) problems.push(`version "${version}" should be two digits, e.g. v01`);
  if (!STATUSES.includes(status as (typeof STATUSES)[number])) problems.push(`status "${status}" should be one of ${STATUSES.join(', ')}`);
  if (base.includes('|') && normalisePipes(base) !== base) problems.push('pipes need one space either side: " | "');

  let suggestion: string | undefined;
  if (problems.length) {
    const ext = fileName.slice(base.length) || '.mp4';
    const fixRatio = ratio.replace(':', 'x');
    const fixVersion = /^v\d$/.test(version) ? version.replace(/^v/, 'v0') : version;
    suggestion = normalisePipes([normalisePipes(conceptFolder), fixRatio, length, variant, fixVersion, status].filter(Boolean).join(' | ')) + ext;
  }
  return { parsed: { concept, ratio, length, variant, version, status }, problems, suggestion };
}

const PREFIX_RULES: Array<{ section: string; prefix: string; pattern: string }> = [
  { section: 'Testimonials', prefix: 'Testimonial |', pattern: 'Testimonial | [Persona if known] | [Treatment] | [Speaker or anon code] | [Ratio] | vXX | Status' },
  { section: 'VSLs', prefix: 'VSL |', pattern: 'VSL | [Primary Persona or Theme] | [Offer or Title] | [Length] | vXX | Status' },
  { section: 'Walkthroughs', prefix: 'Walkthrough |', pattern: 'Walkthrough | [Location or Clinic] | [Focus] | [Ratio] | vXX | Status' },
];

/** Audit one project's subtree. `nodes` = every row for the project (incl. the root folder). */
export function auditProject(nodes: AuditNode[], opts: { sopFrom?: string } = {}): AuditIssue[] {
  const sopFrom = opts.sopFrom ?? SOP_FROM;
  const issues: AuditIssue[] = [];
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const children = new Map<string, AuditNode[]>();
  for (const n of nodes) {
    if (!n.parent_id) continue;
    const list = children.get(n.parent_id) ?? [];
    list.push(n);
    children.set(n.parent_id, list);
  }
  const kids = (id: string) => children.get(id) ?? [];
  const descendants = (id: string): AuditNode[] => {
    const out: AuditNode[] = [];
    const stack = [...kids(id)];
    while (stack.length) {
      const n = stack.pop()!;
      out.push(n);
      if (isFolder(n)) stack.push(...kids(n.id));
    }
    return out;
  };
  const pathOf = (n: AuditNode): string => {
    const parts: string[] = [];
    let cur: AuditNode | undefined = n;
    for (let i = 0; cur && i < 20; i += 1) {
      if (cur.type !== 'project' && cur.name !== 'root') parts.unshift(cur.name);
      cur = cur.parent_id ? byId.get(cur.parent_id) : undefined;
    }
    return parts.join(' > ');
  };
  const add = (severity: Severity, rule: string, n: AuditNode, message: string, suggestion?: string) =>
    issues.push({ severity, rule, assetId: n.id, name: n.name, path: pathOf(n), message, suggestion, viewUrl: n.view_url ?? null });

  const root = nodes.find((n) => isFolder(n) && !n.parent_id);
  if (!root) return issues;
  const top = kids(root.id);
  const sectionOf = (n: AuditNode): string | null =>
    Object.entries(SECTIONS).find(([, names]) => names.includes(norm(n.name)))?.[0] ?? null;

  // Shoot folders dated on/after the SOP start get the full rules
  const newShoots = top.filter((n) => isFolder(n) && (parseShootDate(n.name) ?? '') >= sopFrom);
  const strict = new Set(newShoots.flatMap((s) => descendants(s.id).map((d) => d.id)));

  // ---- Basic checks (all content) ----
  for (const n of top) {
    if (isAsset(n)) add('warning', 'loose-root-asset', n, 'file sitting loose at the project root; move it into its shoot folder');
  }
  for (const n of nodes) {
    if (isAsset(n) && hasInformalMarker(stripExt(n.name))) {
      add(strict.has(n.id) ? 'error' : 'warning', 'informal-name', n,
        'duplicate or informal marker in the name ((1), NEW, final_FINAL, copy, USE THIS); usually a re-upload: keep one, or tell versions apart with vXX and Status');
    }
  }

  // ---- Full SOP checks (new shoots only) ----
  if (newShoots.length) {
    const hasAdmin = top.some((n) => isFolder(n) && sectionOf(n) === '_Admin') || newShoots.some((s) => kids(s.id).some((k) => isFolder(k) && sectionOf(k) === '_Admin'));
    if (!hasAdmin) add('warning', 'missing-admin', root, 'no _Admin folder (brief, locked concept list, brand kit) at the project root or in the shoot folder', 'create "_Admin"');
  }

  for (const shoot of newShoots) {
    if (!SHOOT_NAME.test(shoot.name)) {
      add('warning', 'shoot-folder-name', shoot, 'shoot folders should be named like "February 25th 2026 | Paid Ads & Organic Content"');
    }
    const sections = kids(shoot.id);
    const find = (key: string) => sections.find((n) => isFolder(n) && sectionOf(n) === key);
    for (const n of sections) {
      if (isAsset(n)) { add('error', 'loose-shoot-asset', n, 'file sitting directly in the shoot folder; it belongs in Raw Footage or its section'); continue; }
      if (!isFolder(n) || sectionOf(n)) continue;
      const fix = ALIASES[norm(n.name)];
      add('warning', 'unexpected-section', n,
        fix ? `use the SOP name "${fix}"` : `"${n.name}" is not an SOP section (Social Ads, Testimonials, VSLs, Walkthroughs, Raw Footage, _Admin, Organic, Team)`,
        fix ? `rename to "${fix}"` : undefined);
    }
    if (!find('Raw Footage') && !sections.some((n) => ALIASES[norm(n.name)] === 'Raw Footage')) {
      add('warning', 'missing-raw-footage', shoot, 'no Raw Footage folder in this shoot', 'create "Raw Footage"');
    }

    // Social Ads > Treatments > [Treatment] > [Concept] > exports
    const social = find('Social Ads');
    if (social) {
      const treatments = kids(social.id).find((n) => isFolder(n) && norm(n.name) === 'treatments');
      for (const n of kids(social.id)) {
        if (isAsset(n)) add('error', 'loose-social-asset', n, 'export sitting directly in Social Ads; it belongs in Treatments > [Treatment] > [Concept]');
        else if (isFolder(n) && n !== treatments && norm(n.name) !== '_archive') add('warning', 'unexpected-folder', n, 'Social Ads should only contain "Treatments"');
      }
      if (!treatments) add('warning', 'missing-treatments', social, 'Social Ads has no "Treatments" folder');
      for (const t of treatments ? kids(treatments.id) : []) {
        if (isAsset(t)) { add('error', 'loose-social-asset', t, 'export sitting directly in Treatments; it needs a Treatment and Concept folder'); continue; }
        if (!isFolder(t)) continue;
        for (const c of kids(t.id)) {
          if (isAsset(c)) { add('error', 'loose-social-asset', c, `export sitting directly in the "${t.name}" treatment folder; it belongs inside its concept folder`); continue; }
          if (!isFolder(c) || norm(c.name) === '_archive') continue;
          const cc = checkConceptName(c.name);
          if (!cc.ok) add('error', 'concept-folder-name', c, cc.problems.join('; '), cc.suggestion);
          const seen = new Map<string, number[]>();
          for (const f of kids(c.id)) {
            if (isFolder(f)) { add('warning', 'nested-in-concept', f, 'concept folders should hold exports only, not subfolders'); continue; }
            if (!isAsset(f)) continue;
            const ex = checkExportName(f.name, c.name);
            if (ex.problems.length) add('error', 'export-name', f, ex.problems.join('; '), ex.suggestion);
            if (ex.parsed && /^v\d+$/.test(ex.parsed.version)) {
              const key = [ex.parsed.ratio, ex.parsed.length, ex.parsed.variant ?? ''].join(' | ');
              seen.set(key, [...(seen.get(key) ?? []), Number(ex.parsed.version.slice(1))]);
            }
          }
          // Earlier versions normally sit inside a version stack, so only duplicates are checked, not gaps.
          for (const [key, versions] of seen) {
            if (versions.length !== new Set(versions).size) add('error', 'version-reused', c, `${key}: the same version number is used on more than one file; revisions should stack on one asset`);
          }
        }
      }
    }

    // Testimonials / VSLs / Walkthroughs naming, and paid-ad cuts filed in the wrong tree
    for (const rule of PREFIX_RULES) {
      const sec = find(rule.section);
      if (!sec) continue;
      for (const n of descendants(sec.id)) {
        if (!isAsset(n)) continue;
        const base = stripExt(n.name);
        if (base.split('|').length >= 7 && !base.startsWith(rule.prefix.slice(0, -2))) {
          add('error', 'paid-ad-in-wrong-tree', n, `looks like a Social Ads export sitting in ${rule.section}; paid social must be copied into its Social Ads concept folder`);
        } else if (!base.startsWith(rule.prefix)) {
          add('warning', 'section-name', n, `${rule.section} files should be named "${rule.pattern}"`);
        }
      }
    }

    // Raw Footage never holds deliverables
    const raw = find('Raw Footage');
    for (const n of raw ? descendants(raw.id) : []) {
      if (isAsset(n) && /\|\s*(Final|Client Review|Internal)\s*$/.test(stripExt(n.name))) {
        add('error', 'final-in-raw', n, 'an edited export (Internal / Client Review / Final) is sitting in Raw Footage; deliverables live only in their concept folder');
      }
    }
  }

  const order = { error: 0, warning: 1 } as const;
  return issues.sort((a, b) => order[a.severity] - order[b.severity] || a.path.localeCompare(b.path));
}
