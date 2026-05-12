/**
 * GoogleTab — Phase 2 stub.
 * Real implementation: 8 topline tiles + campaigns + keywords + device split.
 */
import type { DashboardPayload } from '../types';

export function GoogleTab({ payload: _payload, accent: _accent }: {
  payload: DashboardPayload;
  accent: string;
}) {
  return (
    <section className="vr-tab-placeholder">
      <h2 className="vr-tab-placeholder-title">Paid Search — Google</h2>
      <p className="vr-tab-placeholder-body">
        8 topline tiles + campaigns + keywords + device split — B3 in progress.
      </p>
    </section>
  );
}
