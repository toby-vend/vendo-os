/**
 * Import a Meta Ads Manager CSV export into meta_insights for a reporting
 * period — stop-gap while the Meta API sync (sync-meta-ads.ts, dead since
 * 2026-04-05) is down.
 *
 * The CSV is the account+campaign-level export ("Account name, Campaign name,
 * Currency, Amount spent, ..."). Campaign rows are inserted as single
 * month-total rows (level='campaign') dated mid-period so the existing report
 * aggregators (web/lib/reports/aggregators/meta.ts) pick them up unchanged.
 * Rows where Campaign name = "All" are used only to validate totals — except
 * when an account has no campaign rows at all, in which case the All row is
 * inserted as a single "All campaigns" row.
 *
 * Idempotent: re-running deletes previous rows for the same period marker
 * (campaign_id LIKE 'csv-<period>-%') before inserting.
 *
 * Usage:
 *   node --env-file=.env.local --import tsx/esm scripts/sync/import-meta-csv.ts \
 *     --csv ~/Downloads/meta_ads_combined.csv --period 2026-05
 */
import { readFileSync } from 'fs';

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

// ── account → client mapping (explicit; no fuzzy matching) ─────────────────
// account_id: real Meta account id where the account has synced before;
// synthetic 'csv:<slug>' id where it never has. legacy=true → campaign names
// get an "[Old account: …]" prefix so reports flag them as the pre-migration
// Ravensdale Group accounts.
interface AccountMap {
  client: string;          // exact clients.name in the DB
  accountId: string;
  legacy?: string;         // short label for legacy-account prefix
}
const ACCOUNTS: Record<string, AccountMap> = {
  'Access Platform Sales': { client: 'Access Platform Sales Limited (Access Platform Sales) (Monthly Services)', accountId: '621203064062735' },
  'ARC Dental Surgery': { client: 'Arc Dental Surgery', accountId: 'csv:arc-dental-surgery' },
  'Avenue Dental Practice': { client: 'BS bhandal limited / Avenue Dental', accountId: '1177032496465059' },
  'Billericay Dental Care': { client: 'SNC ASSOCIATES LIMITED - Billericay Dental', accountId: '2908124849253203' },
  'DK Dental Practice': { client: 'DK Dental Practice & Lab', accountId: 'csv:dk-dental-practice' },
  'Iconic Dent': { client: '​Iconic Dent Ltd', accountId: '412792813769193' },
  'Just Smile Dental': { client: 'Just Smile Dental Ltd', accountId: '1065258434856917' },
  'Kana Health Group Ad Account': { client: 'Kana Health Group', accountId: '974870937223229' },
  'Lakewood Dental': { client: 'Lakewood Dental', accountId: '2409236286126182' },
  'Lateral Dental Clinic Ad Account': { client: 'Lateral Dental Clinic Limited', accountId: '1022544875985857' },
  'MR Mouldings': { client: 'MR Mouldings (Monthly Services)', accountId: '1042500074014332' },
  'Ravensdale Dental Group': { client: 'Ravensdale Dental Group / Dentistry.ie', accountId: 'csv:ravensdale-dental-group' },
  'RDG - McEvoy Dental': { client: 'Ravensdale Dental Group / Dentistry.ie', accountId: '610217614003751', legacy: 'RDG - McEvoy Dental' },
  'RDG - Pearls Dental Castleknock': { client: 'Ravensdale Dental Group / Dentistry.ie', accountId: '1108431284669053', legacy: 'RDG - Pearls Dental Castleknock' },
  'RDG - Sundrive Dental': { client: 'Ravensdale Dental Group / Dentistry.ie', accountId: '578359420830356', legacy: 'RDG - Sundrive Dental' },
  'Rothley Lodge Dental Practice': { client: 'Rothley Lodge Dental Practice', accountId: '782790119857458' },
  'Signature Smiles': { client: 'Squat Practise Brackley / Signature Smiles / Asaiya Ltd', accountId: '1356394172720131' },
  'Smile For Life': { client: 'Smile for Life', accountId: 'csv:smile-for-life' },
  'Sone Marketing Ad Account': { client: 'Sone Marketing', accountId: 'csv:sone-marketing' },
  'St Clears Dental Studio': { client: 'St Clears Dental Studio', accountId: '1113588463490832' },
  'Stamford Dental Care': { client: 'Stamford Dental Care', accountId: '672916152133213' },
  'Studio Glide Pilates': { client: 'Studio Glide Limited', accountId: '1634566744569294' },
  'Swinnow Dental': { client: 'Swinnow Dental', accountId: '1537786620770998' },
  'The Sword Stall': { client: 'THE SWORD STALL UK LTD', accountId: '512057401615558' },
  'Thornbury Dental Wellness': { client: 'Thornbury Dental Wellness Clinic', accountId: '516850014217707' },
  'Thornley Park Dental 1.0': { client: 'Thornley Park Dental', accountId: '2348776995607794' },
  'VELTUFF UK': { client: 'Veltuff UK Limited', accountId: '496760751455236' },
  'Woodberry Down Dental': { client: 'Woodberry Down Dental Practice', accountId: 'csv:woodberry-down-dental' },
  'Zen House Dental': { client: 'Zen House Dental', accountId: '918564310390336' },
};
// Out of scope per Toby (2026-06-12): MK Smiles (inactive, Kana-owned),
// Squat Success (inactive client), Vendo Digital (internal account).
const SKIP = new Set(['MK Smiles ad Account', 'Squat Success Ad Account', 'Vendo Digital']);

const CURRENCY_MAP: Record<string, string> = { GBP: 'GBP', EUR: 'EUR', kr: 'DKK', DKK: 'DKK' };

interface CsvRow {
  account: string; campaign: string; currency: string;
  spend: number; purchaseValue: number | null; contentViews: number | null;
  leads: number | null; impressions: number; frequency: number | null;
  costPerPurchase: number | null; cpc: number | null; cpm: number | null; ctr: number | null;
}

function num(s: string): number | null {
  const v = parseFloat(s.replace(/[%£€]|kr\.?/g, '').trim());
  return Number.isFinite(v) ? v : null;
}

function parseCsv(path: string): CsvRow[] {
  const lines = readFileSync(path, 'utf8').split(/\r?\n/).filter(l => l.trim());
  const header = lines[0].split(',');
  if (header[0] !== 'Account name' || header[1] !== 'Campaign name') {
    throw new Error(`Unexpected CSV header: ${lines[0]}`);
  }
  return lines.slice(1).map(line => {
    const f = line.split(','); // export contains no quoted fields
    return {
      account: f[0].trim(),
      campaign: f[1].trim(),
      currency: f[2].trim(),
      spend: num(f[3]) ?? 0,
      purchaseValue: num(f[4]),
      contentViews: num(f[6]),
      leads: num(f[7]),
      impressions: num(f[9]) ?? 0,
      frequency: num(f[10]),
      costPerPurchase: num(f[11]),
      cpc: num(f[12]),
      cpm: num(f[13]),
      ctr: num(f[14]),
    };
  });
}

async function main() {
  const csvPath = arg('--csv');
  const period = arg('--period');
  if (!csvPath || !/^\d{4}-\d{2}$/.test(period ?? '')) {
    console.error('Usage: import-meta-csv.ts --csv <path> --period YYYY-MM');
    process.exit(1);
  }
  const midDate = `${period}-15`;
  const marker = `csv-${period}-`;

  const { db, rows } = await import('../../web/lib/queries/base.js');
  console.log(`DB target: ${process.env.TURSO_DATABASE_URL ? 'TURSO (production)' : 'local SQLite'}`);

  // Additive migration — the real sync should populate this too once fixed.
  try {
    await db.execute('ALTER TABLE meta_insights ADD COLUMN currency TEXT');
    console.log('Added meta_insights.currency column.');
  } catch { /* already exists */ }

  const all = parseCsv(csvPath);
  const skipped = [...new Set(all.filter(r => SKIP.has(r.account)).map(r => r.account))];
  const data = all.filter(r => !SKIP.has(r.account));
  const unmapped = [...new Set(data.map(r => r.account).filter(a => !ACCOUNTS[a]))];
  if (unmapped.length) {
    console.error(`Unmapped accounts in CSV — add them to ACCOUNTS first:\n  ${unmapped.join('\n  ')}`);
    process.exit(1);
  }
  console.log(`Skipping (out of scope): ${skipped.join(', ')}`);

  // Resolve client ids and ensure source mappings exist.
  const clientIds = new Map<string, number>(); // clients.name -> id
  for (const map of Object.values(ACCOUNTS)) {
    if (clientIds.has(map.client)) continue;
    const found = await rows<{ id: number }>('SELECT id FROM clients WHERE name = ?', [map.client]);
    if (!found.length) {
      console.error(`Client not found: "${map.client}"`);
      process.exit(1);
    }
    clientIds.set(map.client, found[0].id);
  }
  for (const [accountName, map] of Object.entries(ACCOUNTS)) {
    const clientId = clientIds.get(map.client)!;
    const existing = await rows<{ id: number; client_id: number }>(
      `SELECT id, client_id FROM client_source_mappings WHERE source = 'meta' AND external_id = ?`,
      [map.accountId],
    );
    if (!existing.length) {
      await db.execute({
        sql: `INSERT INTO client_source_mappings (client_id, source, external_id, external_name, created_at)
              VALUES (?, 'meta', ?, ?, datetime('now'))`,
        args: [clientId, map.accountId, accountName],
      });
      console.log(`Mapped ${accountName} (${map.accountId}) → client ${clientId} (${map.client})`);
    } else if (existing[0].client_id !== clientId) {
      console.error(`CONFLICT: ${accountName} (${map.accountId}) already mapped to client ${existing[0].client_id}, expected ${clientId}. Not touching it.`);
      process.exit(1);
    }
  }

  // Idempotent re-run: clear previous import for this period.
  const del = await db.execute({
    sql: `DELETE FROM meta_insights WHERE campaign_id LIKE ?`,
    args: [`${marker}%`],
  });
  if (del.rowsAffected) console.log(`Removed ${del.rowsAffected} rows from a previous import.`);

  // Group rows per account; campaigns preferred, All-row fallback.
  const byAccount = new Map<string, CsvRow[]>();
  for (const r of data) {
    if (!byAccount.has(r.account)) byAccount.set(r.account, []);
    byAccount.get(r.account)!.push(r);
  }

  const now = new Date().toISOString();
  let inserted = 0;
  for (const [accountName, accRows] of byAccount) {
    const map = ACCOUNTS[accountName];
    const allRow = accRows.find(r => r.campaign === 'All');
    let campaigns = accRows.filter(r => r.campaign !== 'All');
    if (!campaigns.length && allRow) {
      campaigns = [{ ...allRow, campaign: 'All campaigns' }];
    }

    // Reconcile against the account rollup — the export can exclude
    // sub-threshold campaigns from the breakdown. Insert the shortfall as a
    // remainder row so client totals match the account total.
    if (allRow && campaigns.length && campaigns[0].campaign !== 'All campaigns') {
      const sum = campaigns.reduce((s, c) => s + c.spend, 0);
      const diff = allRow.spend - sum;
      if (Math.abs(diff) > Math.max(1, allRow.spend * 0.02)) {
        console.warn(`WARN ${accountName}: campaign spend sum ${sum.toFixed(2)} vs account total ${allRow.spend.toFixed(2)} (diff ${diff.toFixed(2)})`);
        if (diff > 0) {
          const impSum = campaigns.reduce((s, c) => s + c.impressions, 0);
          const leadSum = campaigns.reduce((s, c) => s + (c.leads ?? 0), 0);
          const cvSum = campaigns.reduce((s, c) => s + (c.contentViews ?? 0), 0);
          const leadDiff = Math.max(0, (allRow.leads ?? 0) - leadSum);
          const cvDiff = Math.max(0, (allRow.contentViews ?? 0) - cvSum);
          campaigns = [...campaigns, {
            ...allRow,
            campaign: 'Other campaigns (not broken out in export)',
            spend: diff,
            impressions: Math.max(0, allRow.impressions - impSum),
            leads: leadDiff > 0 ? leadDiff : null,
            contentViews: cvDiff > 0 ? cvDiff : null,
            purchaseValue: null,
            costPerPurchase: null, frequency: null, ctr: null, cpm: null,
          }];
          console.log(`  → added remainder row for ${accountName}: ${diff.toFixed(2)} spend, ${leadDiff} leads, ${cvDiff} content views`);
        }
      }
    }

    let i = 0;
    for (const c of campaigns) {
      i += 1;
      const currency = CURRENCY_MAP[c.currency] ?? c.currency;
      const clicks = c.cpc && c.cpc > 0 ? Math.round(c.spend / c.cpc) : 0;
      const reach = c.frequency && c.frequency > 0 ? Math.round(c.impressions / c.frequency) : null;
      const purchases = c.costPerPurchase && c.costPerPurchase > 0 ? Math.round(c.spend / c.costPerPurchase) : null;
      const actions: Array<{ action_type: string; value: string }> = [];
      if (c.leads != null) actions.push({ action_type: 'lead', value: String(c.leads) });
      if (c.contentViews != null) actions.push({ action_type: 'view_content', value: String(c.contentViews) });
      const name = map.legacy ? `[Old account: ${map.legacy}] ${c.campaign}` : c.campaign;

      await db.execute({
        sql: `INSERT INTO meta_insights
                (date, account_id, account_name, level, campaign_id, campaign_name,
                 impressions, clicks, spend, cpc, cpm, ctr, reach, frequency,
                 conversions, conversion_values, actions, currency, synced_at)
              VALUES (?, ?, ?, 'campaign', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          midDate, map.accountId, accountName,
          `${marker}${map.accountId}-${i}`, name,
          c.impressions, clicks, c.spend, c.cpc, c.cpm, c.ctr, reach, c.frequency,
          purchases, c.purchaseValue, actions.length ? JSON.stringify(actions) : null,
          currency, now,
        ],
      });
      inserted += 1;
    }
  }
  console.log(`Inserted ${inserted} campaign rows dated ${midDate} (month totals, marker '${marker}').`);

  // Per-client spend summary for eyeballing against the CSV.
  const summary = await rows<{ client: string; spend: number; currency: string }>(
    `SELECT c.name AS client, ROUND(SUM(mi.spend), 2) AS spend, MAX(mi.currency) AS currency
       FROM meta_insights mi
       JOIN client_source_mappings csm ON csm.external_id = mi.account_id AND csm.source = 'meta'
       JOIN clients c ON c.id = csm.client_id
      WHERE mi.campaign_id LIKE ?
      GROUP BY c.name ORDER BY spend DESC`,
    [`${marker}%`],
  );
  for (const s of summary) console.log(`  ${s.client}: ${s.spend} ${s.currency}`);
}

main().catch(err => { console.error('import-meta-csv failed:', err); process.exit(1); });
