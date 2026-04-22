import type { FastifyPluginAsync } from 'fastify';

import type { SessionUser } from '../../lib/auth.js';
import {
  listSuggestions,
  getSuggestion,
  updateSuggestionStatus,
  getAttachmentsForSuggestion,
  getSuggestionsEnabled,
  setSuggestionsEnabled,
  type SuggestionStatus,
  type SuggestionScope,
  type StructuredOutput,
} from '../../lib/queries/suggestions.js';

function asString(v: unknown): string {
  if (Array.isArray(v)) return String(v[0] ?? '');
  return String(v ?? '');
}

export const adminSuggestionsRoutes: FastifyPluginAsync = async (app) => {
  // Queue list
  app.get('/', async (request, reply) => {
    const q = (request.query ?? {}) as Record<string, string | undefined>;
    const status = (q.status as SuggestionStatus | 'all' | undefined) ?? 'all';
    const scope = (q.scope as SuggestionScope | 'all' | undefined) ?? 'all';

    const items = await listSuggestions({ status, scope, limit: 200 });
    const enabled = await getSuggestionsEnabled();

    reply.render('admin/suggestions/list', {
      items,
      filters: { status, scope },
      suggestionsEnabled: enabled,
    });
  });

  // Toggle feature on/off
  app.post('/settings/toggle', async (_request, reply) => {
    const enabled = await getSuggestionsEnabled();
    await setSuggestionsEnabled(!enabled);
    reply.redirect('/admin/suggestions');
  });

  // Detail view
  app.get('/:id', async (request, reply) => {
    const id = Number.parseInt((request.params as { id: string }).id, 10);
    if (!Number.isFinite(id)) return reply.code(404).send('Not found');

    const suggestion = await getSuggestion(id);
    if (!suggestion) return reply.code(404).send('Not found');

    let structured: StructuredOutput;
    try {
      structured = JSON.parse(suggestion.structured_output);
    } catch {
      return reply.code(500).send('Corrupt suggestion data');
    }

    const transcript = (() => {
      try { return JSON.parse(suggestion.chat_transcript); }
      catch { return []; }
    })();
    const attachments = await getAttachmentsForSuggestion(id);

    reply.render('admin/suggestions/detail', {
      suggestion,
      structured,
      transcript,
      attachments,
      planBrief: buildPlanBrief({ suggestion, structured, attachments }),
    });
  });

  // Update status + priority + notes
  app.post('/:id/status', async (request, reply) => {
    const user = (request as any).user as SessionUser | null;
    if (!user) return reply.code(401).send('Unauthorised');

    const id = Number.parseInt((request.params as { id: string }).id, 10);
    if (!Number.isFinite(id)) return reply.code(404).send('Not found');

    const body = (request.body ?? {}) as Record<string, string | string[] | undefined>;
    const statusStr = asString(body.status);
    const validStatus: SuggestionStatus[] = ['submitted', 'accepted', 'rejected', 'implemented'];
    if (!(validStatus as string[]).includes(statusStr)) return reply.code(400).send('Bad status');

    const priority = asString(body.priority) || null;
    const reviewNotes = asString(body.review_notes) || null;

    await updateSuggestionStatus({
      id,
      status: statusStr as SuggestionStatus,
      reviewerId: user.id,
      priority,
      reviewNotes,
    });

    reply.redirect(`/admin/suggestions/${id}`);
  });
};

function buildPlanBrief(params: {
  suggestion: { id: number; submitted_by_name: string; created_at: string; priority: string | null; review_notes: string | null };
  structured: StructuredOutput;
  attachments: Array<{ blob_url: string; filename: string | null }>;
}): string {
  const { suggestion, structured, attachments } = params;
  const lines: string[] = [];
  lines.push(`# Suggestion: ${structured.title}`);
  lines.push(`**Submitted by:** ${suggestion.submitted_by_name} on ${suggestion.created_at.slice(0, 10)}`);
  if (suggestion.priority) lines.push(`**Priority:** ${suggestion.priority}`);
  if (structured.scope === 'page' && structured.page_label) {
    lines.push(`**Page:** ${structured.page_label} (${structured.page_url ?? ''})`);
  } else {
    lines.push(`**Scope:** site-wide`);
  }
  lines.push('');
  lines.push('## Problem');
  lines.push(structured.problem || '(none captured)');
  lines.push('');
  lines.push('## Where in the app');
  lines.push(structured.where_in_app || '(unspecified)');
  lines.push('');
  lines.push('## Desired outcome');
  lines.push(structured.desired_outcome || '(unspecified)');

  if (structured.user_journey && structured.user_journey.length) {
    lines.push('');
    lines.push('## User journey');
    for (const step of structured.user_journey) lines.push(`- ${step}`);
  }

  if (structured.acceptance_criteria && structured.acceptance_criteria.length) {
    lines.push('');
    lines.push('## Acceptance criteria');
    for (const c of structured.acceptance_criteria) lines.push(`- [ ] ${c}`);
  }

  if (structured.out_of_scope) {
    lines.push('');
    lines.push('## Out of scope');
    lines.push(structured.out_of_scope);
  }

  if (structured.edge_cases) {
    lines.push('');
    lines.push('## Edge cases');
    lines.push(structured.edge_cases);
  }

  if (structured.examples) {
    lines.push('');
    lines.push('## Examples / references');
    lines.push(structured.examples);
  }

  if (attachments.length) {
    lines.push('');
    lines.push('## Attachments');
    for (const a of attachments) {
      lines.push(`- [${a.filename || 'screenshot'}](${a.blob_url})`);
    }
  }

  if (suggestion.review_notes) {
    lines.push('');
    lines.push('---');
    lines.push(`_Reviewer notes:_ ${suggestion.review_notes}`);
  }

  return lines.join('\n');
}
