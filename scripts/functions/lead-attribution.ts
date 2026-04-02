/**
 * Lead Source Attribution Engine
 *
 * For each GHL opportunity, determine lead source via a waterfall,
 * detect treatment type, assign value, and map conversion status.
 * Results are upserted into the attributed_leads table.
 *
 * Usage:
 *   npm run leads:attribute              # attribute new leads only
 *   npm run leads:attribute:backfill     # process all GHL opportunities
 *   npm run leads:attribute:force        # re-attribute everything (overwrite)
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { getDb, initSchema, saveDb, closeDb, log, logError } from '../utils/db.js';

// --- Types ---

interface Attribution {
  source: string;
  method: string;
  confidence: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
}

interface TreatmentType {
  slug: string;
  label: string;
  default_value: number;
  keywords: string[];
}

interface GhlRow {
  id: string;
  name: string;
  monetary_value: number;
  pipeline_id: string;
  stage_id: string;
  status: string;
  source: string | null;
  contact_id: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  contact_tags: string | null;
  created_at: string;
}

// --- CLI flags ---

const args = process.argv.slice(2);
const backfill = args.includes('--backfill');
const force = args.includes('--force');

// --- Attribution waterfall ---

function parseUtmParams(source: string): Record<string, string> {
  const params: Record<string, string> = {};
  // Try to extract UTM params from query-string-style source fields
  const matches = source.matchAll(/(?:^|[&?])?(utm_\w+)=([^&\s]+)/gi);
  for (const m of matches) {
    params[m[1].toLowerCase()] = decodeURIComponent(m[2]).toLowerCase();
  }
  return params;
}

function attributeSource(source: string | null, contactTags: string[]): Attribution {
  const srcLower = (source || '').toLowerCase().trim();
  const tagsLower = contactTags.map(t => t.toLowerCase().trim());

  // 1. GCLID in contact tags or source
  if (srcLower.includes('gclid') || tagsLower.some(t => t.includes('gclid'))) {
    return { source: 'google_ads', method: 'gclid', confidence: 'high' };
  }

  // 2. FBCLID or facebook/fb in source
  if (srcLower.includes('fbclid')) {
    return { source: 'meta_ads', method: 'fbclid', confidence: 'high' };
  }
  if (/\bfacebook\b|\bfb\b/.test(srcLower) && srcLower.includes('clid')) {
    return { source: 'meta_ads', method: 'fbclid', confidence: 'high' };
  }

  // 3. UTM parameters
  if (srcLower.includes('utm_')) {
    const utm = parseUtmParams(source || '');
    const utmMedium = utm['utm_medium'] || '';
    const utmSource = utm['utm_source'] || '';
    const utmCampaign = utm['utm_campaign'] || '';

    let attributed: string;
    if (utmMedium === 'cpc' && utmSource.includes('google')) {
      attributed = 'google_ads';
    } else if (utmMedium === 'cpc' && utmSource.includes('facebook')) {
      attributed = 'meta_ads';
    } else if (utmMedium === 'organic') {
      attributed = 'organic';
    } else if (utmMedium === 'referral') {
      attributed = 'referral';
    } else {
      attributed = 'other';
    }

    return {
      source: attributed,
      method: 'utm',
      confidence: 'high',
      utmSource: utmSource || undefined,
      utmMedium: utmMedium || undefined,
      utmCampaign: utmCampaign || undefined,
    };
  }

  // 4. GHL source field text matching
  if (srcLower && srcLower !== '') {
    if (/\bgoogle\b|\bppc\b/.test(srcLower)) {
      return { source: 'google_ads', method: 'ghl_source', confidence: 'medium' };
    }
    if (/\bfacebook\b|\bmeta\b/.test(srcLower)) {
      return { source: 'meta_ads', method: 'ghl_source', confidence: 'medium' };
    }
    if (/\borganic\b|\bseo\b/.test(srcLower)) {
      return { source: 'organic', method: 'ghl_source', confidence: 'medium' };
    }
    if (/\breferral\b/.test(srcLower)) {
      return { source: 'referral', method: 'ghl_source', confidence: 'medium' };
    }
  }

  // 5. GHL contact tags matching
  if (tagsLower.some(t => t.includes('google ads'))) {
    return { source: 'google_ads', method: 'contact_tags', confidence: 'medium' };
  }
  if (tagsLower.some(t => t.includes('facebook ads'))) {
    return { source: 'meta_ads', method: 'contact_tags', confidence: 'medium' };
  }
  if (tagsLower.some(t => t.includes('organic'))) {
    return { source: 'organic', method: 'contact_tags', confidence: 'medium' };
  }

  // 6. Fallback
  return { source: 'direct', method: 'fallback', confidence: 'low' };
}

// --- Treatment type detection ---

function detectTreatment(
  treatments: TreatmentType[],
  oppName: string,
  contactTags: string[],
  pipelineName: string,
  stageName: string,
  utmCampaign?: string,
): TreatmentType | null {
  const searchTexts = [
    oppName,
    ...contactTags,
    pipelineName,
    stageName,
    utmCampaign || '',
  ].map(t => t.toLowerCase());

  for (const treatment of treatments) {
    for (const keyword of treatment.keywords) {
      const kw = keyword.toLowerCase();
      if (searchTexts.some(text => text.includes(kw))) {
        return treatment;
      }
    }
  }

  return null;
}

// --- Conversion status mapping ---

function mapConversionStatus(status: string, stageName: string): string {
  const st = status.toLowerCase();
  const sg = stageName.toLowerCase();

  if (st === 'won') return 'converted';
  if (st === 'lost' || st === 'abandoned') return 'lost';

  // open status — map by stage name
  if (/\bnew\b|\benquiry\b/.test(sg)) return 'lead';
  if (/\bqualified\b|\bcontacted\b/.test(sg)) return 'qualified';
  if (/\bbooked\b|\bappointment\b/.test(sg)) return 'booked';
  if (/\battended\b|\bconsult\b/.test(sg)) return 'attended';

  return 'lead'; // default for open without a recognised stage
}

// --- Main ---

async function main() {
  await initSchema();
  const db = await getDb();
  const now = new Date().toISOString();

  try {
    // Load treatment types
    const treatmentRows = db.exec('SELECT slug, label, default_value, keywords FROM treatment_types');
    const treatments: TreatmentType[] = [];
    if (treatmentRows.length > 0) {
      for (const row of treatmentRows[0].values) {
        treatments.push({
          slug: row[0] as string,
          label: row[1] as string,
          default_value: row[2] as number,
          keywords: JSON.parse((row[3] as string) || '[]'),
        });
      }
    }

    if (treatments.length === 0) {
      log('ATTR', 'No treatment types found — run npm run seed:treatments first');
    }

    // Load client-account mappings for GHL
    const camRows = db.exec(
      `SELECT client_id, client_name, platform_account_id FROM client_account_map WHERE platform = 'ghl'`
    );
    const clientMap = new Map<string, { clientId: number; clientName: string }>();
    if (camRows.length > 0) {
      for (const row of camRows[0].values) {
        clientMap.set(row[2] as string, {
          clientId: row[0] as number,
          clientName: row[1] as string,
        });
      }
    }

    // Build stage/pipeline lookup for names
    const stageRows = db.exec('SELECT id, name FROM ghl_stages');
    const stageNames = new Map<string, string>();
    if (stageRows.length > 0) {
      for (const row of stageRows[0].values) {
        stageNames.set(row[0] as string, row[1] as string);
      }
    }

    const pipelineRows = db.exec('SELECT id, name FROM ghl_pipelines');
    const pipelineNames = new Map<string, string>();
    if (pipelineRows.length > 0) {
      for (const row of pipelineRows[0].values) {
        pipelineNames.set(row[0] as string, row[1] as string);
      }
    }

    // Determine which opportunities to process
    let query: string;
    if (backfill || force) {
      // All opportunities (optionally from last 6 months for backfill)
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      query = backfill
        ? `SELECT id, name, monetary_value, pipeline_id, stage_id, status, source,
                  contact_id, contact_name, contact_email, contact_phone, contact_tags, created_at
           FROM ghl_opportunities
           WHERE created_at >= '${sixMonthsAgo.toISOString()}'
           ORDER BY created_at DESC`
        : `SELECT id, name, monetary_value, pipeline_id, stage_id, status, source,
                  contact_id, contact_name, contact_email, contact_phone, contact_tags, created_at
           FROM ghl_opportunities
           ORDER BY created_at DESC`;
    } else {
      // Only opportunities not yet attributed
      query = `SELECT o.id, o.name, o.monetary_value, o.pipeline_id, o.stage_id, o.status, o.source,
                      o.contact_id, o.contact_name, o.contact_email, o.contact_phone, o.contact_tags, o.created_at
               FROM ghl_opportunities o
               LEFT JOIN attributed_leads al ON o.id = al.ghl_opportunity_id
               WHERE al.id IS NULL
               ORDER BY o.created_at DESC`;
    }

    const oppResult = db.exec(query);
    const opportunities: GhlRow[] = [];
    if (oppResult.length > 0) {
      for (const row of oppResult[0].values) {
        opportunities.push({
          id: row[0] as string,
          name: (row[1] as string) || '',
          monetary_value: (row[2] as number) || 0,
          pipeline_id: row[3] as string,
          stage_id: row[4] as string,
          status: (row[5] as string) || 'open',
          source: row[6] as string | null,
          contact_id: row[7] as string | null,
          contact_name: row[8] as string | null,
          contact_email: row[9] as string | null,
          contact_phone: row[10] as string | null,
          contact_tags: row[11] as string | null,
          created_at: (row[12] as string) || now,
        });
      }
    }

    log('ATTR', `Found ${opportunities.length} opportunities to process`);

    // Track existing attributed leads for skip counting
    const existingIds = new Set<string>();
    if (!force) {
      const existingResult = db.exec('SELECT ghl_opportunity_id FROM attributed_leads');
      if (existingResult.length > 0) {
        for (const row of existingResult[0].values) {
          existingIds.add(row[0] as string);
        }
      }
    }

    let attributed = 0;
    let skipped = 0;
    const sourceCounts: Record<string, number> = {};

    for (const opp of opportunities) {
      // Skip if already attributed (and not --force)
      if (!force && existingIds.has(opp.id)) {
        skipped++;
        continue;
      }

      // Parse contact tags
      let contactTags: string[] = [];
      if (opp.contact_tags) {
        try {
          contactTags = JSON.parse(opp.contact_tags);
          if (!Array.isArray(contactTags)) contactTags = [];
        } catch {
          contactTags = [];
        }
      }

      // Look up client via client_account_map
      // GHL opportunities are all from the same location, so we match on LOCATION_ID
      // or fall back to pipeline_id matching
      let clientId = 0;
      let clientName = 'Unknown';

      // Try matching by GHL location (from env) first, then by pipeline_id
      const locationId = process.env.GHL_LOCATION_ID || '';
      const clientEntry = clientMap.get(locationId) || clientMap.get(opp.pipeline_id);
      if (clientEntry) {
        clientId = clientEntry.clientId;
        clientName = clientEntry.clientName;
      }

      // Run attribution waterfall
      const attribution = attributeSource(opp.source, contactTags);

      // Look up stage and pipeline names
      const stageName = stageNames.get(opp.stage_id) || '';
      const pipelineName = pipelineNames.get(opp.pipeline_id) || '';

      // Detect treatment type
      const treatment = detectTreatment(
        treatments,
        opp.name,
        contactTags,
        pipelineName,
        stageName,
        attribution.utmCampaign,
      );
      const treatmentSlug = treatment?.slug || 'general';

      // Assign treatment value
      const treatmentValue = opp.monetary_value > 0
        ? opp.monetary_value
        : (treatment?.default_value || 250);

      // Map conversion status
      const conversionStatus = mapConversionStatus(opp.status, stageName);

      // Determine timestamps
      const qualifiedAt = ['qualified', 'booked', 'attended', 'converted'].includes(conversionStatus)
        ? opp.created_at : null;
      const convertedAt = conversionStatus === 'converted' ? opp.created_at : null;

      // Upsert into attributed_leads
      db.run(`
        INSERT OR REPLACE INTO attributed_leads
        (ghl_opportunity_id, client_id, client_name, contact_name, contact_email, contact_phone,
         attributed_source, attribution_method, attribution_confidence,
         utm_source, utm_medium, utm_campaign, landing_page,
         treatment_type, treatment_value, conversion_status,
         lead_date, qualified_at, converted_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        opp.id, clientId, clientName,
        opp.contact_name, opp.contact_email, opp.contact_phone,
        attribution.source, attribution.method, attribution.confidence,
        attribution.utmSource || null, attribution.utmMedium || null,
        attribution.utmCampaign || null, null,
        treatmentSlug, treatmentValue, conversionStatus,
        opp.created_at, qualifiedAt, convertedAt,
        now, now,
      ]);

      attributed++;
      sourceCounts[attribution.source] = (sourceCounts[attribution.source] || 0) + 1;
    }

    saveDb();

    // Summary
    log('ATTR', `Attribution complete: ${attributed} leads attributed, ${skipped} skipped`);
    if (Object.keys(sourceCounts).length > 0) {
      log('ATTR', 'Breakdown by source:');
      for (const [source, count] of Object.entries(sourceCounts).sort((a, b) => b[1] - a[1])) {
        log('ATTR', `  ${source}: ${count}`);
      }
    }
  } catch (err) {
    logError('ATTR', 'Attribution failed', err);
    process.exit(1);
  } finally {
    closeDb();
  }
}

main();
