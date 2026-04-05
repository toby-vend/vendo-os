import { rows, scalar, db } from './base.js';

// --- Interfaces ---

export interface AdminClientRow {
  id: number;
  name: string;
  display_name: string | null;
  label: string;
  email: string | null;
  vertical: string | null;
  status: string;
  aliases: string | null;
  total_invoiced: number;
  outstanding: number;
  meeting_count: number;
  meta_count: number;
  gads_count: number;
  asana_count: number;
  ghl_count: number;
  harvest_count: number;
  am: string | null;
  cm: string | null;
  services: string | null;
  contract_start: string | null;
  contract_end: string | null;
  mrr: number | null;
}

export interface SourceMapping {
  id: number;
  client_id: number;
  source: string;
  external_id: string;
  external_name: string | null;
  created_at: string;
}

export interface UnlinkedAccount {
  external_id: string;
  external_name: string | null;
}

// --- Admin queries ---

export async function getAllClientsAdmin(): Promise<AdminClientRow[]> {
  return rows<AdminClientRow>(`
    SELECT c.id, c.name, c.display_name,
           COALESCE(c.display_name, c.name) as label,
           c.email, c.vertical, c.status, c.aliases,
           c.total_invoiced, c.outstanding, c.meeting_count,
           c.am, c.cm, c.services, c.contract_start, c.contract_end, c.mrr,
           (SELECT COUNT(*) FROM client_source_mappings WHERE client_id = c.id AND source = 'meta') as meta_count,
           (SELECT COUNT(*) FROM client_source_mappings WHERE client_id = c.id AND source = 'gads') as gads_count,
           (SELECT COUNT(*) FROM client_source_mappings WHERE client_id = c.id AND source = 'asana') as asana_count,
           (SELECT COUNT(*) FROM client_source_mappings WHERE client_id = c.id AND source = 'ghl') as ghl_count,
           (SELECT COUNT(*) FROM client_source_mappings WHERE client_id = c.id AND source = 'harvest') as harvest_count
    FROM clients c
    ORDER BY COALESCE(c.display_name, c.name) COLLATE NOCASE
  `);
}

export async function getAdminClientDetail(clientId: number): Promise<{ client: AdminClientRow | null; mappings: SourceMapping[] }> {
  const clients = await rows<AdminClientRow>(`
    SELECT c.id, c.name, c.display_name,
           COALESCE(c.display_name, c.name) as label,
           c.email, c.vertical, c.status, c.aliases,
           c.total_invoiced, c.outstanding, c.meeting_count,
           c.am, c.cm, c.services, c.contract_start, c.contract_end, c.mrr,
           (SELECT COUNT(*) FROM client_source_mappings WHERE client_id = c.id AND source = 'meta') as meta_count,
           (SELECT COUNT(*) FROM client_source_mappings WHERE client_id = c.id AND source = 'gads') as gads_count,
           (SELECT COUNT(*) FROM client_source_mappings WHERE client_id = c.id AND source = 'asana') as asana_count,
           (SELECT COUNT(*) FROM client_source_mappings WHERE client_id = c.id AND source = 'ghl') as ghl_count,
           (SELECT COUNT(*) FROM client_source_mappings WHERE client_id = c.id AND source = 'harvest') as harvest_count
    FROM clients c WHERE c.id = ?
  `, [clientId]);
  const client = clients[0] ?? null;
  if (!client) return { client: null, mappings: [] };

  const mappings = await rows<SourceMapping>(
    'SELECT id, client_id, source, external_id, external_name, created_at FROM client_source_mappings WHERE client_id = ? ORDER BY source, external_name',
    [clientId],
  );

  return { client, mappings };
}

export async function updateClientDisplay(
  clientId: number,
  fields: {
    display_name?: string; vertical?: string; status?: string; aliases?: string;
    am?: string; cm?: string; services?: string; contract_start?: string; contract_end?: string; mrr?: number | null;
  },
): Promise<void> {
  const sets: string[] = [];
  const args: (string | number | null)[] = [];

  if (fields.display_name !== undefined) {
    sets.push('display_name = ?');
    args.push(fields.display_name || null);
  }
  if (fields.vertical !== undefined) {
    sets.push('vertical = ?');
    args.push(fields.vertical || null);
  }
  if (fields.status !== undefined) {
    sets.push('status = ?');
    args.push(fields.status);
  }
  if (fields.aliases !== undefined) {
    sets.push('aliases = ?');
    args.push(fields.aliases || null);
  }
  if (fields.am !== undefined) {
    sets.push('am = ?');
    args.push(fields.am || null);
  }
  if (fields.cm !== undefined) {
    sets.push('cm = ?');
    args.push(fields.cm || null);
  }
  if (fields.services !== undefined) {
    sets.push('services = ?');
    args.push(fields.services || null);
  }
  if (fields.contract_start !== undefined) {
    sets.push('contract_start = ?');
    args.push(fields.contract_start || null);
  }
  if (fields.contract_end !== undefined) {
    sets.push('contract_end = ?');
    args.push(fields.contract_end || null);
  }
  if (fields.mrr !== undefined) {
    sets.push('mrr = ?');
    args.push(fields.mrr ?? null);
  }

  if (sets.length === 0) return;
  args.push(clientId);
  await db.execute({ sql: `UPDATE clients SET ${sets.join(', ')} WHERE id = ?`, args });
}

export async function addSourceMapping(
  clientId: number,
  source: string,
  externalId: string,
  externalName: string,
): Promise<void> {
  await db.execute({
    sql: 'INSERT INTO client_source_mappings (client_id, source, external_id, external_name, created_at) VALUES (?, ?, ?, ?, ?)',
    args: [clientId, source, externalId, externalName, new Date().toISOString()],
  });
}

export async function removeSourceMapping(mappingId: number): Promise<void> {
  await db.execute({ sql: 'DELETE FROM client_source_mappings WHERE id = ?', args: [mappingId] });
}

// --- Unlinked accounts ---

export async function getUnlinkedMetaAccounts(): Promise<UnlinkedAccount[]> {
  return rows<UnlinkedAccount>(`
    SELECT DISTINCT account_id as external_id, account_name as external_name
    FROM meta_insights
    WHERE account_id NOT IN (SELECT external_id FROM client_source_mappings WHERE source = 'meta')
      AND account_name IS NOT NULL
    ORDER BY account_name
  `);
}

export async function getUnlinkedGadsAccounts(): Promise<UnlinkedAccount[]> {
  return rows<UnlinkedAccount>(`
    SELECT DISTINCT account_id as external_id, account_name as external_name
    FROM gads_campaign_spend
    WHERE account_id NOT IN (SELECT external_id FROM client_source_mappings WHERE source = 'gads')
      AND account_name IS NOT NULL
    ORDER BY account_name
  `);
}

export async function getUnlinkedAsanaProjects(): Promise<UnlinkedAccount[]> {
  return rows<UnlinkedAccount>(`
    SELECT DISTINCT project_gid as external_id, project_name as external_name
    FROM asana_tasks
    WHERE project_gid NOT IN (SELECT external_id FROM client_source_mappings WHERE source = 'asana')
      AND project_gid IS NOT NULL
    ORDER BY project_name
  `);
}

export async function getUnlinkedGhlCompanies(): Promise<UnlinkedAccount[]> {
  return rows<UnlinkedAccount>(`
    SELECT DISTINCT contact_company as external_id, contact_company as external_name
    FROM ghl_opportunities
    WHERE contact_company NOT IN (SELECT external_id FROM client_source_mappings WHERE source = 'ghl')
      AND contact_company IS NOT NULL AND contact_company != ''
    ORDER BY contact_company
  `);
}

export async function getUnlinkedHarvestClients(): Promise<UnlinkedAccount[]> {
  try {
    return await rows<UnlinkedAccount>(`
      SELECT DISTINCT CAST(id AS TEXT) as external_id, name as external_name
      FROM harvest_clients
      WHERE CAST(id AS TEXT) NOT IN (SELECT external_id FROM client_source_mappings WHERE source = 'harvest')
        AND name IS NOT NULL
      ORDER BY name
    `);
  } catch { return []; }
}

export async function getUnlinkedGa4Properties(): Promise<UnlinkedAccount[]> {
  try {
    return await rows<UnlinkedAccount>(`
      SELECT id as external_id, display_name as external_name
      FROM ga4_properties
      WHERE id NOT IN (SELECT external_id FROM client_source_mappings WHERE source = 'ga4')
        AND display_name IS NOT NULL
      ORDER BY display_name
    `);
  } catch { return []; }
}

export async function getUnlinkedGscSites(): Promise<UnlinkedAccount[]> {
  try {
    return await rows<UnlinkedAccount>(`
      SELECT id as external_id, id as external_name
      FROM gsc_sites
      WHERE id NOT IN (SELECT external_id FROM client_source_mappings WHERE source = 'gsc')
      ORDER BY id
    `);
  } catch { return []; }
}

// --- Enriched detail (cross-source data for public detail page) ---

interface MetaSpendRow { total_spend: number; impressions: number; clicks: number; }
interface GadsSpendRow { total_spend: number; impressions: number; clicks: number; }
interface AsanaTaskRow { gid: string; name: string; assignee_name: string | null; due_on: string | null; completed: number; section_name: string | null; project_name: string | null; }
interface GhlOppRow { id: string; name: string | null; monetary_value: number; status: string; stage_name: string | null; contact_name: string | null; created_at: string | null; }
interface HarvestSummaryRow { total_hours: number; billable_hours: number; user_count: number; }
interface HarvestByUserRow { user_name: string; hours: number; billable_hours: number; }
interface GA4SummaryRow { sessions: number; users: number; page_views: number; engagement_rate: number; }
interface GSCSummaryRow { clicks: number; impressions: number; ctr: number; avg_position: number; }

export interface ClientDetailEnriched {
  metaSpend: MetaSpendRow | null;
  gadsSpend: GadsSpendRow | null;
  asanaTasks: AsanaTaskRow[];
  ghlOpps: GhlOppRow[];
  harvestSummary: HarvestSummaryRow | null;
  harvestByUser: HarvestByUserRow[];
  ga4Summary: GA4SummaryRow | null;
  gscSummary: GSCSummaryRow | null;
}

export async function getClientEnrichedData(clientId: number): Promise<ClientDetailEnriched> {
  // Helper: safe query that returns [] if table doesn't exist
  async function safeRows<T>(sql: string, args: (string | number | null)[] = []): Promise<T[]> {
    try { return await rows<T>(sql, args); } catch { return []; }
  }

  const [metaSpend, gadsSpend, asanaTasks, ghlOpps, harvestSummary, harvestByUser, ga4Summary, gscSummary] = await Promise.all([
    rows<MetaSpendRow>(`
      SELECT COALESCE(SUM(spend), 0) as total_spend,
             COALESCE(SUM(impressions), 0) as impressions,
             COALESCE(SUM(clicks), 0) as clicks
      FROM meta_insights
      WHERE account_id IN (SELECT external_id FROM client_source_mappings WHERE client_id = ? AND source = 'meta')
    `, [clientId]),

    rows<GadsSpendRow>(`
      SELECT COALESCE(SUM(spend), 0) as total_spend,
             COALESCE(SUM(impressions), 0) as impressions,
             COALESCE(SUM(clicks), 0) as clicks
      FROM gads_campaign_spend
      WHERE account_id IN (SELECT external_id FROM client_source_mappings WHERE client_id = ? AND source = 'gads')
    `, [clientId]),

    rows<AsanaTaskRow>(`
      SELECT gid, name, assignee_name, due_on, completed, section_name, project_name
      FROM asana_tasks
      WHERE project_gid IN (SELECT external_id FROM client_source_mappings WHERE client_id = ? AND source = 'asana')
      ORDER BY completed ASC, due_on ASC
      LIMIT 50
    `, [clientId]),

    rows<GhlOppRow>(`
      SELECT o.id, o.name, o.monetary_value, o.status,
             s.name as stage_name, o.contact_name, o.created_at
      FROM ghl_opportunities o
      LEFT JOIN ghl_stages s ON o.stage_id = s.id
      WHERE o.contact_company IN (SELECT external_id FROM client_source_mappings WHERE client_id = ? AND source = 'ghl')
         OR o.location_id IN (SELECT external_id FROM client_source_mappings WHERE client_id = ? AND source = 'ghl')
      ORDER BY o.created_at DESC
      LIMIT 50
    `, [clientId, clientId]),

    // Harvest: total hours last 90 days
    safeRows<HarvestSummaryRow>(`
      SELECT COALESCE(SUM(hours), 0) as total_hours,
             COALESCE(SUM(CASE WHEN billable = 1 THEN hours ELSE 0 END), 0) as billable_hours,
             COUNT(DISTINCT user_id) as user_count
      FROM harvest_time_entries
      WHERE CAST(client_id AS TEXT) IN (SELECT external_id FROM client_source_mappings WHERE client_id = ? AND source = 'harvest')
        AND spent_date >= date('now', '-90 days')
    `, [clientId]),

    // Harvest: hours by user last 90 days
    safeRows<HarvestByUserRow>(`
      SELECT user_name, ROUND(SUM(hours), 1) as hours,
             ROUND(SUM(CASE WHEN billable = 1 THEN hours ELSE 0 END), 1) as billable_hours
      FROM harvest_time_entries
      WHERE CAST(client_id AS TEXT) IN (SELECT external_id FROM client_source_mappings WHERE client_id = ? AND source = 'harvest')
        AND spent_date >= date('now', '-90 days')
      GROUP BY user_name ORDER BY hours DESC LIMIT 10
    `, [clientId]),

    // GA4: last 30 days summary
    safeRows<GA4SummaryRow>(`
      SELECT COALESCE(SUM(sessions), 0) as sessions,
             COALESCE(SUM(users), 0) as users,
             COALESCE(SUM(page_views), 0) as page_views,
             CASE WHEN SUM(sessions) > 0 THEN ROUND(CAST(SUM(engaged_sessions) AS REAL) / SUM(sessions) * 100, 1) ELSE 0 END as engagement_rate
      FROM ga4_daily
      WHERE property_id IN (SELECT external_id FROM client_source_mappings WHERE client_id = ? AND source = 'ga4')
        AND date >= date('now', '-30 days')
    `, [clientId]),

    // GSC: last 30 days summary
    safeRows<GSCSummaryRow>(`
      SELECT COALESCE(SUM(clicks), 0) as clicks,
             COALESCE(SUM(impressions), 0) as impressions,
             CASE WHEN SUM(impressions) > 0 THEN ROUND(CAST(SUM(clicks) AS REAL) / SUM(impressions) * 100, 2) ELSE 0 END as ctr,
             ROUND(AVG(avg_position), 1) as avg_position
      FROM gsc_daily
      WHERE site_id IN (SELECT external_id FROM client_source_mappings WHERE client_id = ? AND source = 'gsc')
        AND date >= date('now', '-30 days')
    `, [clientId]),
  ]);

  return {
    metaSpend: metaSpend[0]?.total_spend ? metaSpend[0] : null,
    gadsSpend: gadsSpend[0]?.total_spend ? gadsSpend[0] : null,
    asanaTasks,
    ghlOpps,
    harvestSummary: harvestSummary[0]?.total_hours ? harvestSummary[0] : null,
    harvestByUser,
    ga4Summary: ga4Summary[0]?.sessions ? ga4Summary[0] : null,
    gscSummary: gscSummary[0]?.clicks ? gscSummary[0] : null,
  };
}

// --- Client-account mapping (via client_source_mappings) ---

export interface ClientAccountMapping {
  id: number;
  client_id: number;
  client_name: string;
  source: string;
  external_id: string;
  external_name: string | null;
  created_at: string;
}

export interface GhlLocationRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
}

export async function getAllClientMappings(): Promise<ClientAccountMapping[]> {
  return rows<ClientAccountMapping>(`
    SELECT csm.id, csm.client_id, COALESCE(c.display_name, c.name) as client_name,
           csm.source, csm.external_id, csm.external_name, csm.created_at
    FROM client_source_mappings csm
    JOIN clients c ON c.id = csm.client_id
    ORDER BY client_name COLLATE NOCASE, csm.source
  `);
}

export async function addClientMapping(mapping: {
  client_id: number;
  source: string;
  external_id: string;
  external_name: string;
}): Promise<void> {
  const now = new Date().toISOString();
  await db.execute({
    sql: `INSERT INTO client_source_mappings
          (client_id, source, external_id, external_name, created_at)
          VALUES (?, ?, ?, ?, ?)`,
    args: [
      mapping.client_id,
      mapping.source,
      mapping.external_id,
      mapping.external_name,
      now,
    ],
  });
}

export async function removeClientMapping(mappingId: number): Promise<void> {
  await db.execute({ sql: 'DELETE FROM client_source_mappings WHERE id = ?', args: [mappingId] });
}

export async function getGhlLocations(): Promise<GhlLocationRow[]> {
  try {
    return await rows<GhlLocationRow>(
      'SELECT id, name, email, phone, address FROM ghl_locations ORDER BY name COLLATE NOCASE',
    );
  } catch {
    // Table may not exist yet if discover script hasn't run
    return [];
  }
}
