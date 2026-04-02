import { rows, scalar } from './base.js';

// --- Interfaces ---

export interface AttributedLeadRow {
  id: number;
  ghl_opportunity_id: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  attributed_source: string;
  attribution_method: string;
  attribution_confidence: string;
  treatment_type: string | null;
  treatment_value: number | null;
  conversion_status: string;
  lead_date: string;
  qualified_at: string | null;
  converted_at: string | null;
}

export interface AttributedLeadsResult {
  leads: AttributedLeadRow[];
  total: number;
}

export interface LeadsByGroup {
  group: string;
  count: number;
}

export interface AttributedLeadsFilters {
  source?: string;
  treatment?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

// --- Paginated attributed leads ---

export async function getAttributedLeads(
  clientId: number,
  days = 30,
  filters?: AttributedLeadsFilters,
): Promise<AttributedLeadsResult> {
  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 50;
  const offset = (page - 1) * pageSize;

  const conditions: string[] = [
    'al.client_id = ?',
    "al.lead_date >= date('now', '-' || ? || ' days')",
  ];
  const args: (string | number)[] = [clientId, days];

  if (filters?.source) {
    conditions.push('al.attributed_source = ?');
    args.push(filters.source);
  }
  if (filters?.treatment) {
    conditions.push('al.treatment_type = ?');
    args.push(filters.treatment);
  }
  if (filters?.status) {
    conditions.push('al.conversion_status = ?');
    args.push(filters.status);
  }

  const whereClause = conditions.join(' AND ');

  const [leads, total] = await Promise.all([
    rows<AttributedLeadRow>(`
      SELECT al.id, al.ghl_opportunity_id,
             al.contact_name, al.contact_email, al.contact_phone,
             al.attributed_source, al.attribution_method, al.attribution_confidence,
             al.treatment_type, al.treatment_value,
             al.conversion_status,
             al.lead_date, al.qualified_at, al.converted_at
      FROM attributed_leads al
      WHERE ${whereClause}
      ORDER BY al.lead_date DESC
      LIMIT ? OFFSET ?
    `, [...args, pageSize, offset]),

    scalar<number>(`
      SELECT COUNT(*)
      FROM attributed_leads al
      WHERE ${whereClause}
    `, args),
  ]);

  return { leads, total: total ?? 0 };
}

// --- Leads grouped by source ---

export async function getLeadsBySource(clientId: number, days = 30): Promise<LeadsByGroup[]> {
  return rows<LeadsByGroup>(`
    SELECT attributed_source as "group",
           COUNT(*) as count
    FROM attributed_leads
    WHERE client_id = ?
      AND lead_date >= date('now', '-' || ? || ' days')
    GROUP BY attributed_source
    ORDER BY count DESC
  `, [clientId, days]);
}

// --- Leads grouped by treatment type ---

export async function getLeadsByTreatment(clientId: number, days = 30): Promise<LeadsByGroup[]> {
  return rows<LeadsByGroup>(`
    SELECT COALESCE(treatment_type, 'unknown') as "group",
           COUNT(*) as count
    FROM attributed_leads
    WHERE client_id = ?
      AND lead_date >= date('now', '-' || ? || ' days')
    GROUP BY treatment_type
    ORDER BY count DESC
  `, [clientId, days]);
}

// --- Leads grouped by conversion status ---

export async function getLeadsByStatus(clientId: number, days = 30): Promise<LeadsByGroup[]> {
  return rows<LeadsByGroup>(`
    SELECT conversion_status as "group",
           COUNT(*) as count
    FROM attributed_leads
    WHERE client_id = ?
      AND lead_date >= date('now', '-' || ? || ' days')
    GROUP BY conversion_status
    ORDER BY
      CASE conversion_status
        WHEN 'lead' THEN 1
        WHEN 'qualified' THEN 2
        WHEN 'booked' THEN 3
        WHEN 'attended' THEN 4
        WHEN 'converted' THEN 5
        WHEN 'lost' THEN 6
        ELSE 7
      END
  `, [clientId, days]);
}
