import { rows, scalar } from './base.js';

const VENDO_LOCATION_ID = process.env.GHL_VENDO_LOCATION_ID || '';

// --- Interfaces ---

export interface PipelineOverview {
  pipeline_id: string;
  pipeline_name: string;
  stages: { id: string; name: string; position: number; count: number; value: number }[];
  totalOpen: number;
  totalOpenValue: number;
  wonThisMonth: number;
  wonThisMonthValue: number;
  lostThisMonth: number;
  totalDeals: number;
}

export interface OpportunityRow {
  id: string;
  name: string;
  monetary_value: number;
  pipeline_id: string;
  stage_id: string;
  stage_name?: string;
  pipeline_name?: string;
  status: string;
  source: string | null;
  contact_name: string | null;
  contact_company: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  created_at: string;
  updated_at: string;
  last_stage_change_at: string | null;
  days_in_stage?: number;
}

// --- Pipeline ---

export async function getPipelineOverview(pipelineId?: string): Promise<PipelineOverview[]> {
  let sql: string;
  let args: string[];

  if (pipelineId) {
    sql = 'SELECT id, name FROM ghl_pipelines WHERE id = ?';
    args = [pipelineId];
  } else if (VENDO_LOCATION_ID) {
    sql = 'SELECT id, name FROM ghl_pipelines WHERE location_id = ? ORDER BY name';
    args = [VENDO_LOCATION_ID];
  } else {
    sql = 'SELECT id, name FROM ghl_pipelines ORDER BY name';
    args = [];
  }

  const pipelines = await rows<{ id: string; name: string }>(sql, args);

  const overviews: PipelineOverview[] = [];

  for (const p of pipelines) {
    const stageData = await rows<{ id: string; name: string; position: number; count: number; value: number }>(`
      SELECT s.id, s.name, s.position,
             COUNT(o.id) as count,
             COALESCE(SUM(o.monetary_value), 0) as value
      FROM ghl_stages s
      LEFT JOIN ghl_opportunities o ON o.stage_id = s.id AND o.status = 'open'
      WHERE s.pipeline_id = ?
      GROUP BY s.id, s.name, s.position
      ORDER BY s.position
    `, [p.id]);

    const totalOpen = await scalar('SELECT COUNT(*) FROM ghl_opportunities WHERE pipeline_id = ? AND status = ?', [p.id, 'open']) ?? 0;
    const totalOpenValue = await scalar('SELECT COALESCE(SUM(monetary_value), 0) FROM ghl_opportunities WHERE pipeline_id = ? AND status = ?', [p.id, 'open']) ?? 0;

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const monthStr = monthStart.toISOString();

    const wonThisMonth = await scalar('SELECT COUNT(*) FROM ghl_opportunities WHERE pipeline_id = ? AND status = ? AND updated_at >= ?', [p.id, 'won', monthStr]) ?? 0;
    const wonThisMonthValue = await scalar('SELECT COALESCE(SUM(monetary_value), 0) FROM ghl_opportunities WHERE pipeline_id = ? AND status = ? AND updated_at >= ?', [p.id, 'won', monthStr]) ?? 0;
    const lostThisMonth = await scalar('SELECT COUNT(*) FROM ghl_opportunities WHERE pipeline_id = ? AND status = ? AND updated_at >= ?', [p.id, 'lost', monthStr]) ?? 0;
    const totalDeals = await scalar('SELECT COUNT(*) FROM ghl_opportunities WHERE pipeline_id = ?', [p.id]) ?? 0;

    overviews.push({
      pipeline_id: p.id,
      pipeline_name: p.name,
      stages: stageData,
      totalOpen: totalOpen as number,
      totalOpenValue: Math.round((totalOpenValue as number) * 100) / 100,
      wonThisMonth: wonThisMonth as number,
      wonThisMonthValue: Math.round((wonThisMonthValue as number) * 100) / 100,
      lostThisMonth: lostThisMonth as number,
      totalDeals: totalDeals as number,
    });
  }

  return overviews;
}

export async function getRecentOpportunities(limit = 10, pipelineId?: string): Promise<OpportunityRow[]> {
  const where = pipelineId ? 'AND o.pipeline_id = ?' : '';
  const args: (string | number)[] = pipelineId ? [pipelineId, limit] : [limit];
  return rows<OpportunityRow>(`
    SELECT o.*, s.name as stage_name, p.name as pipeline_name
    FROM ghl_opportunities o
    LEFT JOIN ghl_stages s ON o.stage_id = s.id
    LEFT JOIN ghl_pipelines p ON o.pipeline_id = p.id
    WHERE o.status = 'open' ${where}
    ORDER BY o.created_at DESC LIMIT ?
  `, args);
}

export async function getWonDeals(days = 30, pipelineId?: string): Promise<OpportunityRow[]> {
  const where = pipelineId ? 'AND o.pipeline_id = ?' : '';
  const args: (string | number)[] = pipelineId ? [days, pipelineId] : [days];
  return rows<OpportunityRow>(`
    SELECT o.*, s.name as stage_name, p.name as pipeline_name
    FROM ghl_opportunities o
    LEFT JOIN ghl_stages s ON o.stage_id = s.id
    LEFT JOIN ghl_pipelines p ON o.pipeline_id = p.id
    WHERE o.status = 'won' AND o.updated_at >= date('now', '-' || ? || ' days') ${where}
    ORDER BY o.updated_at DESC
  `, args);
}

export async function getStalledDeals(days = 14, pipelineId?: string): Promise<OpportunityRow[]> {
  const where = pipelineId ? 'AND o.pipeline_id = ?' : '';
  const args: (string | number)[] = pipelineId ? [days, pipelineId] : [days];
  return rows<OpportunityRow>(`
    SELECT o.*, s.name as stage_name, p.name as pipeline_name,
           CAST(julianday('now') - julianday(COALESCE(o.last_stage_change_at, o.created_at)) AS INTEGER) as days_in_stage
    FROM ghl_opportunities o
    LEFT JOIN ghl_stages s ON o.stage_id = s.id
    LEFT JOIN ghl_pipelines p ON o.pipeline_id = p.id
    WHERE o.status = 'open'
      AND julianday('now') - julianday(COALESCE(o.last_stage_change_at, o.created_at)) >= ? ${where}
    ORDER BY days_in_stage DESC
    LIMIT 20
  `, args);
}

export async function getOpportunityDetail(id: string): Promise<OpportunityRow | null> {
  const result = await rows<OpportunityRow>(`
    SELECT o.*, s.name as stage_name, p.name as pipeline_name
    FROM ghl_opportunities o
    LEFT JOIN ghl_stages s ON o.stage_id = s.id
    LEFT JOIN ghl_pipelines p ON o.pipeline_id = p.id
    WHERE o.id = ?
  `, [id]);
  return result[0] ?? null;
}

export async function getPipelineNames(): Promise<{ id: string; name: string }[]> {
  if (VENDO_LOCATION_ID) {
    return rows<{ id: string; name: string }>('SELECT id, name FROM ghl_pipelines WHERE location_id = ? ORDER BY name', [VENDO_LOCATION_ID]);
  }
  return rows<{ id: string; name: string }>('SELECT id, name FROM ghl_pipelines ORDER BY name');
}
