/**
 * Client Knowledge route — staff-only briefing per client.
 *
 *   GET  /clients/:name/knowledge                 — Eta page
 *   POST /clients/:name/notes                     — create note
 *   POST /clients/:name/notes/:id                 — edit note
 *   POST /clients/:name/notes/:id/archive         — soft-delete note
 *
 * Auth piggy-backs on the global onRequest hook in server.ts (vendo_session
 * cookie). All writes invalidate the briefing cache.
 */
import type { FastifyPluginAsync } from 'fastify';
import { rows } from '../lib/queries/base.js';
import { generateBriefing, invalidateBriefingCache } from '../lib/client-knowledge/briefing.js';
import { addNote, editNote, archiveNote, getNote, NOTE_CATEGORIES, type NoteCategory } from '../lib/queries/client-notes.js';

interface ClientLookupRow {
  id: number;
  name: string;
  display_name: string | null;
}

const MAX_NOTE_BODY = 4000;

function isValidCategory(value: unknown): value is NoteCategory {
  return typeof value === 'string' && (NOTE_CATEGORIES as readonly string[]).includes(value);
}

async function lookupClient(name: string): Promise<ClientLookupRow | null> {
  const result = await rows<ClientLookupRow>(
    'SELECT id, name, display_name FROM clients WHERE name = ? LIMIT 1',
    [name],
  );
  return result[0] ?? null;
}

export const clientKnowledgeRoutes: FastifyPluginAsync = async (app) => {
  /**
   * GET /clients/:name/knowledge
   */
  app.get('/:name/knowledge', async (request, reply) => {
    const { name } = request.params as { name: string };
    const decoded = decodeURIComponent(name);

    const client = await lookupClient(decoded);
    if (!client) {
      reply.code(404).send('Client not found');
      return;
    }

    const briefing = await generateBriefing(client.id);
    if (!briefing) {
      reply.code(404).send('Briefing unavailable');
      return;
    }

    reply.render('clients/knowledge', { briefing });
  });

  /**
   * POST /clients/:name/notes  — create a new note.
   * Body: { body: string, category?: NoteCategory }
   */
  app.post('/:name/notes', async (request, reply) => {
    const { name } = request.params as { name: string };
    const decoded = decodeURIComponent(name);
    const user = (request as any).user as { id: string } | undefined;
    if (!user?.id) { reply.code(401).send({ error: 'Unauthenticated' }); return; }

    const body = request.body as { body?: string; category?: string };
    const noteBody = (body.body ?? '').trim();
    if (!noteBody) { reply.code(400).send({ error: 'Body is required' }); return; }
    if (noteBody.length > MAX_NOTE_BODY) {
      reply.code(400).send({ error: `Body too long (max ${MAX_NOTE_BODY})` });
      return;
    }
    const category: NoteCategory = isValidCategory(body.category) ? body.category : 'context';

    const client = await lookupClient(decoded);
    if (!client) { reply.code(404).send('Client not found'); return; }

    await addNote({
      clientId: client.id,
      authorUserId: user.id,
      body: noteBody,
      category,
      source: 'manual',
    });
    invalidateBriefingCache(client.id);

    reply.redirect(`/clients/${encodeURIComponent(decoded)}/knowledge#notes`);
  });

  /**
   * POST /clients/:name/notes/:id  — edit body and/or category.
   */
  app.post('/:name/notes/:id', async (request, reply) => {
    const { name, id } = request.params as { name: string; id: string };
    const decoded = decodeURIComponent(name);
    const noteId = Number(id);
    if (!Number.isFinite(noteId)) { reply.code(400).send({ error: 'Invalid note id' }); return; }
    const user = (request as any).user as { id: string } | undefined;
    if (!user?.id) { reply.code(401).send({ error: 'Unauthenticated' }); return; }

    const body = request.body as { body?: string; category?: string };
    const existing = await getNote(noteId);
    if (!existing) { reply.code(404).send({ error: 'Note not found' }); return; }

    const updateBody = body.body !== undefined ? body.body.trim() : undefined;
    if (updateBody !== undefined && !updateBody) {
      reply.code(400).send({ error: 'Body cannot be empty' });
      return;
    }
    if (updateBody !== undefined && updateBody.length > MAX_NOTE_BODY) {
      reply.code(400).send({ error: `Body too long (max ${MAX_NOTE_BODY})` });
      return;
    }
    const updateCategory = isValidCategory(body.category) ? body.category : undefined;

    await editNote({ noteId, body: updateBody, category: updateCategory });
    invalidateBriefingCache(existing.client_id);

    reply.redirect(`/clients/${encodeURIComponent(decoded)}/knowledge#notes`);
  });

  /**
   * POST /clients/:name/notes/:id/archive — soft-delete.
   */
  app.post('/:name/notes/:id/archive', async (request, reply) => {
    const { name, id } = request.params as { name: string; id: string };
    const decoded = decodeURIComponent(name);
    const noteId = Number(id);
    if (!Number.isFinite(noteId)) { reply.code(400).send({ error: 'Invalid note id' }); return; }

    const existing = await getNote(noteId);
    if (!existing) { reply.code(404).send({ error: 'Note not found' }); return; }

    await archiveNote(noteId);
    invalidateBriefingCache(existing.client_id);

    reply.redirect(`/clients/${encodeURIComponent(decoded)}/knowledge#notes`);
  });
};
