/**
 * /creative-pipeline — run and review the Paid Social Agent's
 * persona-to-creative pipeline from the VendoOS UI.
 *
 * GET  /                 page: run form (gate fields), runs list, creative gallery
 * POST /run              start a headless claude run (form fields answer the gates)
 * GET  /runs/:id         JSON status + log tail (polled by the page)
 * GET  /image/:slug/:file  serve a rendered PNG from the brand's exports
 */
import type { FastifyPluginAsync } from 'fastify';
import fs from 'node:fs';
import {
  listBrands,
  listExports,
  exportPath,
  listRuns,
  getRun,
  readLogTail,
  startRun,
  isValidSlug,
  type RunRequest,
  type RunStage,
} from '../lib/creative-pipeline.js';

const STAGES: RunStage[] = ['full', 'research', 'concepts', 'creatives'];

export const creativePipelineRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (_request, reply) => {
    const brands = listBrands();
    const runs = listRuns().slice(0, 20);
    const galleries = brands
      .filter((b) => b.exportCount > 0)
      .slice(0, 8)
      .map((b) => ({ slug: b.slug, files: listExports(b.slug) }));
    reply.render('creative-pipeline', { brands, runs, galleries });
  });

  app.post('/run', async (request, reply) => {
    const body = request.body as Record<string, string>;
    const client = (body.client || '').trim();
    const websiteUrl = (body.websiteUrl || '').trim();
    const treatments = (body.treatments || '').trim();
    const prices = (body.prices || '').trim();
    const stage = (STAGES.includes(body.stage as RunStage) ? body.stage : 'full') as RunStage;

    if (!client && !websiteUrl) {
      reply.code(400).send({ error: 'Pick an existing client or provide a website URL.' });
      return;
    }
    if (client && !isValidSlug(client)) {
      reply.code(400).send({ error: 'Invalid client slug.' });
      return;
    }
    if (websiteUrl && !/^https?:\/\/[^\s]+$/.test(websiteUrl)) {
      reply.code(400).send({ error: 'Invalid website URL.' });
      return;
    }
    if (!treatments || !prices) {
      reply.code(400).send({ error: 'Both gates must be answered: treatments/offers and approved prices.' });
      return;
    }

    const req: RunRequest = {
      client,
      websiteUrl: websiteUrl || undefined,
      treatments,
      prices,
      stage,
      notes: (body.notes || '').trim() || undefined,
    };
    const rec = startRun(req);
    reply.send({ id: rec.id });
  });

  app.get('/runs/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const run = getRun(id);
    if (!run) {
      reply.code(404).send({ error: 'Run not found' });
      return;
    }
    reply.send({ ...run, log: readLogTail(id) });
  });

  app.get('/image/:slug/:file', async (request, reply) => {
    const { slug, file } = request.params as { slug: string; file: string };
    const p = exportPath(slug, file);
    if (!p) {
      reply.code(404).send('Not found');
      return;
    }
    reply.type('image/png').send(fs.createReadStream(p));
  });
};
