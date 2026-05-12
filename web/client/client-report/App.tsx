/**
 * Client Report dashboard — top-level shell.
 *
 * Phase 2: wires the real tab components and the TweaksPanel.
 * Internal mode shows the tweaks drawer + accent-hue / density / dark
 * mode customisation; client mode hides everything except the data.
 */
import { useEffect, useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { TweaksPanel } from './components/TweaksPanel';
import { OverviewTab } from './tabs/OverviewTab';
import { SummaryTab } from './tabs/SummaryTab';
import { MetaTab } from './tabs/MetaTab';
import { GoogleTab } from './tabs/GoogleTab';
import { SeoTab } from './tabs/SeoTab';
import { useTweaks, TWEAK_DEFAULTS } from './lib/useTweaks';
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
  const [tweaks, setTweak] = useTweaks();
  const { client, report, mode } = payload;
  const isClient = mode === 'client';

  // Apply tweaks to the root element. Client mode locks to defaults.
  useEffect(() => {
    const root = document.getElementById('report-root');
    if (!root) return;
    const t = isClient ? TWEAK_DEFAULTS : tweaks;
    root.setAttribute('data-vr-theme', t.darkMode ? 'dark' : 'light');
    root.setAttribute('data-vr-density', t.density);
    root.style.setProperty('--vr-accent', `oklch(0.55 0.12 ${t.accentHue})`);
    root.style.setProperty(
      '--vr-accent-soft',
      `oklch(0.55 0.12 ${t.accentHue} / 0.1)`,
    );
  }, [isClient, tweaks]);

  const accent = `oklch(0.55 0.12 ${(isClient ? TWEAK_DEFAULTS : tweaks).accentHue})`;

  return (
    <div className="vr-app" data-vr-mode={mode}>
      <Sidebar client={client} tab={tab} setTab={setTab} mode={mode} />
      <main className="vr-main">
        <Topbar client={client} report={report} tabLabel={TAB_LABELS[tab]} mode={mode} />
        <div className="vr-tab-content">
          {tab === 'overview' && <OverviewTab payload={payload} accent={accent} />}
          {tab === 'summary' && <SummaryTab payload={payload} accent={accent} />}
          {tab === 'meta' && <MetaTab payload={payload} accent={accent} />}
          {tab === 'google' && <GoogleTab payload={payload} accent={accent} />}
          {tab === 'seo' && <SeoTab payload={payload} accent={accent} />}
        </div>
      </main>
      {!isClient && <TweaksPanel tweaks={tweaks} setTweak={setTweak} />}
    </div>
  );
}
