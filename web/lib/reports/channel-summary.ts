/**
 * Per-channel canonical data summary for report generation.
 *
 * Produces a channel-PURE structured text block the AI treats as canonical
 * (preferred over screenshot OCR). One channel in, only that channel's data
 * out — no cross-channel bleed. Reuses the v2 dashboard aggregators
 * (buildMeta / buildSeo) and the Google Ads period summary so the report and
 * the dashboard always agree.
 */
import type { DateRange, MetaBlock, SeoBlock, ToplineTile, SeoTopline } from './dashboard-types.js';
import { buildMeta } from './aggregators/meta.js';
import { buildSeo } from './aggregators/seo.js';
import { buildGoogleAdsPeriodSummary, type GoogleAdsPeriodSummary } from './gads-summary.js';
import { channelLabel, type ReportChannel } from '../queries/reports.js';
import { rows } from '../queries/base.js';

export interface ChannelSummary {
  channel: ReportChannel;
  label: string;
  hasData: boolean;
  /** Canonical, channel-pure text block injected into the AI prompt. */
  canonicalText: string;
  /** Google Ads only — the structured summary, for persistence + reconciliation. */
  gadsSummary?: GoogleAdsPeriodSummary;
}

// ── formatting ──────────────────────────────────────────────────────────────

function gbp(value: number): string {
  return `£${value.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
const CURRENCY_SYMBOLS: Record<string, string> = { GBP: '£', EUR: '€', DKK: 'kr.' };
function moneyIn(currency: string): (value: number) => string {
  const symbol = CURRENCY_SYMBOLS[currency] ?? '£';
  return (value: number) =>
    `${symbol}${value.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function num(value: number): string {
  return Math.round(value).toLocaleString('en-GB');
}
function fmtTile(t: { value: number; format: string }): string {
  switch (t.format) {
    case 'currency': return gbp(t.value);
    case 'percent': return `${t.value.toFixed(2)}%`;
    case 'multiple': return `${t.value.toFixed(2)}×`;
    case 'decimal': return t.value.toFixed(1);
    default: return num(t.value);
  }
}
function tile(tiles: ToplineTile[] | SeoTopline[], key: string): (ToplineTile | SeoTopline) | undefined {
  return (tiles as { key: string }[]).find(t => t.key === key) as ToplineTile | SeoTopline | undefined;
}

/** Same window logic the dashboard uses: previous = same length immediately before. */
function computeRange(periodStart: string, periodEnd: string): DateRange {
  const start = new Date(periodStart + 'T00:00:00Z');
  const end = new Date(periodEnd + 'T00:00:00Z');
  const lenMs = Math.max(0, end.getTime() - start.getTime());
  const prevEnd = new Date(start.getTime() - 24 * 60 * 60 * 1000);
  const prevStart = new Date(prevEnd.getTime() - lenMs);
  const iso = (d: Date): string => d.toISOString().slice(0, 10);
  return {
    current: { start: iso(start), end: iso(end) },
    previous: { start: iso(prevStart), end: iso(prevEnd) },
    granularity: 'day',
  };
}

// ── renderers ───────────────────────────────────────────────────────────────

function renderGoogleAds(s: GoogleAdsPeriodSummary): string {
  const paused = s.campaigns.filter(c => !c.is_active);
  const lines: string[] = [];
  lines.push('STRUCTURED GOOGLE ADS DATA (canonical — prefer this over any screenshot):');
  lines.push('This includes ALL spend for the period. Campaigns paused or removed during the month are INCLUDED and marked [PAUSED]; report their spend and note they were paused.');
  lines.push('');
  lines.push('Overall (all campaigns that spent this period):');
  lines.push(`- Spend: ${gbp(s.overall.spend)}`);
  lines.push(`- Conversions: ${s.overall.conversions}`);
  lines.push(`- CPR: ${gbp(s.overall.cpr)}`);
  lines.push(`- ROAS: ${s.overall.roas === null ? 'n/a' : s.overall.roas.toFixed(2)}`);
  if (paused.length) {
    lines.push(`- Note: ${paused.length} campaign(s) were paused/removed during the period but are included in the totals: ${paused.map(c => c.campaign_name).join(', ')}.`);
  }
  lines.push('');
  lines.push('Campaigns:');
  for (const c of s.campaigns) {
    const tag = c.is_active ? '' : ` [${(c.status || 'PAUSED').toUpperCase()} — paused during the month]`;
    lines.push('');
    lines.push(`*${c.campaign_name}*${tag}`);
    lines.push(`- Spend: ${gbp(c.spend)}`);
    lines.push(`- Conversions: ${c.conversions}`);
    lines.push(`- CPR: ${gbp(c.cpr)}`);
    lines.push(`- ROAS: ${c.roas === null ? 'n/a' : c.roas.toFixed(2)}`);
  }
  return lines.join('\n');
}

interface MetaPurchases {
  purchases: number;
  value: number;
}

function renderMeta(
  block: MetaBlock,
  currency: string,
  metaPurchases: MetaPurchases | null,
  platformLeads: Array<{ name: string | null; leads: number; spend: number }> = [],
): { text: string; hasData: boolean } {
  const money = moneyIn(currency);
  const spend = tile(block.topline, 'spend');
  const leads = tile(block.topline, 'leads');
  const cpl = tile(block.topline, 'cpl');
  const bookings = tile(block.topline, 'bookings');
  const revenue = tile(block.topline, 'revenue');
  const roas = tile(block.topline, 'roas');
  const active = block.campaigns.filter(c => c.spend > 0);
  const hasData = (spend?.value ?? 0) > 0 || active.length > 0;

  const lines: string[] = [];
  lines.push('STRUCTURED META (PAID SOCIAL) DATA (canonical — prefer this over any screenshot):');
  if (currency !== 'GBP') {
    lines.push(`NOTE: all monetary amounts for this client are in ${currency} — use the ${CURRENCY_SYMBOLS[currency] ?? currency} symbol throughout, never £.`);
  }
  lines.push('');
  lines.push('Overall:');
  if (spend) lines.push(`- Spend: ${money(spend.value)}`);
  if (leads) lines.push(`- Leads: ${num(leads.value)}`);
  if (cpl) lines.push(`- CPL: ${money(cpl.value)}`);
  if (bookings && bookings.value > 0) lines.push(`- Bookings: ${num(bookings.value)}`);
  if (revenue && revenue.value > 0) lines.push(`- Revenue: ${money(revenue.value)}`);
  if (roas && roas.value > 0) lines.push(`- ROAS: ${roas.value.toFixed(2)}`);
  if (metaPurchases && metaPurchases.value > 0) {
    const spendValue = spend?.value ?? 0;
    lines.push('');
    lines.push('Meta-reported purchases (ecommerce — from the ad platform, not CRM):');
    if (metaPurchases.purchases > 0) lines.push(`- Purchases: ${num(metaPurchases.purchases)}`);
    lines.push(`- Purchase conversion value: ${money(metaPurchases.value)}`);
    if (spendValue > 0) lines.push(`- ROAS: ${(metaPurchases.value / spendValue).toFixed(2)}`);
  }
  const totalPlatformLeads = platformLeads.reduce((s, p) => s + p.leads, 0);
  if (totalPlatformLeads > 0) {
    lines.push('');
    lines.push('Meta-reported leads (platform lead forms/pixel). When the CRM lead counts above are 0 or missing, use these as the lead numbers:');
    lines.push(`- Total: ${num(totalPlatformLeads)} leads, CPL ${money((spend?.value ?? 0) / totalPlatformLeads)}`);
    for (const p of platformLeads) {
      lines.push(`- ${p.name ?? '(unnamed campaign)'}: ${num(p.leads)} leads, CPL ${money(p.spend / p.leads)}`);
    }
  }
  lines.push('');
  lines.push('Campaigns (bottom-funnel — exclude vanity metrics):');
  for (const c of active) {
    lines.push('');
    lines.push(`*${c.name}*`);
    lines.push(`- Spend: ${money(c.spend)}`);
    lines.push(`- Leads: ${num(c.leads)}`);
    lines.push(`- CPL: ${money(c.cpl)}`);
    if (c.revenue > 0) lines.push(`- Revenue: ${money(c.revenue)}`);
  }
  if (!active.length) lines.push('_(no campaigns with spend in the period)_');
  return { text: lines.join('\n'), hasData };
}

function renderSeo(block: SeoBlock): { text: string; hasData: boolean } {
  const t = block.topline30;
  const users = tile(t, 'organicUsers');
  const sessions = tile(t, 'organicSessions');
  const leads = tile(t, 'leads');
  const revenue = tile(t, 'revenue');
  const pos = tile(t, 'avgPosition');
  const anyTopline = t.some(x => x.value > 0);
  const hasData = anyTopline || block.queries.length > 0 || block.geoGrid !== null;

  const lines: string[] = [];
  lines.push('STRUCTURED SEO (ORGANIC SEARCH) DATA (canonical — prefer this over any screenshot):');
  lines.push('');
  lines.push('Last 30 days (organic):');
  if (users) lines.push(`- Organic users: ${num(users.value)} (prev ${num(users.prev)})`);
  if (sessions) lines.push(`- Organic sessions: ${num(sessions.value)}`);
  if (leads) lines.push(`- Leads: ${num(leads.value)}`);
  if (revenue && revenue.value > 0) lines.push(`- Revenue: ${gbp(revenue.value)}`);
  if (pos) lines.push(`- Average position: ${pos.value.toFixed(1)} (prev ${pos.prev.toFixed(1)})`);

  if (block.queries.length) {
    lines.push('');
    lines.push('Top queries (clicks, avg position, position change — negative = improved):');
    for (const q of block.queries.slice(0, 8)) {
      const dir = q.posChange < 0 ? `▲ ${Math.abs(q.posChange).toFixed(1)}` : q.posChange > 0 ? `▼ ${q.posChange.toFixed(1)}` : '–';
      lines.push(`- "${q.q}": ${num(q.clicks)} clicks, pos ${q.pos.toFixed(1)} (${dir})`);
    }
  }
  if (block.topPages.length) {
    lines.push('');
    lines.push('Top pages (organic users):');
    for (const p of block.topPages.slice(0, 6)) {
      lines.push(`- ${p.url}: ${num(p.users)} users${p.leads ? `, ${num(p.leads)} leads` : ''}`);
    }
  }
  if (block.geoGrid) {
    lines.push('');
    lines.push(`Local map rankings (GeoGrid — ${block.geoGrid.businessName}):`);
    for (const k of block.geoGrid.keywords.slice(0, 6)) {
      lines.push(`- "${k.term}": avg grid rank ${k.agr.toFixed(1)}, share of local voice ${(k.solv * 100).toFixed(0)}%`);
    }
  }
  if (!hasData) lines.push('_(no organic activity recorded for the period)_');
  return { text: lines.join('\n'), hasData };
}

// ── public ──────────────────────────────────────────────────────────────────

export async function buildChannelSummary(
  channel: ReportChannel,
  clientId: number,
  periodStart: string,
  periodEnd: string,
): Promise<ChannelSummary> {
  const label = channelLabel(channel);

  if (channel === 'google_ads') {
    const summary = await buildGoogleAdsPeriodSummary(clientId, periodStart, periodEnd);
    return {
      channel,
      label,
      hasData: summary.has_data,
      canonicalText: summary.has_data ? renderGoogleAds(summary) : '',
      gadsSummary: summary,
    };
  }

  const range = computeRange(periodStart, periodEnd);

  if (channel === 'meta') {
    const block = await buildMeta(clientId, range);
    // Currency + platform-reported purchases come straight from meta_insights.
    // CAST silently yields 0 for legacy rows where conversions/-values hold
    // Meta API JSON blobs; numeric values (e.g. the CSV import) sum normally.
    let extra: Array<{ currency: string | null; purchases: number; value: number }> = [];
    try {
      extra = await rows<{ currency: string | null; purchases: number; value: number }>(
        `SELECT MAX(mi.currency) AS currency,
                COALESCE(SUM(CAST(mi.conversions AS REAL)), 0) AS purchases,
                COALESCE(SUM(CAST(mi.conversion_values AS REAL)), 0) AS value
           FROM meta_insights mi
           JOIN client_source_mappings csm
             ON csm.external_id = mi.account_id AND csm.source = 'meta'
          WHERE csm.client_id = ?
            AND mi.date BETWEEN ? AND ?
            AND mi.level = 'campaign'`,
        [clientId, periodStart, periodEnd],
      );
    } catch {
      // Older DBs without the meta_insights.currency column — fall back to GBP.
    }
    // Platform-reported leads (lead forms / pixel) from the actions JSON —
    // the fallback when the CRM has no Paid Social opportunities for the
    // period (e.g. clients migrated off GHL, or the GHL sync is down).
    let platformLeads: Array<{ name: string | null; leads: number; spend: number }> = [];
    try {
      platformLeads = await rows<{ name: string | null; leads: number; spend: number }>(
        `SELECT mi.campaign_name AS name,
                COALESCE(SUM(CASE WHEN json_extract(je.value, '$.action_type') = 'lead'
                                  THEN CAST(json_extract(je.value, '$.value') AS REAL) ELSE 0 END), 0) AS leads,
                COALESCE(SUM(mi.spend), 0) AS spend
           FROM meta_insights mi
           JOIN client_source_mappings csm
             ON csm.external_id = mi.account_id AND csm.source = 'meta',
                json_each(mi.actions) je
          WHERE csm.client_id = ?
            AND mi.date BETWEEN ? AND ?
            AND mi.level = 'campaign'
            AND mi.actions IS NOT NULL
          GROUP BY mi.campaign_name
         HAVING leads > 0
          ORDER BY leads DESC`,
        [clientId, periodStart, periodEnd],
      );
    } catch {
      // json_each unavailable or actions malformed — section is optional.
    }
    const currency = extra[0]?.currency || 'GBP';
    const metaPurchases = (extra[0]?.value ?? 0) > 0
      ? { purchases: extra[0].purchases, value: extra[0].value }
      : null;
    const { text, hasData } = renderMeta(block, currency, metaPurchases, platformLeads);
    return { channel, label, hasData, canonicalText: hasData ? text : '' };
  }

  // seo
  const block = await buildSeo(clientId, range);
  const { text, hasData } = renderSeo(block);
  return { channel, label, hasData, canonicalText: hasData ? text : '' };
}
