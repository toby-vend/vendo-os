/**
 * SeoTab — Phase 2 stub.
 * Real implementation: 30d/90d toggle + topline + insights + Search
 * Console 24-month chart + GeoGrid/GBP placeholders + tables + health.
 */
import type { DashboardPayload } from '../types';

export function SeoTab({ payload: _payload, accent: _accent }: {
  payload: DashboardPayload;
  accent: string;
}) {
  return (
    <section className="vr-tab-placeholder">
      <h2 className="vr-tab-placeholder-title">Organic Search — SEO</h2>
      <p className="vr-tab-placeholder-body">
        Topline + insights + 24-month Search Console chart + GeoGrid &amp; GBP placeholders + pages/queries — B4 in progress.
      </p>
    </section>
  );
}
