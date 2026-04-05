/**
 * Populate client services from Xero invoice line items.
 *
 * Reads recent invoices (last 12 months) per client from Xero,
 * extracts service descriptions from line items, normalises them
 * into standard service labels, and updates clients.services.
 *
 * Also enriches from source mappings (meta → Meta Ads, gads → Google Ads, etc.)
 *
 * Usage:
 *   npx tsx scripts/functions/populate-client-services.ts
 *   npx tsx scripts/functions/populate-client-services.ts --dry-run
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { getDb, initSchema, saveDb, closeDb, log, logError } from '../utils/db.js';
import { XeroClient } from '../utils/xero-client.js';

const DRY_RUN = process.argv.includes('--dry-run');

// --- Service normalisation ---

const SERVICE_PATTERNS: [RegExp, string][] = [
  // PPC / Paid Search
  [/google\s*ads|google\s*ppc|paid\s*search|search\s*ads|adwords|gads/i, 'Google Ads'],
  [/meta\s*ads|facebook\s*ads|fb\s*ads|instagram\s*ads|paid\s*social|social\s*ads/i, 'Meta Ads'],
  [/ppc|pay.per.click/i, 'PPC'],
  [/microsoft\s*ads|bing\s*ads/i, 'Microsoft Ads'],

  // SEO
  [/\bseo\b|search\s*engine\s*optim|organic\s*search|technical\s*seo|local\s*seo|link\s*building/i, 'SEO'],

  // Web / Design
  [/web\s*design|website|web\s*dev|landing\s*page|wordpress|shopify|woocommerce|ecommerce\s*dev/i, 'Web'],

  // Social Media Management
  [/social\s*media\s*manage|social\s*manage|content\s*creation|social\s*content|organic\s*social/i, 'Social'],

  // Content / Copywriting
  [/copywriting|content\s*writing|blog|article|content\s*market/i, 'Content'],

  // Email
  [/email\s*market|email\s*campaign|newsletter|mailchimp|klaviyo/i, 'Email'],

  // Creative / Video / Photography
  [/creative|video|photography|graphic\s*design|branding/i, 'Creative'],

  // Strategy / Consultancy
  [/strateg|consult|audit|review|workshop/i, 'Strategy'],

  // CRO
  [/cro|conversion\s*rate\s*optim/i, 'CRO'],

  // Retainer / Management fee patterns
  [/retainer|monthly\s*fee|management\s*fee|monthly\s*manage/i, 'Retainer'],
];

function extractServices(descriptions: string[]): string[] {
  const found = new Set<string>();

  for (const desc of descriptions) {
    for (const [pattern, label] of SERVICE_PATTERNS) {
      if (pattern.test(desc)) {
        found.add(label);
      }
    }
  }

  // Collapse: if we have both "PPC" and specific ad platforms, drop generic "PPC"
  if ((found.has('Google Ads') || found.has('Meta Ads')) && found.has('PPC')) {
    found.delete('PPC');
  }
  // If we only have "Retainer" and nothing specific, keep it; otherwise drop it
  if (found.size > 1 && found.has('Retainer')) {
    found.delete('Retainer');
  }

  return Array.from(found).sort();
}

function enrichFromSourceMappings(sources: string[]): string[] {
  const extra: string[] = [];
  if (sources.includes('meta')) extra.push('Meta Ads');
  if (sources.includes('gads')) extra.push('Google Ads');
  if (sources.includes('ga4') || sources.includes('gsc')) extra.push('SEO');
  return extra;
}

async function main() {
  await initSchema();
  const db = await getDb();

  log('SERVICES', DRY_RUN ? 'DRY RUN — no changes will be saved' : 'Populating client services...');

  // Get active canonical clients
  const clientResult = db.exec(`
    SELECT c.id, c.name, c.display_name, c.services,
           GROUP_CONCAT(DISTINCT csm.source) as linked_sources
    FROM clients c
    LEFT JOIN client_source_mappings csm ON csm.client_id = c.id
    WHERE c.status = 'active' AND c.display_name IS NOT NULL
    GROUP BY c.id
    ORDER BY c.display_name
  `);

  if (!clientResult.length || !clientResult[0].values.length) {
    log('SERVICES', 'No active clients found');
    closeDb();
    return;
  }

  // Also try to fetch line items from Xero for richer data
  let xeroLineItems: Map<string, string[]> = new Map();
  try {
    const xero = new XeroClient();
    log('SERVICES', 'Fetching Xero invoices with line items...');

    // Fetch last 12 months of invoices
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - 1);
    const cutoffStr = cutoff.toISOString();

    let page = 1;
    let totalInvoices = 0;
    while (true) {
      const resp = await xero.getInvoices({ page });
      if (!resp.Invoices.length) break;

      for (const inv of resp.Invoices) {
        if (inv.Type !== 'ACCREC') continue;
        const contactName = inv.Contact?.Name;
        if (!contactName) continue;

        if (inv.LineItems && inv.LineItems.length > 0) {
          const existing = xeroLineItems.get(contactName) || [];
          for (const li of inv.LineItems) {
            if (li.Description) existing.push(li.Description);
          }
          xeroLineItems.set(contactName, existing);
        }
      }

      totalInvoices += resp.Invoices.length;
      if (resp.Invoices.length < 100) break;
      page++;
    }
    log('SERVICES', `Fetched ${totalInvoices} invoices, ${xeroLineItems.size} clients with line items`);
  } catch (err) {
    log('SERVICES', `Xero fetch failed (will use source mappings only): ${err instanceof Error ? err.message : String(err)}`);
  }

  let updated = 0;
  let skipped = 0;

  for (const row of clientResult[0].values) {
    const [id, name, displayName, currentServices, linkedSourcesRaw] = row as [number, string, string | null, string | null, string | null];
    const linkedSources = (linkedSourcesRaw || '').split(',').filter(Boolean);

    // Collect service signals from Xero line items
    const xeroDescs = xeroLineItems.get(name) || [];
    const xeroServices = extractServices(xeroDescs);

    // Enrich from source mappings
    const mappingServices = enrichFromSourceMappings(linkedSources);

    // Merge both sets
    const allServices = new Set([...xeroServices, ...mappingServices]);

    if (allServices.size === 0) {
      log('SERVICES', `  ${displayName || name}: no services detected — skipping`);
      skipped++;
      continue;
    }

    const serviceStr = Array.from(allServices).sort().join(', ');

    if (currentServices === serviceStr) {
      log('SERVICES', `  ${displayName || name}: unchanged (${serviceStr})`);
      skipped++;
      continue;
    }

    log('SERVICES', `  ${displayName || name}: ${serviceStr}${currentServices ? ` (was: ${currentServices})` : ''}`);

    if (!DRY_RUN) {
      db.run('UPDATE clients SET services = ? WHERE id = ?', [serviceStr, id]);
      updated++;
    } else {
      updated++;
    }
  }

  if (!DRY_RUN) saveDb();
  log('SERVICES', `\nDone: ${updated} updated, ${skipped} unchanged`);
  closeDb();
}

main().catch(err => {
  logError('SERVICES', 'Failed', err);
  closeDb();
  process.exit(1);
});
