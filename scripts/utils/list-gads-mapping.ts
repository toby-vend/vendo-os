/**
 * One-off: list Google Ads accounts, current mapping state, and active Vendo
 * clients to help bulk-map the two together.
 *
 * Usage: npx tsx --env-file=.env.local scripts/utils/list-gads-mapping.ts
 */
import { rows } from '../../web/lib/queries/base.js';

interface GadsAccount {
  id: string;
  descriptive_name: string;
  currency_code: string;
  status: string;
}
interface Client {
  id: number;
  name: string;
  display_name: string | null;
  status: string | null;
}

function normalise(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b(ltd|limited|llc|inc|plc|llp|gmbh|the|group|holdings|holding|co|company|services|digital|marketing|agency|clinic|practice|dental|dentistry|implants)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(s: string): Set<string> {
  return new Set(normalise(s).split(' ').filter(t => t.length > 1));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let intersect = 0;
  for (const t of a) if (b.has(t)) intersect++;
  const union = a.size + b.size - intersect;
  return intersect / union;
}

const accounts = await rows<GadsAccount>(
  `SELECT id, descriptive_name, currency_code, status FROM gads_accounts WHERE status = 'ENABLED' ORDER BY descriptive_name`,
);
const mappedRows = await rows<{ gads_customer_id: string; client_id: number }>(
  `SELECT gads_customer_id, client_id FROM gads_account_client_map`,
);
const mapped = new Map(mappedRows.map(m => [m.gads_customer_id, m.client_id]));

const clients = await rows<Client>(
  `SELECT id, name, display_name, status FROM clients WHERE (status IS NULL OR status = 'active') ORDER BY name`,
);

console.log(`Google Ads accounts (ENABLED): ${accounts.length}`);
console.log(`Already mapped: ${mapped.size}`);
console.log(`Active Vendo clients: ${clients.length}`);
console.log('');

const clientTokens = clients.map(c => ({
  client: c,
  tokens: tokens(c.display_name || c.name),
}));

const unmapped = accounts.filter(a => !mapped.has(a.id));
console.log(`=== Unmapped accounts (${unmapped.length}) — best-match suggestions ===`);
console.log('');

interface Row {
  gads_id: string;
  gads_name: string;
  currency: string;
  suggestion_id: number | null;
  suggestion_name: string | null;
  confidence: number;
  runner_ups: Array<{ id: number; name: string; score: number }>;
}

const results: Row[] = [];
for (const acc of unmapped) {
  const aTok = tokens(acc.descriptive_name);
  const scored = clientTokens
    .map(ct => ({ id: ct.client.id, name: ct.client.display_name || ct.client.name, score: jaccard(aTok, ct.tokens) }))
    .sort((x, y) => y.score - x.score)
    .slice(0, 3);
  const top = scored[0];
  results.push({
    gads_id: acc.id,
    gads_name: acc.descriptive_name,
    currency: acc.currency_code,
    suggestion_id: top && top.score > 0 ? top.id : null,
    suggestion_name: top && top.score > 0 ? top.name : null,
    confidence: top?.score ?? 0,
    runner_ups: scored.slice(1).filter(s => s.score > 0),
  });
}

results.sort((a, b) => b.confidence - a.confidence);

for (const r of results) {
  const conf = r.confidence >= 0.6 ? 'HIGH' : r.confidence >= 0.35 ? 'MED ' : r.confidence > 0 ? 'LOW ' : 'NONE';
  const sugg = r.suggestion_id ? `→ client ${r.suggestion_id}: ${r.suggestion_name}` : '→ (no match)';
  console.log(`[${conf} ${(r.confidence * 100).toFixed(0)}%]  ${r.gads_id}  ${r.gads_name.padEnd(45)}  ${sugg}`);
  for (const ru of r.runner_ups) {
    console.log(`                                                                            also: ${ru.id}: ${ru.name} (${(ru.score * 100).toFixed(0)}%)`);
  }
}

// Write a CSV for quick review/edit
const fs = await import('fs/promises');
const csv = ['gads_customer_id,gads_name,currency,suggested_client_id,suggested_client_name,confidence,action'];
for (const r of results) {
  const action = r.confidence >= 0.6 ? 'APPLY' : 'REVIEW';
  csv.push(`${r.gads_id},"${r.gads_name.replace(/"/g, '""')}",${r.currency},${r.suggestion_id ?? ''},"${(r.suggestion_name ?? '').replace(/"/g, '""')}",${r.confidence.toFixed(3)},${action}`);
}
const outPath = '/tmp/gads-mapping-suggestions.csv';
await fs.writeFile(outPath, csv.join('\n'));
console.log('');
console.log(`Wrote CSV: ${outPath}`);
console.log('');
console.log('Counts by confidence:');
console.log(`  HIGH (≥60%): ${results.filter(r => r.confidence >= 0.6).length}`);
console.log(`  MED  (35-59%): ${results.filter(r => r.confidence >= 0.35 && r.confidence < 0.6).length}`);
console.log(`  LOW  (<35%): ${results.filter(r => r.confidence > 0 && r.confidence < 0.35).length}`);
console.log(`  NONE: ${results.filter(r => r.confidence === 0).length}`);
