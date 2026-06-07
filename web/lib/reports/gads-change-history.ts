/**
 * Pull the Google Ads change history for a client + period from the API.
 *
 * Uses the `change_event` resource via the existing GAQL client. Returns a
 * compact, human-readable summary (one line per change) suitable for storing
 * on the report and feeding to the AI.
 *
 * IMPORTANT Google Ads limitation: `change_event` only returns changes from
 * roughly the LAST 30 DAYS, requires a date filter, and requires a LIMIT
 * (max 10,000). So for a report run close to the period this is complete; for
 * an older month the early part of the window is unavailable — in that case the
 * team should paste the export manually. We degrade gracefully and say so.
 */
import { mintAccessToken, gadsQuery } from '../jobs/sync-google-ads.js';
import { getClientGadsCustomerIds } from '../queries/reports.js';

export interface ChangeHistoryResult {
  text: string;
  count: number;
  /** Non-fatal explanation (no mapping, auth issue, 30-day window, etc.). */
  note?: string;
}

interface ChangeEventRow {
  changeEvent?: {
    changeDateTime?: string;
    clientType?: string;
    changeResourceType?: string;
    resourceChangeOperation?: string;
    changedFields?: string;
    campaign?: string;
    adGroup?: string;
  };
}

/** Last path segment of a resource name, e.g. ".../campaigns/123" -> "123". */
function lastSeg(resource?: string): string {
  if (!resource) return '';
  const parts = resource.split('/');
  return parts[parts.length - 1] || '';
}

/** "campaign.x,campaign.y" -> "x, y" (drop the resource prefix). */
function tidyFields(changed?: string): string {
  if (!changed) return '';
  return changed
    .split(',')
    .map(f => f.trim().split('.').pop() || f.trim())
    .filter(Boolean)
    .slice(0, 6)
    .join(', ');
}

/** Strip Vendo's internal campaign-name prefixes for a clean, readable name. */
function cleanName(name: string): string {
  return name
    .replace(/^VD\s*\|\s*/i, '')
    .replace(/^Search\s*-\s*/i, '')
    .trim();
}

/**
 * Build id -> clean-name maps for the customer's campaigns and ad groups, so
 * change-history lines read "General Dentistry" instead of "campaign 234…".
 */
async function fetchNameMaps(
  accessToken: string,
  customerId: string,
): Promise<{ campaigns: Map<string, string>; adGroups: Map<string, string> }> {
  const campaigns = new Map<string, string>();
  const adGroups = new Map<string, string>();
  try {
    const rows = (await gadsQuery(
      accessToken,
      customerId,
      'SELECT campaign.id, campaign.name FROM campaign LIMIT 2000',
    )) as unknown as Array<{ campaign?: { id?: string; name?: string } }>;
    for (const r of rows) {
      if (r.campaign?.id && r.campaign.name) campaigns.set(String(r.campaign.id), cleanName(r.campaign.name));
    }
  } catch { /* names are best-effort; fall back to ids */ }
  try {
    const rows = (await gadsQuery(
      accessToken,
      customerId,
      'SELECT ad_group.id, ad_group.name FROM ad_group LIMIT 5000',
    )) as unknown as Array<{ adGroup?: { id?: string; name?: string } }>;
    for (const r of rows) {
      if (r.adGroup?.id && r.adGroup.name) adGroups.set(String(r.adGroup.id), cleanName(r.adGroup.name));
    }
  } catch { /* best-effort */ }
  return { campaigns, adGroups };
}

export async function fetchGadsChangeHistory(
  clientId: number,
  periodStart: string,
  periodEnd: string,
): Promise<ChangeHistoryResult> {
  const customerIds = await getClientGadsCustomerIds(clientId);
  if (!customerIds.length) {
    return { text: '', count: 0, note: 'No Google Ads account is mapped to this client.' };
  }

  // Google Ads `change_event` ONLY accepts a date range within the last ~30
  // days, and rejects (400 INVALID_ARGUMENT) if the start is older — so we
  // CLAMP the query window to [today-29d, today] intersected with the period.
  const dayMs = 24 * 60 * 60 * 1000;
  const todayStr = new Date().toISOString().slice(0, 10);
  const earliestStr = new Date(Date.now() - 29 * dayMs).toISOString().slice(0, 10);

  const queryStart = periodStart < earliestStr ? earliestStr : periodStart;
  const queryEnd = periodEnd > todayStr ? todayStr : periodEnd;

  if (queryStart > queryEnd) {
    return {
      text: '',
      count: 0,
      note: 'This period is outside Google Ads’ ~30-day change-history window, so it can’t be auto-pulled — paste the export manually.',
    };
  }
  const windowNote =
    periodStart < earliestStr
      ? `Google Ads only keeps ~30 days of change history, so only changes from ${queryStart} onward could be pulled — paste the export to fill earlier days.`
      : undefined;

  let accessToken: string;
  try {
    accessToken = await mintAccessToken();
  } catch (err) {
    return { text: '', count: 0, note: `Google Ads auth unavailable: ${err instanceof Error ? err.message : String(err)}` };
  }

  const start = `${queryStart} 00:00:00`;
  const end = `${queryEnd} 23:59:59`;
  const gaql =
    `SELECT change_event.change_date_time, change_event.client_type, ` +
    `change_event.change_resource_type, change_event.resource_change_operation, ` +
    `change_event.changed_fields, change_event.campaign, change_event.ad_group ` +
    `FROM change_event ` +
    `WHERE change_event.change_date_time >= '${start}' AND change_event.change_date_time <= '${end}' ` +
    `ORDER BY change_event.change_date_time DESC LIMIT 5000`;

  const lines: string[] = [];
  let apiError: string | undefined;

  for (const cid of customerIds) {
    let apiRows: ChangeEventRow[];
    try {
      apiRows = (await gadsQuery(accessToken, cid, gaql)) as unknown as ChangeEventRow[];
    } catch (err) {
      // Most commonly the 30-day-window error for old periods; keep going.
      apiError = err instanceof Error ? err.message : String(err);
      continue;
    }
    // Resolve campaign / ad-group ids to clean names for this customer.
    const { campaigns, adGroups } = await fetchNameMaps(accessToken, cid);
    for (const r of apiRows) {
      const ce = r.changeEvent;
      if (!ce) continue;
      const when = (ce.changeDateTime ?? '').slice(0, 16);
      const op = (ce.resourceChangeOperation ?? '').toLowerCase();
      const type = (ce.changeResourceType ?? '').toLowerCase().replace(/_/g, ' ');
      const fields = tidyFields(ce.changedFields);
      const agId = lastSeg(ce.adGroup);
      const cId = lastSeg(ce.campaign);
      const scope = ce.adGroup
        ? `ad group: ${adGroups.get(agId) || agId}`
        : ce.campaign
          ? `campaign: ${campaigns.get(cId) || cId}`
          : '';
      const via = ce.clientType && ce.clientType !== 'GOOGLE_ADS_WEB_CLIENT' ? ` (${ce.clientType.toLowerCase()})` : '';
      lines.push(`${when}  ${op} ${type}${fields ? ` — ${fields}` : ''}${scope ? ` [${scope}]` : ''}${via}`);
    }
  }

  if (!lines.length) {
    return {
      text: '',
      count: 0,
      note: apiError
        ? `No changes returned (${apiError.slice(0, 160)}). For older periods, paste the export manually.`
        : windowNote ?? 'No account changes were logged for this period.',
    };
  }

  // Cap to keep the field + prompt tidy.
  const capped = lines.slice(0, 300);
  const header = `Google Ads change history (${capped.length}${lines.length > capped.length ? ` of ${lines.length}` : ''} changes):`;
  return {
    text: [header, ...capped].join('\n'),
    count: lines.length,
    note: windowNote,
  };
}
