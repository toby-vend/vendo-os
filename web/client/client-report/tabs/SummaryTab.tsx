/**
 * SummaryTab — Phase 2 stub.
 * Real implementation: AI headline + Wins / Watch / Focus pillars + topline mirror.
 */
import type { DashboardPayload } from '../types';

export function SummaryTab({ payload: _payload, accent: _accent }: {
  payload: DashboardPayload;
  accent: string;
}) {
  return (
    <section className="vr-tab-placeholder">
      <h2 className="vr-tab-placeholder-title">AI Summary</h2>
      <p className="vr-tab-placeholder-body">
        AI headline + Wins / Watch / Focus pillars + topline mirror — B2 in progress.
      </p>
    </section>
  );
}
