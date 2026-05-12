/**
 * MetaTab — Phase 2 stub.
 * Real implementation: 8 topline tiles + campaigns + creative + audiences.
 */
import type { DashboardPayload } from '../types';

export function MetaTab({ payload: _payload, accent: _accent }: {
  payload: DashboardPayload;
  accent: string;
}) {
  return (
    <section className="vr-tab-placeholder">
      <h2 className="vr-tab-placeholder-title">Paid Social — Meta</h2>
      <p className="vr-tab-placeholder-body">
        8 topline tiles with sparklines + campaigns table + creative grid + audiences — B3 in progress.
      </p>
    </section>
  );
}
