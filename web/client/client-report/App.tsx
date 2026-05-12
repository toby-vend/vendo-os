/**
 * Client Report dashboard — top-level shell.
 *
 * Phase 0: renders the sidebar + topbar around a "coming soon" body per
 * tab. Phase 1 fills the tab bodies with real aggregated data; Phase 2
 * ports the mockup components.
 */
import { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import type { DashboardPayload, TabId } from './types';

const TAB_LABELS: Record<TabId, string> = {
  overview: 'Overview',
  summary: 'Summary',
  meta: 'Paid Social',
  google: 'Paid Search',
  seo: 'Organic Search',
};

export function App({ payload }: { payload: DashboardPayload }) {
  const [tab, setTab] = useState<TabId>('overview');
  const { client, report, mode } = payload;

  return (
    <div className="vr-app" data-vr-mode={mode}>
      <Sidebar client={client} tab={tab} setTab={setTab} mode={mode} />
      <main className="vr-main">
        <Topbar client={client} report={report} tabLabel={TAB_LABELS[tab]} mode={mode} />
        <div className="vr-tab-content">
          <TabPlaceholder tab={tab} />
        </div>
      </main>
    </div>
  );
}

function TabPlaceholder({ tab }: { tab: TabId }) {
  // Phase 0 stub. Each tab gets its own placeholder so smoke testing the
  // navigation is obvious; Phase 2 swaps these for the real tab components.
  const messages: Record<TabId, string> = {
    overview: 'Overview — KPIs, channel breakdown and treatment table land in Phase 2.',
    summary:  'AI Summary — pulls the existing exec_summary / wins / risks / recommendations blocks into the Wins / Watch / Focus layout. Phase 2.',
    meta:     'Meta — paid social topline tiles, campaigns, creative and audiences. Phase 2.',
    google:   'Google — paid search topline tiles, campaigns, keywords and device split. Phase 2.',
    seo:      'SEO — organic topline, Search Console chart, GBP + GeoGrid (coming soon), top pages and queries. Phase 2.',
  };
  return (
    <section className="vr-tab-placeholder">
      <h2 className="vr-tab-placeholder-title">{TAB_LABELS[tab]}</h2>
      <p className="vr-tab-placeholder-body">{messages[tab]}</p>
      <p className="vr-tab-placeholder-meta">
        Phase 0 shell — see <code>plans/2026-05-12-client-report-v2-tab-dashboard.md</code>.
      </p>
    </section>
  );
}
