import { rows, scalar } from './base.js';

// ============================================================
// Shared helpers
// ============================================================

// ============================================================
// Interfaces
// ============================================================

export interface DentalMetaRow {
  client_id: number;
  client_name: string;
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  cpl: number;
  ctr: number;
}

export interface DentalGadsRow {
  client_id: number;
  client_name: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  cpa: number;
  ctr: number;
  conversion_value: number;
}

export interface DentalGadsWoW {
  client_id: number;
  client_name: string;
  this_week_cpa: number;
  last_week_cpa: number;
  cpa_change_pct: number;
}

export interface ClientDropdown {
  id: number;
  name: string;
}

export interface ReportingHubData {
  client: ClientDropdown;
  metaSpend: number;
  metaLeads: number;
  metaCPL: number;
  gadsSpend: number;
  gadsConversions: number;
  gadsCPA: number;
  totalSpend: number;
  blendedCPA: number;
  totalLeads: number;
  mrr: number;
  healthScore: number | null;
  healthTier: string | null;
}

export interface ClientMERRow {
  month: string;
  revenue: number;
  ad_spend: number;
  mer: number;
  roas: number;
}

export interface FinanceOverview {
  mrr: number;
  cashPosition: number;
  invoiced: number;
  paid: number;
  outstanding: number;
  overdueCount: number;
  overdueTotal: number;
}

export interface RevenueTrendRow {
  period: string;
  income: number;
  expenses: number;
  net: number;
}

export interface TimeTrackingRow {
  user_id: number;
  user_name: string;
  project_name: string;
  client_name: string;
  hours: number;
}

export interface ProjectBudgetRow {
  project_id: number;
  project_name: string;
  client_name: string;
  budget: number | null;
  hours_used: number;
  budget_hours: number | null;
}

export interface TeamUtilisationRow {
  user_id: number;
  user_name: string;
  hours_logged: number;
  weekly_capacity: number;
  utilisation_pct: number;
}

export interface CapacityRow {
  user_id: number;
  user_name: string;
  roles: string | null;
  hours_logged: number;
  weekly_capacity: number;
  utilisation_pct: number;
}

export interface EcomGadsRow {
  client_id: number;
  client_name: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  conversion_value: number;
  roas: number;
  cpa: number;
  ctr: number;
}

export interface ProfitabilityRow {
  client_id: number;
  client_name: string;
  mrr: number;
  hours: number;
  cost: number;
  margin: number;
  margin_pct: number;
}

export interface PipelineStageRow {
  stage_name: string;
  count: number;
  value: number;
  probability: number;
  weighted_value: number;
}

export interface WonDealRow {
  id: string;
  name: string;
  contact_name: string | null;
  value: number;
  won_date: string;
}

export interface MonthlyForecastRow {
  month: string;
  weighted_value: number;
  deal_count: number;
}

export interface ReviewRow {
  id: number;
  person_name: string;
  period: string;
  status: string;
  created_at: string;
}

export interface ReviewScheduleRow {
  person_name: string;
  last_review_period: string | null;
  last_review_status: string | null;
  next_review_due: string;
  overdue: boolean;
}

// ============================================================
// 1. Meta Dental
// ============================================================

export async function getDentalClients(): Promise<ClientDropdown[]> {
  return rows<ClientDropdown>(`
    SELECT c.id, COALESCE(c.display_name, c.name) as name
    FROM clients c
    WHERE c.vertical = 'dental' AND c.status = 'active'
    ORDER BY name COLLATE NOCASE
  `);
}

export async function getMetaDentalData(days = 30, clientId?: number): Promise<DentalMetaRow[]> {
  const clientFilter = clientId ? 'AND c.id = ?' : '';
  const args: (string | number)[] = clientId ? [days, clientId] : [days];
  return rows<DentalMetaRow>(`
    SELECT c.id as client_id, COALESCE(c.display_name, c.name) as client_name,
           COALESCE(SUM(m.spend), 0) as spend,
           COALESCE(SUM(m.impressions), 0) as impressions,
           COALESCE(SUM(m.clicks), 0) as clicks,
           COALESCE(SUM(m.conversions), 0) as leads,
           CASE WHEN COALESCE(SUM(m.conversions), 0) > 0
                THEN ROUND(SUM(m.spend) / SUM(m.conversions), 2) ELSE 0 END as cpl,
           CASE WHEN COALESCE(SUM(m.impressions), 0) > 0
                THEN ROUND(CAST(SUM(m.clicks) AS REAL) / SUM(m.impressions) * 100, 2) ELSE 0 END as ctr
    FROM clients c
    JOIN client_source_mappings csm ON csm.client_id = c.id AND csm.source = 'meta'
    JOIN meta_insights m ON m.account_id = csm.external_id
      AND m.date >= date('now', '-' || ? || ' days')
      AND m.level = 'campaign'
    WHERE c.vertical = 'dental' AND c.status = 'active' ${clientFilter}
    GROUP BY c.id
    ORDER BY spend DESC
  `, args);
}

// ============================================================
// 2. Google Ads Dental
// ============================================================

export async function getGadsDentalData(days = 30, clientId?: number): Promise<DentalGadsRow[]> {
  const clientFilter = clientId ? 'AND c.id = ?' : '';
  const args: (string | number)[] = clientId ? [days, clientId] : [days];
  return rows<DentalGadsRow>(`
    SELECT c.id as client_id, COALESCE(c.display_name, c.name) as client_name,
           COALESCE(SUM(g.spend), 0) as spend,
           COALESCE(SUM(g.impressions), 0) as impressions,
           COALESCE(SUM(g.clicks), 0) as clicks,
           COALESCE(SUM(g.conversions), 0) as conversions,
           CASE WHEN COALESCE(SUM(g.conversions), 0) > 0
                THEN ROUND(SUM(g.spend) / SUM(g.conversions), 2) ELSE 0 END as cpa,
           CASE WHEN COALESCE(SUM(g.impressions), 0) > 0
                THEN ROUND(CAST(SUM(g.clicks) AS REAL) / SUM(g.impressions) * 100, 2) ELSE 0 END as ctr,
           COALESCE(SUM(g.conversion_value), 0) as conversion_value
    FROM clients c
    JOIN client_source_mappings csm ON csm.client_id = c.id AND csm.source = 'gads'
    JOIN gads_campaign_spend g ON g.account_id = csm.external_id
      AND g.date >= date('now', '-' || ? || ' days')
    WHERE c.vertical = 'dental' AND c.status = 'active' ${clientFilter}
    GROUP BY c.id
    ORDER BY spend DESC
  `, args);
}

export async function getGadsDentalWoW(clientId?: number): Promise<DentalGadsWoW[]> {
  const clientFilter = clientId ? 'AND c.id = ?' : '';
  const args: (string | number)[] = clientId ? [clientId] : [];
  return rows<DentalGadsWoW>(`
    SELECT c.id as client_id, COALESCE(c.display_name, c.name) as client_name,
      CASE WHEN COALESCE(tw.conversions, 0) > 0 THEN ROUND(tw.spend / tw.conversions, 2) ELSE 0 END as this_week_cpa,
      CASE WHEN COALESCE(lw.conversions, 0) > 0 THEN ROUND(lw.spend / lw.conversions, 2) ELSE 0 END as last_week_cpa,
      CASE
        WHEN COALESCE(lw.conversions, 0) > 0 AND COALESCE(tw.conversions, 0) > 0
        THEN ROUND(((tw.spend / tw.conversions) - (lw.spend / lw.conversions)) / (lw.spend / lw.conversions) * 100, 1)
        ELSE 0
      END as cpa_change_pct
    FROM clients c
    JOIN client_source_mappings csm ON csm.client_id = c.id AND csm.source = 'gads'
    LEFT JOIN (
      SELECT account_id, SUM(spend) as spend, SUM(conversions) as conversions
      FROM gads_campaign_spend WHERE date >= date('now', '-7 days')
      GROUP BY account_id
    ) tw ON tw.account_id = csm.external_id
    LEFT JOIN (
      SELECT account_id, SUM(spend) as spend, SUM(conversions) as conversions
      FROM gads_campaign_spend WHERE date >= date('now', '-14 days') AND date < date('now', '-7 days')
      GROUP BY account_id
    ) lw ON lw.account_id = csm.external_id
    WHERE c.vertical = 'dental' AND c.status = 'active' ${clientFilter}
    ORDER BY cpa_change_pct DESC
  `, args);
}

// ============================================================
// 3. Client Reporting Hub
// ============================================================

export async function getAllActiveClients(): Promise<ClientDropdown[]> {
  return rows<ClientDropdown>(`
    SELECT c.id, COALESCE(c.display_name, c.name) as name
    FROM clients c
    WHERE c.status = 'active'
    ORDER BY name COLLATE NOCASE
  `);
}

export async function getReportingHubData(clientId: number, days = 30): Promise<ReportingHubData | null> {
  const clients = await rows<{ id: number; name: string; total_invoiced: number }>(`
    SELECT id, COALESCE(display_name, name) as name, COALESCE(total_invoiced, 0) as total_invoiced
    FROM clients WHERE id = ?
  `, [clientId]);
  if (!clients.length) return null;
  const client = clients[0];

  const [meta, gads, health] = await Promise.all([
    rows<{ spend: number; leads: number }>(`
      SELECT COALESCE(SUM(spend), 0) as spend, COALESCE(SUM(conversions), 0) as leads
      FROM meta_insights
      WHERE account_id IN (SELECT external_id FROM client_source_mappings WHERE client_id = ? AND source = 'meta')
        AND date >= date('now', '-' || ? || ' days') AND level = 'campaign'
    `, [clientId, days]),
    rows<{ spend: number; conversions: number }>(`
      SELECT COALESCE(SUM(spend), 0) as spend, COALESCE(SUM(conversions), 0) as conversions
      FROM gads_campaign_spend
      WHERE account_id IN (SELECT external_id FROM client_source_mappings WHERE client_id = ? AND source = 'gads')
        AND date >= date('now', '-' || ? || ' days')
    `, [clientId, days]),
    rows<{ score: number; tier: string }>(`
      SELECT score, tier FROM client_health
      WHERE client_name = (SELECT COALESCE(display_name, name) FROM clients WHERE id = ?)
      ORDER BY period DESC LIMIT 1
    `, [clientId]),
  ]);

  const metaSpend = meta[0]?.spend ?? 0;
  const metaLeads = meta[0]?.leads ?? 0;
  const gadsSpend = gads[0]?.spend ?? 0;
  const gadsConv = gads[0]?.conversions ?? 0;
  const totalSpend = metaSpend + gadsSpend;
  const totalLeads = metaLeads + gadsConv;

  return {
    client: { id: client.id, name: client.name },
    metaSpend,
    metaLeads,
    metaCPL: metaLeads > 0 ? Math.round(metaSpend / metaLeads * 100) / 100 : 0,
    gadsSpend,
    gadsConversions: gadsConv,
    gadsCPA: gadsConv > 0 ? Math.round(gadsSpend / gadsConv * 100) / 100 : 0,
    totalSpend,
    blendedCPA: totalLeads > 0 ? Math.round(totalSpend / totalLeads * 100) / 100 : 0,
    totalLeads,
    mrr: client.total_invoiced,
    healthScore: health[0]?.score ?? null,
    healthTier: health[0]?.tier ?? null,
  };
}

// ============================================================
// 4. Client MER (Marketing Efficiency Ratio)
// ============================================================

export async function getClientMER(clientId: number, months = 6): Promise<ClientMERRow[]> {
  // Get monthly revenue from Xero invoices matched to the client
  const clientNames = await rows<{ name: string; display_name: string | null; aliases: string | null }>(`
    SELECT name, display_name, aliases FROM clients WHERE id = ?
  `, [clientId]);
  if (!clientNames.length) return [];
  const c = clientNames[0];
  const nameVariants = [c.name, c.display_name, ...(c.aliases ? c.aliases.split(',').map(a => a.trim()) : [])].filter(Boolean);
  const placeholders = nameVariants.map(() => '?').join(', ');

  const revenueRows = await rows<{ month: string; revenue: number }>(`
    SELECT strftime('%Y-%m', date) as month, COALESCE(SUM(total), 0) as revenue
    FROM xero_invoices
    WHERE contact_name IN (${placeholders})
      AND status IN ('PAID', 'AUTHORISED')
      AND type = 'ACCREC'
      AND date >= date('now', '-' || ? || ' months')
    GROUP BY month ORDER BY month
  `, [...nameVariants, months]);

  const metaSpendRows = await rows<{ month: string; spend: number }>(`
    SELECT strftime('%Y-%m', date) as month, COALESCE(SUM(spend), 0) as spend
    FROM meta_insights
    WHERE account_id IN (SELECT external_id FROM client_source_mappings WHERE client_id = ? AND source = 'meta')
      AND date >= date('now', '-' || ? || ' months') AND level = 'campaign'
    GROUP BY month ORDER BY month
  `, [clientId, months]);

  const gadsSpendRows = await rows<{ month: string; spend: number }>(`
    SELECT strftime('%Y-%m', date) as month, COALESCE(SUM(spend), 0) as spend
    FROM gads_campaign_spend
    WHERE account_id IN (SELECT external_id FROM client_source_mappings WHERE client_id = ? AND source = 'gads')
      AND date >= date('now', '-' || ? || ' months')
    GROUP BY month ORDER BY month
  `, [clientId, months]);

  // Merge by month
  const monthMap = new Map<string, ClientMERRow>();
  for (const r of revenueRows) {
    monthMap.set(r.month, { month: r.month, revenue: r.revenue, ad_spend: 0, mer: 0, roas: 0 });
  }
  for (const m of metaSpendRows) {
    const existing = monthMap.get(m.month) || { month: m.month, revenue: 0, ad_spend: 0, mer: 0, roas: 0 };
    existing.ad_spend += m.spend;
    monthMap.set(m.month, existing);
  }
  for (const g of gadsSpendRows) {
    const existing = monthMap.get(g.month) || { month: g.month, revenue: 0, ad_spend: 0, mer: 0, roas: 0 };
    existing.ad_spend += g.spend;
    monthMap.set(g.month, existing);
  }

  const result = Array.from(monthMap.values()).sort((a, b) => a.month.localeCompare(b.month));
  for (const r of result) {
    r.mer = r.ad_spend > 0 ? Math.round(r.revenue / r.ad_spend * 100) / 100 : 0;
    r.roas = r.ad_spend > 0 ? Math.round(r.revenue / r.ad_spend * 100) / 100 : 0;
  }
  return result;
}

// ============================================================
// 5. Financial Dashboard
// ============================================================

export async function getFinanceOverview(): Promise<FinanceOverview> {
  // MRR = last completed calendar month's total income from P&L.
  // MAX() collapses duplicate period_start rows that the sync has historically created.
  // Falls back to current month's ACCREC invoice total if P&L is unavailable.
  const [mrrRow, cashRow, invoicedRow, paidRow, outstandingRow, overdueRow] = await Promise.all([
    scalar<number>(`
      WITH monthly AS (
        SELECT strftime('%Y-%m', period_start) AS month,
               MAX(total_income) AS income
        FROM xero_pnl_monthly
        GROUP BY month
      )
      SELECT income FROM monthly
      WHERE month < strftime('%Y-%m', 'now')
      ORDER BY month DESC LIMIT 1
    `),
    scalar<number>(`SELECT COALESCE(SUM(closing_balance), 0) FROM xero_bank_summary`),
    scalar<number>(`SELECT COALESCE(SUM(total), 0) FROM xero_invoices WHERE type = 'ACCREC' AND date >= date('now', '-30 days')`),
    scalar<number>(`SELECT COALESCE(SUM(total), 0) FROM xero_invoices WHERE type = 'ACCREC' AND status = 'PAID' AND date >= date('now', '-30 days')`),
    scalar<number>(`SELECT COALESCE(SUM(amount_due), 0) FROM xero_invoices WHERE type = 'ACCREC' AND status = 'AUTHORISED' AND amount_due > 0`),
    rows<{ cnt: number; total: number }>(`
      SELECT COUNT(*) as cnt, COALESCE(SUM(amount_due), 0) as total
      FROM xero_invoices
      WHERE type = 'ACCREC' AND status = 'AUTHORISED' AND amount_due > 0 AND due_date < date('now')
    `),
  ]);

  return {
    mrr: mrrRow ?? 0,
    cashPosition: cashRow ?? 0,
    invoiced: invoicedRow ?? 0,
    paid: paidRow ?? 0,
    outstanding: outstandingRow ?? 0,
    overdueCount: overdueRow[0]?.cnt ?? 0,
    overdueTotal: overdueRow[0]?.total ?? 0,
  };
}

export async function getRevenueTrend(months = 12): Promise<RevenueTrendRow[]> {
  // Collapse duplicate period_start rows by month, and recompute net from income - expenses
  // because the P&L sync has historically written net_profit = 0.
  return rows<RevenueTrendRow>(`
    SELECT strftime('%Y-%m-01', period_start) AS period,
           COALESCE(MAX(total_income), 0) AS income,
           COALESCE(MAX(total_expenses), 0) AS expenses,
           COALESCE(MAX(total_income), 0) - COALESCE(MAX(total_expenses), 0) AS net
    FROM xero_pnl_monthly
    WHERE period_start >= date('now', '-' || ? || ' months')
    GROUP BY strftime('%Y-%m', period_start)
    ORDER BY period
  `, [months]);
}

export async function getOutstandingInvoices(): Promise<{ contact_name: string; invoice_number: string; total: number; amount_due: number; due_date: string; days_overdue: number }[]> {
  return rows(`
    SELECT contact_name, invoice_number, total, amount_due, due_date,
           CAST(julianday('now') - julianday(due_date) AS INTEGER) as days_overdue
    FROM xero_invoices
    WHERE type = 'ACCREC' AND status = 'AUTHORISED' AND amount_due > 0 AND due_date < date('now')
    ORDER BY days_overdue DESC
  `);
}

// ============================================================
// 6. Time Tracking
// ============================================================

export async function getTimeTrackingData(days = 30, userId?: number): Promise<TimeTrackingRow[]> {
  const userFilter = userId ? 'AND h.user_id = ?' : '';
  const args: (string | number)[] = userId ? [days, userId] : [days];
  return rows<TimeTrackingRow>(`
    SELECT h.user_id, h.user_name, h.project_name, h.client_name,
           ROUND(SUM(h.hours), 2) as hours
    FROM harvest_time_entries h
    WHERE h.spent_date >= date('now', '-' || ? || ' days') ${userFilter}
    GROUP BY h.user_id, h.user_name, h.project_name, h.client_name
    ORDER BY h.user_name, hours DESC
  `, args);
}

export async function getProjectBudgets(days = 30): Promise<ProjectBudgetRow[]> {
  return rows<ProjectBudgetRow>(`
    SELECT p.id as project_id, p.name as project_name, p.client_name,
           p.budget,
           ROUND(COALESCE(SUM(h.hours), 0), 2) as hours_used,
           CASE WHEN p.budget_by = 'total_project_fees' AND p.hourly_rate > 0
                THEN ROUND(p.budget / p.hourly_rate, 1)
                ELSE p.budget END as budget_hours
    FROM harvest_projects p
    LEFT JOIN harvest_time_entries h ON h.project_id = p.id AND h.spent_date >= date('now', '-' || ? || ' days')
    WHERE p.is_active = 1
    GROUP BY p.id
    HAVING hours_used > 0
    ORDER BY hours_used DESC
  `, [days]);
}

export async function getTeamUtilisation(days = 30): Promise<TeamUtilisationRow[]> {
  const weeks = Math.max(1, Math.round(days / 7));
  return rows<TeamUtilisationRow>(`
    SELECT u.id as user_id,
           u.first_name || ' ' || u.last_name as user_name,
           ROUND(COALESCE(SUM(h.hours), 0), 2) as hours_logged,
           u.weekly_capacity_hours * ? as weekly_capacity,
           CASE WHEN u.weekly_capacity_hours > 0
                THEN ROUND(COALESCE(SUM(h.hours), 0) / (u.weekly_capacity_hours * ?) * 100, 1)
                ELSE 0 END as utilisation_pct
    FROM harvest_users u
    LEFT JOIN harvest_time_entries h ON h.user_id = u.id AND h.spent_date >= date('now', '-' || ? || ' days')
    WHERE u.is_active = 1 AND u.weekly_capacity_hours > 0
    GROUP BY u.id
    ORDER BY utilisation_pct DESC
  `, [weeks, weeks, days]);
}

export async function getHarvestUsers(): Promise<{ id: number; name: string }[]> {
  return rows(`
    SELECT id, first_name || ' ' || last_name as name
    FROM harvest_users
    WHERE is_active = 1
    ORDER BY first_name
  `);
}

// ============================================================
// 7. Capacity Modelling
// ============================================================

export async function getCapacityData(days = 30): Promise<CapacityRow[]> {
  const weeks = Math.max(1, Math.round(days / 7));
  return rows<CapacityRow>(`
    SELECT u.id as user_id,
           u.first_name || ' ' || u.last_name as user_name,
           u.roles,
           ROUND(COALESCE(SUM(h.hours), 0), 2) as hours_logged,
           u.weekly_capacity_hours * ? as weekly_capacity,
           CASE WHEN u.weekly_capacity_hours > 0
                THEN ROUND(COALESCE(SUM(h.hours), 0) / (u.weekly_capacity_hours * ?) * 100, 1)
                ELSE 0 END as utilisation_pct
    FROM harvest_users u
    LEFT JOIN harvest_time_entries h ON h.user_id = u.id AND h.spent_date >= date('now', '-' || ? || ' days')
    WHERE u.is_active = 1 AND u.weekly_capacity_hours > 0
    GROUP BY u.id
    ORDER BY u.roles, utilisation_pct DESC
  `, [weeks, weeks, days]);
}

// ============================================================
// 8. Google Ads Ecom
// ============================================================

export async function getEcomClients(): Promise<ClientDropdown[]> {
  return rows<ClientDropdown>(`
    SELECT c.id, COALESCE(c.display_name, c.name) as name
    FROM clients c
    WHERE c.vertical = 'ecom' AND c.status = 'active'
    ORDER BY name COLLATE NOCASE
  `);
}

export async function getGadsEcomData(days = 30, clientId?: number): Promise<EcomGadsRow[]> {
  const clientFilter = clientId ? 'AND c.id = ?' : '';
  const args: (string | number)[] = clientId ? [days, clientId] : [days];
  return rows<EcomGadsRow>(`
    SELECT c.id as client_id, COALESCE(c.display_name, c.name) as client_name,
           COALESCE(SUM(g.spend), 0) as spend,
           COALESCE(SUM(g.impressions), 0) as impressions,
           COALESCE(SUM(g.clicks), 0) as clicks,
           COALESCE(SUM(g.conversions), 0) as conversions,
           COALESCE(SUM(g.conversion_value), 0) as conversion_value,
           CASE WHEN COALESCE(SUM(g.spend), 0) > 0
                THEN ROUND(SUM(g.conversion_value) / SUM(g.spend), 2) ELSE 0 END as roas,
           CASE WHEN COALESCE(SUM(g.conversions), 0) > 0
                THEN ROUND(SUM(g.spend) / SUM(g.conversions), 2) ELSE 0 END as cpa,
           CASE WHEN COALESCE(SUM(g.impressions), 0) > 0
                THEN ROUND(CAST(SUM(g.clicks) AS REAL) / SUM(g.impressions) * 100, 2) ELSE 0 END as ctr
    FROM clients c
    JOIN client_source_mappings csm ON csm.client_id = c.id AND csm.source = 'gads'
    JOIN gads_campaign_spend g ON g.account_id = csm.external_id
      AND g.date >= date('now', '-' || ? || ' days')
    WHERE c.vertical = 'ecom' AND c.status = 'active' ${clientFilter}
    GROUP BY c.id
    ORDER BY spend DESC
  `, args);
}

export async function getGadsEcomWoW(clientId?: number): Promise<DentalGadsWoW[]> {
  const clientFilter = clientId ? 'AND c.id = ?' : '';
  const args: (string | number)[] = clientId ? [clientId] : [];
  return rows<DentalGadsWoW>(`
    SELECT c.id as client_id, COALESCE(c.display_name, c.name) as client_name,
      CASE WHEN COALESCE(tw.conversions, 0) > 0 THEN ROUND(tw.spend / tw.conversions, 2) ELSE 0 END as this_week_cpa,
      CASE WHEN COALESCE(lw.conversions, 0) > 0 THEN ROUND(lw.spend / lw.conversions, 2) ELSE 0 END as last_week_cpa,
      CASE
        WHEN COALESCE(lw.conversions, 0) > 0 AND COALESCE(tw.conversions, 0) > 0
        THEN ROUND(((tw.spend / tw.conversions) - (lw.spend / lw.conversions)) / (lw.spend / lw.conversions) * 100, 1)
        ELSE 0
      END as cpa_change_pct
    FROM clients c
    JOIN client_source_mappings csm ON csm.client_id = c.id AND csm.source = 'gads'
    LEFT JOIN (
      SELECT account_id, SUM(spend) as spend, SUM(conversions) as conversions
      FROM gads_campaign_spend WHERE date >= date('now', '-7 days')
      GROUP BY account_id
    ) tw ON tw.account_id = csm.external_id
    LEFT JOIN (
      SELECT account_id, SUM(spend) as spend, SUM(conversions) as conversions
      FROM gads_campaign_spend WHERE date >= date('now', '-14 days') AND date < date('now', '-7 days')
      GROUP BY account_id
    ) lw ON lw.account_id = csm.external_id
    WHERE c.vertical = 'ecom' AND c.status = 'active' ${clientFilter}
    ORDER BY cpa_change_pct DESC
  `, args);
}

// ============================================================
// 9. Client Profitability
// ============================================================

export async function getClientProfitability(costRate = 35): Promise<ProfitabilityRow[]> {
  return rows<ProfitabilityRow>(`
    SELECT c.id as client_id,
           COALESCE(c.display_name, c.name) as client_name,
           COALESCE(c.total_invoiced, 0) / NULLIF(
             (SELECT COUNT(DISTINCT strftime('%Y-%m', date)) FROM xero_invoices
              WHERE contact_name IN (c.name, c.display_name) AND type = 'ACCREC' AND status IN ('PAID','AUTHORISED')), 0
           ) as mrr,
           ROUND(COALESCE((
             SELECT SUM(h.hours) FROM harvest_time_entries h
             WHERE h.client_name IN (
               SELECT external_name FROM client_source_mappings WHERE client_id = c.id AND source = 'harvest'
             ) AND h.spent_date >= date('now', '-30 days')
           ), 0), 2) as hours,
           ROUND(COALESCE((
             SELECT SUM(h.hours) FROM harvest_time_entries h
             WHERE h.client_name IN (
               SELECT external_name FROM client_source_mappings WHERE client_id = c.id AND source = 'harvest'
             ) AND h.spent_date >= date('now', '-30 days')
           ), 0) * ?, 2) as cost,
           0 as margin,
           0 as margin_pct
    FROM clients c
    WHERE c.status = 'active'
    ORDER BY client_name COLLATE NOCASE
  `, [costRate]);
}

// ============================================================
// 10. Pipeline Tracker
// ============================================================

const VENDO_LOCATION_ID = 'IqXxEPhxyRi8uv1SvjN8';

const STAGE_PROBABILITIES: Record<string, number> = {
  'Lead': 10,
  'Qualified': 20,
  'Proposal': 40,
  'Proposal Sent': 40,
  'Negotiation': 60,
  'Won': 100,
  'Lost': 0,
};

export async function getPipelineStages(): Promise<PipelineStageRow[]> {
  const stageRows = await rows<{ stage_name: string; count: number; value: number }>(`
    SELECT COALESCE(s.name, 'Unknown') as stage_name,
           COUNT(o.id) as count,
           COALESCE(SUM(o.monetary_value), 0) as value
    FROM ghl_opportunities o
    LEFT JOIN ghl_stages s ON o.stage_id = s.id
    WHERE o.status = 'open' AND o.location_id = ?
    GROUP BY s.name
    ORDER BY s.position
  `, [VENDO_LOCATION_ID]);
  return stageRows.map(s => {
    const prob = STAGE_PROBABILITIES[s.stage_name] ?? 25;
    return {
      ...s,
      probability: prob,
      weighted_value: Math.round(s.value * prob / 100),
    };
  });
}

export async function getPipelineWonDeals(days = 30): Promise<WonDealRow[]> {
  return rows<WonDealRow>(`
    SELECT o.id, o.name, o.contact_name, o.monetary_value as value,
           o.updated_at as won_date
    FROM ghl_opportunities o
    WHERE o.status = 'won' AND o.location_id = ?
      AND o.updated_at >= date('now', '-' || ? || ' days')
    ORDER BY o.updated_at DESC
  `, [VENDO_LOCATION_ID, days]);
}

export async function getPipelineMonthlyForecast(): Promise<MonthlyForecastRow[]> {
  return rows<MonthlyForecastRow>(`
    SELECT strftime('%Y-%m', o.created_at) as month,
           COUNT(*) as deal_count,
           COALESCE(SUM(o.monetary_value), 0) as weighted_value
    FROM ghl_opportunities o
    WHERE o.status = 'open' AND o.location_id = ?
    GROUP BY month
    ORDER BY month DESC
    LIMIT 6
  `, [VENDO_LOCATION_ID]);
}

// ============================================================
// 11. Unified Ads Dashboard
// ============================================================

export interface UnifiedAdsRow {
  client_id: number;
  client_name: string;
  platform: 'meta' | 'google';
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  conversion_value: number;
  cpa: number;
  ctr: number;
  roas: number;
  wow_cpa_change: number | null;
}

export async function getUnifiedAdsData(
  days = 30,
  platform?: 'meta' | 'google',
  clientId?: number,
): Promise<UnifiedAdsRow[]> {
  const results: UnifiedAdsRow[] = [];

  // Meta data
  if (!platform || platform === 'meta') {
    const metaFilter = clientId ? 'AND c.id = ?' : '';
    const metaArgs: (string | number)[] = clientId ? [days, clientId] : [days];
    const meta = await rows<{
      client_id: number; client_name: string; spend: number;
      impressions: number; clicks: number; conversions: number; cpa: number; ctr: number;
    }>(`
      SELECT c.id as client_id, COALESCE(c.display_name, c.name) as client_name,
             COALESCE(SUM(m.spend), 0) as spend,
             COALESCE(SUM(m.impressions), 0) as impressions,
             COALESCE(SUM(m.clicks), 0) as clicks,
             COALESCE(SUM(m.conversions), 0) as conversions,
             CASE WHEN COALESCE(SUM(m.conversions), 0) > 0
                  THEN ROUND(SUM(m.spend) / SUM(m.conversions), 2) ELSE 0 END as cpa,
             CASE WHEN COALESCE(SUM(m.impressions), 0) > 0
                  THEN ROUND(CAST(SUM(m.clicks) AS REAL) / SUM(m.impressions) * 100, 2) ELSE 0 END as ctr
      FROM clients c
      JOIN client_source_mappings csm ON csm.client_id = c.id AND csm.source = 'meta'
      JOIN meta_insights m ON m.account_id = csm.external_id
        AND m.date >= date('now', '-' || ? || ' days')
        AND m.level = 'campaign'
      WHERE c.status = 'active' ${metaFilter}
      GROUP BY c.id
      ORDER BY spend DESC
    `, metaArgs);
    for (const r of meta) {
      results.push({ ...r, platform: 'meta', conversion_value: 0, roas: 0, wow_cpa_change: null });
    }
  }

  // Google Ads data
  if (!platform || platform === 'google') {
    const gadsFilter = clientId ? 'AND c.id = ?' : '';
    const gadsArgs: (string | number)[] = clientId ? [days, clientId] : [days];
    const gads = await rows<{
      client_id: number; client_name: string; spend: number;
      impressions: number; clicks: number; conversions: number;
      conversion_value: number; cpa: number; ctr: number; roas: number;
    }>(`
      SELECT c.id as client_id, COALESCE(c.display_name, c.name) as client_name,
             COALESCE(SUM(g.spend), 0) as spend,
             COALESCE(SUM(g.impressions), 0) as impressions,
             COALESCE(SUM(g.clicks), 0) as clicks,
             COALESCE(SUM(g.conversions), 0) as conversions,
             COALESCE(SUM(g.conversion_value), 0) as conversion_value,
             CASE WHEN COALESCE(SUM(g.conversions), 0) > 0
                  THEN ROUND(SUM(g.spend) / SUM(g.conversions), 2) ELSE 0 END as cpa,
             CASE WHEN COALESCE(SUM(g.impressions), 0) > 0
                  THEN ROUND(CAST(SUM(g.clicks) AS REAL) / SUM(g.impressions) * 100, 2) ELSE 0 END as ctr,
             CASE WHEN COALESCE(SUM(g.spend), 0) > 0
                  THEN ROUND(SUM(g.conversion_value) / SUM(g.spend), 2) ELSE 0 END as roas
      FROM clients c
      JOIN client_source_mappings csm ON csm.client_id = c.id AND csm.source = 'gads'
      JOIN gads_campaign_spend g ON g.account_id = csm.external_id
        AND g.date >= date('now', '-' || ? || ' days')
      WHERE c.status = 'active' ${gadsFilter}
      GROUP BY c.id
      ORDER BY spend DESC
    `, gadsArgs);

    // WoW CPA data for Google Ads
    const wowFilter = clientId ? 'AND c.id = ?' : '';
    const wowArgs: (string | number)[] = clientId ? [clientId] : [];
    const wow = await rows<{ client_id: number; cpa_change_pct: number }>(`
      SELECT c.id as client_id,
        CASE
          WHEN COALESCE(lw.conversions, 0) > 0 AND COALESCE(tw.conversions, 0) > 0
          THEN ROUND(((tw.spend / tw.conversions) - (lw.spend / lw.conversions)) / (lw.spend / lw.conversions) * 100, 1)
          ELSE 0
        END as cpa_change_pct
      FROM clients c
      JOIN client_source_mappings csm ON csm.client_id = c.id AND csm.source = 'gads'
      LEFT JOIN (
        SELECT account_id, SUM(spend) as spend, SUM(conversions) as conversions
        FROM gads_campaign_spend WHERE date >= date('now', '-7 days')
        GROUP BY account_id
      ) tw ON tw.account_id = csm.external_id
      LEFT JOIN (
        SELECT account_id, SUM(spend) as spend, SUM(conversions) as conversions
        FROM gads_campaign_spend WHERE date >= date('now', '-14 days') AND date < date('now', '-7 days')
        GROUP BY account_id
      ) lw ON lw.account_id = csm.external_id
      WHERE c.status = 'active' ${wowFilter}
    `, wowArgs);
    const wowMap = new Map(wow.map(w => [w.client_id, w.cpa_change_pct]));

    for (const r of gads) {
      results.push({ ...r, platform: 'google', wow_cpa_change: wowMap.get(r.client_id) ?? null });
    }
  }

  return results;
}

// --- Daily ad spend trend (for charts) ---
interface DailyAdSpendRow {
  date: string;
  meta_spend: number;
  google_spend: number;
}

export async function getDailyAdSpend(days = 30, clientId?: number): Promise<DailyAdSpendRow[]> {
  const clientFilter = clientId ? 'AND c.id = ?' : '';
  const baseArgs: (string | number)[] = clientId ? [days, clientId] : [days];

  const [metaDaily, gadsDaily] = await Promise.all([
    rows<{ date: string; spend: number }>(`
      SELECT m.date, COALESCE(SUM(m.spend), 0) as spend
      FROM meta_insights m
      JOIN client_source_mappings csm ON csm.external_id = m.account_id AND csm.source = 'meta'
      JOIN clients c ON c.id = csm.client_id
      WHERE m.date >= date('now', '-' || ? || ' days')
        AND m.level = 'campaign'
        AND c.status = 'active' ${clientFilter}
      GROUP BY m.date ORDER BY m.date
    `, baseArgs),
    rows<{ date: string; spend: number }>(`
      SELECT g.date, COALESCE(SUM(g.spend), 0) as spend
      FROM gads_campaign_spend g
      JOIN client_source_mappings csm ON csm.external_id = g.account_id AND csm.source = 'gads'
      JOIN clients c ON c.id = csm.client_id
      WHERE g.date >= date('now', '-' || ? || ' days')
        AND c.status = 'active' ${clientFilter}
      GROUP BY g.date ORDER BY g.date
    `, baseArgs),
  ]);

  const map = new Map<string, DailyAdSpendRow>();
  for (const r of metaDaily) {
    map.set(r.date, { date: r.date, meta_spend: r.spend, google_spend: 0 });
  }
  for (const r of gadsDaily) {
    const existing = map.get(r.date);
    if (existing) {
      existing.google_spend = r.spend;
    } else {
      map.set(r.date, { date: r.date, meta_spend: 0, google_spend: r.spend });
    }
  }
  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}

// ============================================================
// 12. Performance Reviews
// ============================================================

export async function getReviewData(): Promise<ReviewRow[]> {
  return rows<ReviewRow>(`
    SELECT id, person_name, period, status, created_at
    FROM performance_reviews
    ORDER BY created_at DESC
  `);
}

export async function getReviewSchedule(): Promise<ReviewScheduleRow[]> {
  // Get all active Harvest users as the team
  const users = await rows<{ name: string }>(`
    SELECT first_name || ' ' || last_name as name
    FROM harvest_users
    WHERE is_active = 1
    ORDER BY first_name
  `);

  const schedule: ReviewScheduleRow[] = [];
  for (const u of users) {
    const lastReview = await rows<{ period: string; status: string }>(`
      SELECT period, status FROM performance_reviews
      WHERE person_name = ?
      ORDER BY period DESC LIMIT 1
    `, [u.name]);

    const lastPeriod = lastReview[0]?.period ?? null;
    const lastStatus = lastReview[0]?.status ?? null;

    // Next review is 3 months after last, or now if none
    let nextDue: string;
    if (lastPeriod) {
      const d = new Date(lastPeriod);
      d.setMonth(d.getMonth() + 3);
      nextDue = d.toISOString().slice(0, 10);
    } else {
      nextDue = new Date().toISOString().slice(0, 10);
    }

    schedule.push({
      person_name: u.name,
      last_review_period: lastPeriod,
      last_review_status: lastStatus,
      next_review_due: nextDue,
      overdue: new Date(nextDue) < new Date(),
    });
  }

  return schedule;
}
