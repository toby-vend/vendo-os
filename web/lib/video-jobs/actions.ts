import { checkConceptName, normalisePipes } from '../frameio/folder-audit.js';
import type { FirstCutParams } from './store.js';

/**
 * Frame.io custom actions ("AI First Cut", "AI Revision" in the right-click menu): parsing the callback,
 * the form we show, and validating what comes back. Pure functions; the route does the I/O.
 *
 * Frame.io calls our URL when someone picks the action. We answer with either a form (Frame.io shows it
 * and calls back with the answers in `data`) or a message (title + description shown to the person).
 */

export const ACTION_EVENTS = {
  first_cut: 'vendo.ai.first_cut',
  revision: 'vendo.ai.revision',
} as const;

/** Brand packs available in tools/video-edit/brands/. Add a client here when their pack is set up. */
export const BRAND_PACKS: Array<{ name: string; value: string }> = [
  { name: 'Vendo', value: 'vendo' },
];

export interface ActionPayload {
  event: string;
  interactionId: string | null;
  resourceId: string | null;
  resourceType: string | null;
  userId: string | null;
  accountId: string | null;
  workspaceId: string | null;
  projectId: string | null;
  data: Record<string, string> | null;
}

type Obj = Record<string, unknown>;
const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);
const idOf = (v: unknown): string | null => (v && typeof v === 'object' ? str((v as Obj).id) : str(v));

/** Tolerant of both nested ({resource: {id}}) and flat ({resource_id}) shapes. */
export function parseActionPayload(body: unknown): ActionPayload {
  const b = (body && typeof body === 'object' ? body : {}) as Obj;
  // Frame.io sends `resources: [{id, type}]` (actions can run on several assets); older shapes use `resource`.
  const first = Array.isArray(b.resources) ? b.resources[0] : b.resource;
  const resource = (first && typeof first === 'object' ? first : {}) as Obj;
  const rawData = b.data && typeof b.data === 'object' ? (b.data as Obj) : null;
  const data = rawData
    ? Object.fromEntries(Object.entries(rawData).map(([k, v]) => [k, v == null ? '' : String(v).trim()]))
    : null;
  return {
    event: str(b.type) ?? str(b.event) ?? '',
    interactionId: str(b.interaction_id),
    resourceId: str(resource.id) ?? str(b.resource_id),
    resourceType: str(resource.type) ?? str(b.resource_type),
    userId: idOf(b.user) ?? str(b.user_id),
    accountId: idOf(b.account) ?? str(b.account_id),
    workspaceId: idOf(b.workspace) ?? str(b.workspace_id),
    projectId: idOf(b.project) ?? str(b.project_id),
    data: data && Object.keys(data).length ? data : null,
  };
}

export interface ActionMessage { title: string; description: string }
export interface ActionForm extends ActionMessage {
  fields: Array<{ type: 'text' | 'textarea' | 'select'; label: string; name: string; value?: string; options?: Array<{ name: string; value: string }> }>;
}

export const message = (title: string, description: string): ActionMessage => ({ title, description });

export function firstCutForm(values: Record<string, string> = {}, problem?: string): ActionForm {
  return {
    title: 'AI First Cut',
    description: problem
      ? `Please fix: ${problem}`
      : 'The AI cuts this clip, names it from what is said and files v01 (Internal) in the right folder. The Creative Strategist checks the name at review.',
    fields: [
      {
        type: 'select', label: 'Type', name: 'section', value: values.section || 'Social Ads',
        options: [{ name: 'Social Ad', value: 'Social Ads' }, { name: 'Organic', value: 'Organic' }],
      },
      { type: 'select', label: 'Brand', name: 'brand', value: values.brand || BRAND_PACKS[0].value, options: BRAND_PACKS },
      { type: 'textarea', label: 'Notes for the AI (optional)', name: 'notes', value: values.notes ?? '' },
    ],
  };
}

/** Check the form answers. Returns the job params, or a plain-English problem to show back. The AI names the video later. */
export function validateFirstCut(data: Record<string, string>): { ok: true; params: FirstCutParams } | { ok: false; problem: string } {
  const section = data.section === 'Organic' ? 'Organic' : data.section === 'Social Ads' || !data.section ? 'Social Ads' : null;
  if (!section) return { ok: false, problem: 'choose Social Ad or Organic.' };
  // Frame.io leaves an untouched select out of the answers, so no brand means the default (first) one.
  const brand = data.brand || BRAND_PACKS[0].value;
  if (!BRAND_PACKS.some((b) => b.value === brand)) return { ok: false, problem: 'choose a brand from the list.' };
  return { ok: true, params: { section, treatment: null, concept: null, brand, notes: (data.notes ?? '').slice(0, 2000) } };
}

/**
 * The name the AI chose (title.json in the job folder), checked against the SOP. Social Ads need a treatment
 * and "Persona | Angle | Offer"; Organic needs a title. Problems are returned, not thrown: a 15-minute edit
 * isn't thrown away over a name, the Creative Strategist fixes it at review.
 */
export function nameFromTitle(section: FirstCutParams['section'], title: { treatment?: string; concept?: string; title?: string }): {
  treatment: string | null; concept: string; problems: string[];
} {
  const clean = (v?: string) => (v ?? '').replace(/\s+/g, ' ').trim();
  if (section === 'Organic') {
    const t = clean(title.title ?? title.concept).replace(/\|/g, '-');
    return { treatment: null, concept: t || 'Untitled', problems: t ? [] : ['the AI gave no title'] };
  }
  const treatment = clean(title.treatment) || 'General';
  const concept = normalisePipes(clean(title.concept));
  const check = checkConceptName(concept);
  const problems = [...(clean(title.treatment) ? [] : ['the AI gave no treatment']), ...check.problems];
  return { treatment, concept: concept || 'Unnamed | Unnamed | Unnamed', problems };
}

/** Name passed to the upload (the runner adds ratio, length, version and status). */
export function pipelineName(section: FirstCutParams['section'], concept: string): string {
  return section === 'Organic' ? `Organic | ${concept}` : concept;
}

/** Where v01 lands, relative to the shoot folder. */
export function destinationPath(section: FirstCutParams['section'], treatment: string | null, concept: string): string[] {
  return section === 'Organic' ? ['Organic', concept] : ['Social Ads', 'Treatments', treatment ?? 'General', concept];
}
