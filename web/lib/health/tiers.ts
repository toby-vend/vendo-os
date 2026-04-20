/**
 * Single source of truth for the client-health tier model. Both the
 * traffic-light alert job and the /clients dashboard use these boundaries
 * so UI filters and alert cohorts can never drift apart.
 *
 * Tier boundaries (decided 2026-04-20, see plans/wild-dreaming-grove.md):
 *   Healthy  ≥ 70
 *   Amber    55–69   (dashboard-only, no Slack alerts)
 *   Orange   40–54   (alerts #alerts)
 *   Red      < 40    (alerts #alerts + #slt)
 */

export type HealthTier = 'healthy' | 'amber' | 'orange' | 'red';

export const TIER_BOUNDARIES = {
  healthyMin: 70,
  amberMin: 55,
  orangeMin: 40,
} as const;

export function scoreToTier(score: number): HealthTier {
  if (score >= TIER_BOUNDARIES.healthyMin) return 'healthy';
  if (score >= TIER_BOUNDARIES.amberMin) return 'amber';
  if (score >= TIER_BOUNDARIES.orangeMin) return 'orange';
  return 'red';
}

/** Whether this tier should trigger a Slack alert (Orange + Red only). */
export function tierAlerts(tier: HealthTier): boolean {
  return tier === 'orange' || tier === 'red';
}

/** SLT is only paged on Red. */
export function tierEscalatesToSlt(tier: HealthTier): boolean {
  return tier === 'red';
}

/** Human-readable label + emoji for alert messages. */
export function tierLabel(tier: HealthTier): { label: string; emoji: string } {
  switch (tier) {
    case 'healthy': return { label: 'HEALTHY', emoji: ':large_green_circle:' };
    case 'amber': return { label: 'AMBER', emoji: ':large_yellow_circle:' };
    case 'orange': return { label: 'ORANGE', emoji: ':large_orange_circle:' };
    case 'red': return { label: 'RED', emoji: ':red_circle:' };
  }
}

/**
 * SQL CASE expression that maps a score column to a tier string. Use this
 * wherever SQL needs a tier — keeps the boundaries in one place.
 *
 *   SELECT ${tierCaseSql('ch.score')} AS tier ...
 */
export function tierCaseSql(scoreExpr: string): string {
  return `CASE
    WHEN ${scoreExpr} >= ${TIER_BOUNDARIES.healthyMin} THEN 'healthy'
    WHEN ${scoreExpr} >= ${TIER_BOUNDARIES.amberMin} THEN 'amber'
    WHEN ${scoreExpr} >= ${TIER_BOUNDARIES.orangeMin} THEN 'orange'
    ELSE 'red'
  END`;
}

/** SQL WHERE fragment for a tier filter. */
export function tierWhereSql(scoreExpr: string, tier: HealthTier): string {
  switch (tier) {
    case 'healthy': return `${scoreExpr} >= ${TIER_BOUNDARIES.healthyMin}`;
    case 'amber': return `${scoreExpr} >= ${TIER_BOUNDARIES.amberMin} AND ${scoreExpr} < ${TIER_BOUNDARIES.healthyMin}`;
    case 'orange': return `${scoreExpr} >= ${TIER_BOUNDARIES.orangeMin} AND ${scoreExpr} < ${TIER_BOUNDARIES.amberMin}`;
    case 'red': return `${scoreExpr} < ${TIER_BOUNDARIES.orangeMin}`;
  }
}

export function rankTier(tier: HealthTier): number {
  switch (tier) {
    case 'healthy': return 0;
    case 'amber': return 1;
    case 'orange': return 2;
    case 'red': return 3;
  }
}

/** True if tier `to` is strictly worse than `from`. */
export function tierDropped(from: HealthTier, to: HealthTier): boolean {
  return rankTier(to) > rankTier(from);
}
