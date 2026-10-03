import { checkConceptName } from '../frameio/folder-audit.js';
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
  const resource = (b.resource && typeof b.resource === 'object' ? b.resource : {}) as Obj;
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
      : 'The AI cuts this clip and puts v01 (Internal) in the right concept folder for you to review.',
    fields: [
      {
        type: 'select', label: 'Type', name: 'section', value: values.section || 'Social Ads',
        options: [{ name: 'Social Ad', value: 'Social Ads' }, { name: 'Organic', value: 'Organic' }],
      },
      { type: 'text', label: 'Treatment (Social Ads only, e.g. Invisalign)', name: 'treatment', value: values.treatment ?? '' },
      { type: 'text', label: 'Video name: Persona | Angle | Offer (Organic: a title)', name: 'concept', value: values.concept ?? '' },
      { type: 'select', label: 'Brand', name: 'brand', value: values.brand || BRAND_PACKS[0].value, options: BRAND_PACKS },
      { type: 'textarea', label: 'Notes for the AI (optional)', name: 'notes', value: values.notes ?? '' },
    ],
  };
}

const titleCase = (s: string) => /^[A-Z0-9]/.test(s.trim());

/** Check the form answers. Returns the job params, or a plain-English problem to show back. */
export function validateFirstCut(data: Record<string, string>): { ok: true; params: FirstCutParams } | { ok: false; problem: string } {
  const section = data.section === 'Organic' ? 'Organic' : data.section === 'Social Ads' ? 'Social Ads' : null;
  if (!section) return { ok: false, problem: 'choose Social Ad or Organic.' };
  const concept = (data.concept ?? '').replace(/\s+/g, ' ').trim();
  if (!concept) return { ok: false, problem: 'add the video name.' };
  if (/\|\s*(9x16|4x5|1x1|16x9|v\d+|Internal|Client Review|Final)\b/i.test(concept)) {
    return { ok: false, problem: 'the video name is only the concept part; ratio, length, version and status are added for you.' };
  }
  const brand = data.brand ?? '';
  if (!BRAND_PACKS.some((b) => b.value === brand)) return { ok: false, problem: 'choose a brand from the list.' };
  const notes = (data.notes ?? '').slice(0, 2000);

  if (section === 'Organic') {
    if (concept.includes('|')) return { ok: false, problem: 'an Organic video name is just a title, without " | ".' };
    if (!titleCase(concept)) return { ok: false, problem: 'start the title with a capital letter.' };
    return { ok: true, params: { section, treatment: null, concept, brand, notes } };
  }

  const treatment = (data.treatment ?? '').replace(/\s+/g, ' ').trim();
  if (!treatment) return { ok: false, problem: 'add the treatment (the folder under Social Ads > Treatments).' };
  if (!titleCase(treatment)) return { ok: false, problem: 'start the treatment with a capital letter.' };
  const check = checkConceptName(concept);
  if (!check.ok) {
    return { ok: false, problem: `video name ${check.problems.join('; ')}${check.suggestion ? ` (try "${check.suggestion}")` : ''}.` };
  }
  return { ok: true, params: { section, treatment, concept, brand, notes } };
}

/** Name passed to the edit pipeline (it adds ratio, length, version and status). */
export function pipelineName(p: FirstCutParams): string {
  return p.section === 'Organic' ? `Organic | ${p.concept}` : p.concept;
}

/** Where v01 lands, relative to the shoot folder. */
export function destinationPath(p: FirstCutParams): string[] {
  return p.section === 'Organic' ? ['Organic', p.concept] : ['Social Ads', 'Treatments', p.treatment!, p.concept];
}
