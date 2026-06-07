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

export async function fetchGadsChangeHistory(
  clientId: number,
  periodStart: string,
  periodEnd: string,
): Promise<ChangeHistoryResult> {
  const customerIds = await getClientGadsCustomerIds(clientId);
  if (!customerIds.length) {
    return { text: '', count: 0, note: 'No Google Ads account is mapped to this client.' };
  }

  // 30-day window note (Google Ads only keeps ~35 days of change_event).
  const thirtyAgo = new Date(Date.now() - 33 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const windowNote =
    periodStart < thirtyAgo
      ? 'Google Ads only returns changes from the last ~30 days, so earlier days of this period may be missing — paste the export to fill any gaps.'
      : undefined;

  let accessToken: string;
  try {
    accessToken = await mintAccessToken();
  } catch (err) {
    return { text: '', count: 0, note: `Google Ads auth unavailable: ${err instanceof Error ? err.message : String(err)}` };
  }

  const start = `${periodStart} 00:00:00`;
  const end = `${periodEnd} 23:59:59`;
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
    for (const r of apiRows) {
      const ce = r.changeEvent;
      if (!ce) continue;
      const when = (ce.changeDateTime ?? '').slice(0, 16);
      const op = (ce.resourceChangeOperation ?? '').toLowerCase();
      const type = (ce.changeResourceType ?? '').toLowerCase().replace(/_/g, ' ');
      const fields = tidyFields(ce.changedFields);
      const scope = ce.adGroup ? `ad group ${lastSeg(ce.adGroup)}` : ce.campaign ? `campaign ${lastSeg(ce.campaign)}` : '';
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
