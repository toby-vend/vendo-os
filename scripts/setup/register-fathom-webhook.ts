/**
 * Register a webhook with Fathom so new recordings automatically sync.
 *
 * Usage:
 *   npx tsx scripts/setup/register-fathom-webhook.ts
 *
 * Env vars (from .env.local):
 *   FATHOM_API_KEY         — your Fathom API key
 *   FATHOM_WEBHOOK_SECRET  — shared secret for validating inbound webhooks
 *   VERCEL_PROJECT_URL     — e.g. vendo-os.vercel.app (no protocol)
 *
 * This registers a webhook at https://{VERCEL_PROJECT_URL}/api/fathom/webhook
 * that fires on recording completion events.
 *
 * Run this once per environment. Re-running is safe — it lists existing
 * webhooks so you can verify or delete stale ones.
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

const API_KEY = process.env.FATHOM_API_KEY;
const WEBHOOK_SECRET = process.env.FATHOM_WEBHOOK_SECRET;
const PROJECT_URL = process.env.VERCEL_PROJECT_URL;

if (!API_KEY) { console.error('FATHOM_API_KEY not set'); process.exit(1); }
if (!WEBHOOK_SECRET) { console.error('FATHOM_WEBHOOK_SECRET not set'); process.exit(1); }
if (!PROJECT_URL) { console.error('VERCEL_PROJECT_URL not set (e.g. vendo-os.vercel.app)'); process.exit(1); }

const BASE = 'https://api.fathom.ai/external/v1';
const WEBHOOK_URL = `https://${PROJECT_URL}/api/fathom/webhook`;

async function fathomFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'X-Api-Key': API_KEY!,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

async function main() {
  // List existing webhooks
  console.log('Checking existing webhooks...');
  const existing = await fathomFetch('/webhooks');
  if (existing?.items?.length) {
    console.log(`Found ${existing.items.length} existing webhook(s):`);
    for (const wh of existing.items) {
      console.log(`  - ${wh.url} (id: ${wh.id}, events: ${wh.events?.join(', ') || 'all'})`);
    }

    // Check if our URL is already registered
    const alreadyRegistered = existing.items.find((wh: any) => wh.url === WEBHOOK_URL);
    if (alreadyRegistered) {
      console.log(`\nWebhook already registered at ${WEBHOOK_URL} (id: ${alreadyRegistered.id})`);
      console.log('No action needed.');
      return;
    }
  } else {
    console.log('No existing webhooks found.');
  }

  // Register new webhook
  console.log(`\nRegistering webhook at ${WEBHOOK_URL}...`);
  const result = await fathomFetch('/webhooks', {
    method: 'POST',
    body: JSON.stringify({
      url: WEBHOOK_URL,
      secret: WEBHOOK_SECRET,
    }),
  });

  console.log('Webhook registered successfully!');
  console.log(`  ID: ${result?.id}`);
  console.log(`  URL: ${WEBHOOK_URL}`);
}

main().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
