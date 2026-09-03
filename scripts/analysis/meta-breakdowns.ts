/**
 * Pull Meta Ads demographic (age/gender) and placement (platform/position/device)
 * breakdowns for one ad account over a trailing window.
 *
 * Usage:
 *   npx tsx scripts/analysis/meta-breakdowns.ts "Zen House Dental" [days=30]
 *   npx tsx scripts/analysis/meta-breakdowns.ts act_123456 [days=30]
 *
 * Account name is resolved against meta_ad_accounts in the local DB.
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { getDb, closeDb } from '../utils/db.js';

const API = 'https://graph.facebook.com/v21.0';
const FIELDS = 'impressions,reach,clicks,inline_link_clicks,spend,cpm,ctr,actions';

const token = process.env.META_ACCESS_TOKEN;
if (!token) { console.error('META_ACCESS_TOKEN missing'); process.exit(1); }

const target = process.argv[2];
if (!target) { console.error('Usage: meta-breakdowns.ts <account name | act_id> [days]'); process.exit(1); }
const days = parseInt(process.argv[3] || '30', 10);

const until = new Date(); until.setDate(until.getDate() - 1);
const since = new Date(until); since.setDate(since.getDate() - (days - 1));
const fmt = (d: Date) => d.toISOString().slice(0, 10);

async function resolveAccount(): Promise<{ id: string; name: string }> {
  if (target.startsWith('act_')) return { id: target, name: target };
  const db = await getDb();
  const res = db.exec('SELECT id, name FROM meta_ad_accounts WHERE lower(name) LIKE ?', [`%${target.toLowerCase()}%`]);
  closeDb();
  const rows = res[0]?.values ?? [];
  if (rows.length !== 1) {
    console.error(`Expected 1 account match for "${target}", got ${rows.length}: ${rows.map(r => r[1]).join(', ')}`);
    process.exit(1);
  }
  return { id: rows[0][0] as string, name: rows[0][1] as string };
}

async function pull(accountId: string, breakdowns: string): Promise<any[]> {
  const rows: any[] = [];
  let url = `${API}/${accountId}/insights?fields=${FIELDS}&breakdowns=${breakdowns}&level=account&time_range={"since":"${fmt(since)}","until":"${fmt(until)}"}&limit=500`;
  while (url) {
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
    const j = await r.json();
    rows.push(...j.data);
    url = j.paging?.next || '';
  }
  return rows;
}

function act(row: any, ...types: string[]): number {
  for (const t of types) {
    const a = (row.actions || []).find((x: any) => x.action_type === t);
    if (a) return parseFloat(a.value);
  }
  return 0;
}

function summarise(rows: any[], keys: string[]) {
  return rows.map(r => ({
    ...Object.fromEntries(keys.map(k => [k, r[k]])),
    spend: +parseFloat(r.spend).toFixed(2),
    impressions: +r.impressions,
    reach: +r.reach,
    link_clicks: +(r.inline_link_clicks || 0),
    ctr: +parseFloat(r.ctr || '0').toFixed(2),
    cpm: +parseFloat(r.cpm || '0').toFixed(2),
    leads: act(r, 'lead', 'onsite_conversion.lead_grouped'),
    lpv: act(r, 'landing_page_view'),
    engagement: act(r, 'post_engagement'),
    reactions: act(r, 'post_reaction'),
    comments: act(r, 'comment'),
    view_content: act(r, 'view_content', 'omni_view_content'),
  })).sort((a, b) => b.spend - a.spend);
}

(async () => {
  const acct = await resolveAccount();
  console.log(JSON.stringify({ account: acct, since: fmt(since), until: fmt(until) }));

  const ag = await pull(acct.id, 'age,gender');
  console.log('\nAGE_GENDER');
  console.table(summarise(ag, ['age', 'gender']));

  const pp = await pull(acct.id, 'publisher_platform,platform_position,device_platform');
  console.log('\nPLACEMENT');
  console.table(summarise(pp, ['publisher_platform', 'platform_position', 'device_platform']));

  const types = new Set<string>();
  for (const r of [...ag, ...pp]) for (const a of r.actions || []) types.add(a.action_type);
  console.log('\nACTION_TYPES', [...types].sort().join(', '));
})().catch(e => { console.error(e); process.exit(1); });
