import { config } from 'dotenv';
config({ path: '.env.local' });

import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '../..');

const BASE_URL = 'https://services.leadconnectorhq.com';
const API_KEY = process.env.GHL_API_KEY!;
const LOCATION_ID = process.env.GHL_LOCATION_ID!;

if (!API_KEY || !LOCATION_ID) {
  console.error('GHL_API_KEY and GHL_LOCATION_ID must be set in .env.local');
  process.exit(1);
}

const headers: Record<string, string> = {
  'Authorization': `Bearer ${API_KEY}`,
  'Version': '2021-07-28',
  'Content-Type': 'application/json',
};

async function ghlFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : `${BASE_URL}${path}`;
  const resp = await fetch(url, { headers });
  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(`GHL ${resp.status}: ${body.slice(0, 200)}`);
  }
  return resp.json() as Promise<T>;
}

interface GhlOpportunity {
  id: string;
  name: string;
  monetaryValue: number;
  pipelineId: string;
  pipelineStageId: string;
  status: string;
  source: string;
  createdAt: string;
  updatedAt: string;
  lastStageChangeAt: string;
  contactId: string;
  contact: {
    id: string;
    name: string;
    companyName: string;
    email: string;
    phone: string;
    tags: string[];
  };
  attributions?: Array<{
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    utmSessionSource?: string;
    utmContent?: string;
    utmTerm?: string;
    utmKeyword?: string;
    pageUrl?: string;
  }>;
}

async function fetchAllOpportunities(pipelineId: string): Promise<GhlOpportunity[]> {
  const all: GhlOpportunity[] = [];
  let startAfterId = '';
  let startAfter = '';

  while (true) {
    let url = `${BASE_URL}/opportunities/search?location_id=${LOCATION_ID}&pipeline_id=${pipelineId}&limit=100`;
    if (startAfterId) {
      url += `&startAfterId=${startAfterId}&startAfter=${startAfter}`;
    }

    const data = await ghlFetch<{ opportunities: GhlOpportunity[]; meta: { startAfterId?: string; startAfter?: number; total: number } }>(url);
    all.push(...data.opportunities);
    console.log(`  Fetched ${all.length}/${data.meta.total} opportunities`);

    if (!data.meta.startAfterId || data.opportunities.length === 0) break;
    startAfterId = data.meta.startAfterId;
    startAfter = String(data.meta.startAfter || '');
  }

  return all;
}

async function fetchContacts(page = 1, pageLimit = 100): Promise<{ contacts: any[]; total: number }> {
  const resp = await fetch(`${BASE_URL}/contacts/search`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ locationId: LOCATION_ID, page, pageLimit }),
  });
  if (!resp.ok) throw new Error(`GHL contacts ${resp.status}`);
  return resp.json() as any;
}

async function main() {
  console.log('Fetching GHL data...\n');

  // 1. Pipelines
  console.log('=== Pipelines ===');
  const pipelines = await ghlFetch<{ pipelines: any[] }>(`/opportunities/pipelines?locationId=${LOCATION_ID}`);
  for (const p of pipelines.pipelines) {
    console.log(`  ${p.name} (${p.stages.length} stages)`);
  }

  // 2. All opportunities from agency pipeline
  console.log('\n=== Agency Pipeline Opportunities ===');
  const agencyOpps = await fetchAllOpportunities('uXxZnfFFP4AKrKDYoHEW');

  // 3. E-commerce pipeline
  console.log('\n=== E-commerce Pipeline Opportunities ===');
  const ecomOpps = await fetchAllOpportunities('aa9er9DL4NtposfxWXtX');

  // 4. Contact count
  console.log('\n=== Contacts ===');
  const contactData = await fetchContacts(1, 1);
  console.log(`  Total contacts: ${contactData.total}`);

  // Save raw data
  const snapshot = {
    fetchedAt: new Date().toISOString(),
    pipelines: pipelines.pipelines,
    opportunities: {
      agency: agencyOpps,
      ecommerce: ecomOpps,
    },
    contactsTotal: contactData.total,
  };

  writeFileSync(resolve(PROJECT_ROOT, 'data/ghl-snapshot.json'), JSON.stringify(snapshot, null, 2));
  console.log('\nSnapshot saved to data/ghl-snapshot.json');

  // Analysis
  const stageNames: Record<string, string> = {};
  for (const p of pipelines.pipelines) {
    for (const s of p.stages) {
      stageNames[s.id] = s.name;
    }
  }

  const allOpps = [...agencyOpps, ...ecomOpps];
  console.log(`\n${'='.repeat(50)}`);
  console.log(`PIPELINE SUMMARY — ${allOpps.length} total opportunities`);
  console.log('='.repeat(50));

  // By status
  const byStatus: Record<string, number> = {};
  for (const o of allOpps) byStatus[o.status] = (byStatus[o.status] || 0) + 1;
  console.log('\nBy status:');
  for (const [s, c] of Object.entries(byStatus).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${s}: ${c}`);
  }

  // By stage
  const byStage: Record<string, { count: number; value: number }> = {};
  for (const o of allOpps) {
    const stage = stageNames[o.pipelineStageId] || '?';
    if (!byStage[stage]) byStage[stage] = { count: 0, value: 0 };
    byStage[stage].count++;
    byStage[stage].value += o.monetaryValue || 0;
  }
  console.log('\nBy stage:');
  for (const [s, d] of Object.entries(byStage).sort((a, b) => b[1].count - a[1].count)) {
    console.log(`  ${s}: ${d.count} (£${d.value.toLocaleString()})`);
  }

  // By source
  const bySource: Record<string, number> = {};
  for (const o of allOpps) bySource[o.source || '(none)'] = (bySource[o.source || '(none)'] || 0) + 1;
  console.log('\nBy source:');
  for (const [s, c] of Object.entries(bySource).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${s}: ${c}`);
  }

  // Won deals
  const won = allOpps.filter(o => o.status === 'won');
  console.log(`\n=== WON DEALS (${won.length}) ===`);
  for (const o of won.sort((a, b) => b.createdAt.localeCompare(a.createdAt))) {
    const company = o.contact?.companyName || '';
    console.log(`  ${o.createdAt.slice(0, 10)} | ${o.name.padEnd(30)} | ${company.padEnd(25)} | £${(o.monetaryValue || 0).toLocaleString()} | ${o.source}`);
  }

  // Active by stage
  const active = allOpps.filter(o => o.status === 'open');
  const totalActiveValue = active.reduce((s, o) => s + (o.monetaryValue || 0), 0);
  console.log(`\n=== ACTIVE PIPELINE (${active.length} deals, £${totalActiveValue.toLocaleString()}) ===`);

  for (const stage of ['Proposal Sent', 'Call Booked', 'Loom/Email Sent', 'Enquiry']) {
    const inStage = active.filter(o => stageNames[o.pipelineStageId] === stage);
    if (!inStage.length) continue;
    const stageVal = inStage.reduce((s, o) => s + (o.monetaryValue || 0), 0);
    console.log(`\n  ${stage} (${inStage.length} deals, £${stageVal.toLocaleString()}):`);
    for (const o of inStage.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 15)) {
      const company = o.contact?.companyName || '';
      console.log(`    ${o.createdAt.slice(0, 10)} | ${o.name.padEnd(25)} | ${company.padEnd(25)} | £${(o.monetaryValue || 0).toLocaleString()} | ${o.source}`);
    }
    if (inStage.length > 15) console.log(`    ... +${inStage.length - 15} more`);
  }

  // Monthly trend
  const monthly: Record<string, number> = {};
  for (const o of allOpps) {
    const m = o.createdAt?.slice(0, 7);
    if (m) monthly[m] = (monthly[m] || 0) + 1;
  }
  console.log('\n=== MONTHLY OPPORTUNITY CREATION ===');
  for (const m of Object.keys(monthly).sort()) {
    console.log(`  ${m}: ${monthly[m]}`);
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
