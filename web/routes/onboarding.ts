import type { FastifyPluginAsync } from 'fastify';
import crypto from 'crypto';
import {
  getOnboardingByToken,
  getOnboardingById,
  getAllOnboardings,
  createOnboarding,
  saveOnboardingAnswers,
  updateOnboardingMeta,
  deleteOnboarding,
  initOnboardingSchema,
} from '../lib/queries/onboarding.js';
import {
  getTemplate,
  getActiveSections,
  ONBOARDING_TEMPLATES,
} from '../lib/onboarding-templates.js';

// Ensure schema exists on first load
let schemaReady = false;
async function ensureSchema() {
  if (schemaReady) return;
  await initOnboardingSchema();
  schemaReady = true;
}

// ---------------------------------------------------------------------------
// Rate limiter (in-memory, per-IP)
// ---------------------------------------------------------------------------

const rateLimits = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string, key: string, maxRequests: number, windowMs: number): boolean {
  const id = `${key}:${ip}`;
  const now = Date.now();
  const entry = rateLimits.get(id);

  if (!entry || now > entry.resetAt) {
    rateLimits.set(id, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= maxRequests) return false;
  entry.count++;
  return true;
}

// Cleanup stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimits) {
    if (now > entry.resetAt) rateLimits.delete(key);
  }
}, 5 * 60 * 1000).unref();

// ---------------------------------------------------------------------------
// Input sanitisation
// ---------------------------------------------------------------------------

const MAX_FIELD_LENGTH = 5000;
const MAX_REPEATER_INDEX = 99;
const MAX_JSON_SIZE = 512 * 1024; // 500KB

/** Strip HTML tags from a string value */
function stripHtml(val: string): string {
  return val.replace(/<[^>]*>/g, '');
}

/** Sanitise a single value: strip HTML, enforce length */
function sanitiseValue(val: string | string[]): string | string[] {
  if (Array.isArray(val)) {
    return val.map(v => stripHtml(String(v)).slice(0, MAX_FIELD_LENGTH));
  }
  return stripHtml(String(val)).slice(0, MAX_FIELD_LENGTH);
}

/** Parse answers from body, merging into existing answers object.
 *  Handles repeater bracket notation (e.g. 1.6[0].name) and
 *  matrix/pricing/hours fields (e.g. 3.2._applyAll, 3A.1._t.slug.field, 1.8._h.Monday).
 */
function mergeAnswers(
  body: Record<string, string | string[]>,
  existing: Record<string, unknown>,
): Record<string, unknown> {
  const merged = { ...existing };
  const repeaterPattern = /^(.+)\[(\d+)\]\.(.+)$/;
  const matrixPattern = /^(.+)\._(.+)$/;

  for (const [key, rawVal] of Object.entries(body)) {
    if (key.startsWith('_')) continue;

    const val = sanitiseValue(rawVal);

    // Repeater fields: q[0].field -> answers[q] = [{ field: val }, ...]
    const rm = key.match(repeaterPattern);
    if (rm) {
      const [, qId, idxStr, field] = rm;
      const idx = parseInt(idxStr, 10);
      if (idx < 0 || idx > MAX_REPEATER_INDEX) continue;
      if (!Array.isArray(merged[qId])) merged[qId] = [];
      const arr = merged[qId] as Record<string, unknown>[];
      while (arr.length <= idx) arr.push({});
      arr[idx][field] = val;
      continue;
    }

    // Matrix fields: q._applyAll, q._treatments, q._loc.0, q._t.slug.field, q._h.Day
    const mm = key.match(matrixPattern);
    if (mm) {
      const [, qId, subKey] = mm;
      if (typeof merged[qId] !== 'object' || merged[qId] === null || Array.isArray(merged[qId])) {
        merged[qId] = {};
      }
      const matrix = merged[qId] as Record<string, unknown>;
      if (subKey === 'applyAll') {
        matrix.applyAll = val === 'true';
      } else if (subKey === 'treatments') {
        matrix.treatments = Array.isArray(val) ? val : [val];
      } else if (subKey.startsWith('loc.')) {
        const locIdx = subKey.split('.')[1];
        if (!matrix.byLocation) matrix.byLocation = {};
        (matrix.byLocation as Record<string, unknown>)[locIdx] = Array.isArray(val) ? val : [val];
      } else if (subKey.startsWith('t.')) {
        const parts = subKey.split('.');
        const treatSlug = parts[1];
        const field = parts[2];
        if (treatSlug && field) {
          if (!matrix[treatSlug]) matrix[treatSlug] = {};
          (matrix[treatSlug] as Record<string, unknown>)[field] = val;
        }
      } else if (subKey.startsWith('h.')) {
        const day = subKey.slice(2);
        matrix[day] = val;
      }
      continue;
    }

    merged[key] = val;
  }

  // Enforce total size limit
  const json = JSON.stringify(merged);
  if (json.length > MAX_JSON_SIZE) {
    throw new Error('Payload too large');
  }

  return merged;
}

/** Generate a per-submission nonce for CSRF-like protection on public forms */
function generateNonce(token: string): string {
  const secret = process.env.SESSION_SECRET || 'onboard-nonce-fallback';
  return crypto.createHmac('sha256', secret).update('onboard:' + token).digest('hex').slice(0, 32);
}

/** Build the standard wizard render data */
function wizardData(
  submission: any,
  template: any,
  answers: Record<string, unknown>,
  stepIndex: number,
  mode: 'client' | 'internal',
  baseUrl: string,
) {
  const activeSections = getActiveSections(template, answers);
  const clamped = Math.min(stepIndex, activeSections.length);
  return {
    submission,
    template,
    answers,
    activeSections,
    stepIndex: clamped,
    totalSteps: activeSections.length + 1,
    isReview: clamped >= activeSections.length,
    isSubmitted: submission.status === 'submitted' || submission.status === 'reviewed',
    mode,
    baseUrl,
    nonce: mode === 'client' ? generateNonce(submission.token) : undefined,
  };
}

// ---------------------------------------------------------------------------
// Client-facing routes (public, no auth) — mounted at /onboard
// ---------------------------------------------------------------------------

export const onboardPublicRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', async () => { await ensureSchema(); });

  // Choose template (entry page)
  app.get('/', async (_request, reply) => {
    reply.type('text/html').render('onboarding/choose', {
      templates: ONBOARDING_TEMPLATES,
    });
  });

  // Create new submission and redirect to wizard
  app.post('/start', async (request, reply) => {
    const ip = request.ip;
    if (!checkRateLimit(ip, 'start', 5, 60 * 60 * 1000)) {
      return reply.code(429).header('Retry-After', '3600').send('Too many requests. Please try again later.');
    }

    const body = request.body as Record<string, string>;
    const templateId = body?.templateId;
    if (!templateId || !getTemplate(templateId)) {
      return reply.redirect('/onboard');
    }
    const { token } = await createOnboarding({ templateId });
    return reply.redirect(`/onboard/${token}`);
  });

  // Wizard — full page
  app.get('/:token', async (request, reply) => {
    const { token } = request.params as { token: string };
    const submission = await getOnboardingByToken(token);
    if (!submission) return reply.code(404).type('text/html').render('onboarding/not-found', {});

    const template = getTemplate(submission.template_id);
    if (!template) return reply.code(404).type('text/html').render('onboarding/not-found', {});

    const answers = JSON.parse(submission.answers || '{}');
    const data = wizardData(submission, template, answers, submission.current_step - 1, 'client', `/onboard/${token}`);

    reply.type('text/html').render('onboarding/wizard', data);
  });

  // Save step answers (HTMX)
  app.post('/:token/save', async (request, reply) => {
    const ip = request.ip;
    if (!checkRateLimit(ip, 'save', 60, 60 * 1000)) {
      return reply.code(429).send('Too many requests.');
    }

    const { token } = request.params as { token: string };
    const submission = await getOnboardingByToken(token);
    if (!submission || submission.status === 'submitted' || submission.status === 'reviewed') {
      return reply.code(400).send('This form has already been submitted.');
    }

    const body = request.body as Record<string, string | string[]>;

    // Validate nonce
    const nonce = body._nonce as string;
    if (!nonce || nonce !== generateNonce(token)) {
      return reply.code(403).send('Invalid form token. Please reload the page.');
    }

    const template = getTemplate(submission.template_id)!;

    let currentAnswers: Record<string, unknown>;
    try {
      currentAnswers = mergeAnswers(body, JSON.parse(submission.answers || '{}'));
    } catch (e: any) {
      if (e.message === 'Payload too large') {
        return reply.code(413).send('Answer data too large.');
      }
      throw e;
    }

    const direction = body._direction as string || 'next';
    const currentStepIdx = parseInt(body._stepIndex as string, 10) || 0;

    // Auto-set practice name from first question (sanitised)
    if (currentAnswers['1.1'] && !submission.practice_name) {
      const name = String(currentAnswers['1.1']).slice(0, 200);
      await updateOnboardingMeta(submission.id, { practiceName: name });
    }

    const activeSections = getActiveSections(template, currentAnswers);
    let nextStepIdx = direction === 'back' ? Math.max(0, currentStepIdx - 1) : currentStepIdx + 1;
    nextStepIdx = Math.min(nextStepIdx, activeSections.length);

    await saveOnboardingAnswers(submission.id, currentAnswers, nextStepIdx + 1);

    const updatedSubmission = { ...submission, answers: JSON.stringify(currentAnswers), current_step: nextStepIdx + 1 };
    const data = wizardData(updatedSubmission, template, currentAnswers, nextStepIdx, 'client', `/onboard/${token}`);

    reply.type('text/html').render('onboarding/_wizard-body', data);
  });

  // Submit
  app.post('/:token/submit', async (request, reply) => {
    const { token } = request.params as { token: string };
    const submission = await getOnboardingByToken(token);
    if (!submission || submission.status === 'submitted' || submission.status === 'reviewed') {
      return reply.code(400).send('Already submitted.');
    }

    await updateOnboardingMeta(submission.id, { status: 'submitted' });

    const template = getTemplate(submission.template_id)!;
    const answers = JSON.parse(submission.answers || '{}');
    const updatedSubmission = { ...submission, status: 'submitted' };
    const activeSections = getActiveSections(template, answers);
    const data = wizardData(updatedSubmission, template, answers, activeSections.length, 'client', `/onboard/${token}`);

    reply.type('text/html').render('onboarding/wizard', data);
  });
};

// ---------------------------------------------------------------------------
// Internal routes (auth required) — mounted at /onboarding
// ---------------------------------------------------------------------------

export const onboardingInternalRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', async () => { await ensureSchema(); });

  // List all submissions
  app.get('/', async (_request, reply) => {
    const submissions = await getAllOnboardings();
    reply.render('onboarding/index', {
      submissions,
      templates: ONBOARDING_TEMPLATES,
    });
  });

  // Create new
  app.post('/create', async (request, reply) => {
    const body = request.body as Record<string, string>;
    const templateId = body?.templateId;
    const practiceName = body?.practiceName?.slice(0, 200);
    const contactEmail = body?.contactEmail;
    const driveFolderUrl = body?.driveFolderUrl;
    const user = (request as any).user;

    if (!templateId || !getTemplate(templateId)) {
      return reply.redirect('/onboarding');
    }

    const { id } = await createOnboarding({
      templateId,
      practiceName,
      contactEmail,
      driveFolderUrl,
      createdBy: user?.id,
    });

    return reply.redirect(`/onboarding/${id}`);
  });

  // View/edit wizard
  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const submission = await getOnboardingById(parseInt(id, 10));
    if (!submission) return reply.code(404).render('error', { statusCode: 404 });

    const template = getTemplate(submission.template_id);
    if (!template) return reply.code(404).render('error', { statusCode: 404 });

    const answers = JSON.parse(submission.answers || '{}');
    const data = wizardData(submission, template, answers, submission.current_step - 1, 'internal', `/onboarding/${id}`);

    reply.render('onboarding/wizard-internal', data);
  });

  // Save step (HTMX)
  app.post('/:id/save', async (request, reply) => {
    const { id } = request.params as { id: string };
    const submission = await getOnboardingById(parseInt(id, 10));
    if (!submission) return reply.code(400).send('Invalid');

    const body = request.body as Record<string, string | string[]>;
    const template = getTemplate(submission.template_id)!;

    let currentAnswers: Record<string, unknown>;
    try {
      currentAnswers = mergeAnswers(body, JSON.parse(submission.answers || '{}'));
    } catch (e: any) {
      if (e.message === 'Payload too large') {
        return reply.code(413).send('Answer data too large.');
      }
      throw e;
    }

    const direction = body._direction as string || 'next';
    const currentStepIdx = parseInt(body._stepIndex as string, 10) || 0;

    if (currentAnswers['1.1'] && !submission.practice_name) {
      const name = String(currentAnswers['1.1']).slice(0, 200);
      await updateOnboardingMeta(submission.id, { practiceName: name });
    }

    const activeSections = getActiveSections(template, currentAnswers);
    let nextStepIdx = direction === 'back' ? Math.max(0, currentStepIdx - 1) : currentStepIdx + 1;
    nextStepIdx = Math.min(nextStepIdx, activeSections.length);

    await saveOnboardingAnswers(submission.id, currentAnswers, nextStepIdx + 1);

    const updatedSubmission = { ...submission, answers: JSON.stringify(currentAnswers), current_step: nextStepIdx + 1 };
    const data = wizardData(updatedSubmission, template, currentAnswers, nextStepIdx, 'internal', `/onboarding/${id}`);

    reply.type('text/html').render('onboarding/_wizard-body', data);
  });

  // Submit
  app.post('/:id/submit', async (request, reply) => {
    const { id } = request.params as { id: string };
    await updateOnboardingMeta(parseInt(id, 10), { status: 'submitted' });
    return reply.redirect(`/onboarding/${id}`);
  });

  // Mark as reviewed
  app.post('/:id/review', async (request, reply) => {
    const { id } = request.params as { id: string };
    await updateOnboardingMeta(parseInt(id, 10), { status: 'reviewed' });
    return reply.redirect(`/onboarding/${id}`);
  });

  // Delete
  app.post('/:id/delete', async (request, reply) => {
    const { id } = request.params as { id: string };
    await deleteOnboarding(parseInt(id, 10));
    return reply.redirect('/onboarding');
  });

  // Jump to specific step (HTMX)
  app.get('/:id/step/:step', async (request, reply) => {
    const { id, step } = request.params as { id: string; step: string };
    const submission = await getOnboardingById(parseInt(id, 10));
    if (!submission) return reply.code(400).send('Invalid');

    const template = getTemplate(submission.template_id)!;
    const answers = JSON.parse(submission.answers || '{}');
    const data = wizardData(submission, template, answers, parseInt(step, 10), 'internal', `/onboarding/${id}`);

    reply.type('text/html').render('onboarding/_wizard-body', data);
  });
};
