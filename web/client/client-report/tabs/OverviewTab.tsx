/**
 * OverviewTab — Phase 2 stub.
 *
 * Real implementation lands via the B2 swarm agent. Renders the 4-KPI
 * row, the 3-channel grid, and the treatment breakdown table.
 */
import type { DashboardPayload } from '../types';

export function OverviewTab({ payload: _payload, accent: _accent }: {
  payload: DashboardPayload;
  accent: string;
}) {
  return (
    <section className="vr-tab-placeholder">
      <h2 className="vr-tab-placeholder-title">Overview</h2>
      <p className="vr-tab-placeholder-body">
        4 KPI cards + 3-channel grid + sortable treatment table — B2 in progress.
      </p>
    </section>
  );
}
