import type { FastifyPluginAsync } from 'fastify';
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

/** Parse answers from body, merging into existing answers object */
function mergeAnswers(
  body: Record<string, string | string[]>,
  existing: Record<string, unknown>,
): Record<string, unknown> {
  const merged = { ...existing };
  for (const [key, val] of Object.entries(body)) {
    if (key.startsWith('_')) continue;
    merged[key] = val;
  }
  return merged;
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
    const { token } = request.params as { token: string };
    const submission = await getOnboardingByToken(token);
    if (!submission || submission.status === 'submitted') return reply.code(400).send('Invalid');

    const body = request.body as Record<string, string | string[]>;
    const template = getTemplate(submission.template_id)!;
    const currentAnswers = mergeAnswers(body, JSON.parse(submission.answers || '{}'));
    const direction = body._direction as string || 'next';
    const currentStepIdx = parseInt(body._stepIndex as string, 10) || 0;

    // Auto-set practice name from first question
    if (currentAnswers['1.1'] && !submission.practice_name) {
      await updateOnboardingMeta(submission.id, { practiceName: currentAnswers['1.1'] as string });
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
    if (!submission) return reply.code(400).send('Invalid');

    await updateOnboardingMeta(submission.id, { status: 'submitted' });

    const template = getTemplate(submission.template_id)!;
    const answers = JSON.parse(submission.answers || '{}');
    const updatedSubmission = { ...submission, status: 'submitted' };
    const activeSections = getActiveSections(template, answers);
    const data = wizardData(updatedSubmission, template, answers, activeSections.length, 'client', `/onboard/${token}`);

    // Return full page on submit (not just body) so the submitted state renders properly
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
    const practiceName = body?.practiceName;
    const contactEmail = body?.contactEmail;
    const user = (request as any).user;

    if (!templateId || !getTemplate(templateId)) {
      return reply.redirect('/onboarding');
    }

    const { id } = await createOnboarding({
      templateId,
      practiceName,
      contactEmail,
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
    const currentAnswers = mergeAnswers(body, JSON.parse(submission.answers || '{}'));
    const direction = body._direction as string || 'next';
    const currentStepIdx = parseInt(body._stepIndex as string, 10) || 0;

    if (currentAnswers['1.1'] && !submission.practice_name) {
      await updateOnboardingMeta(submission.id, { practiceName: currentAnswers['1.1'] as string });
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
