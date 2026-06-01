/**
 * SeoTab — Organic Search.
 *
 * Sections, in order:
 *   1. Header + 30d/90d segmented control
 *   2. Topline tiles (6 per period)
 *   3. Insights cards (good / watch)
 *   4. Search Console weekly chart (24m)
 *   5. Local GeoGrid placeholder
 *   6. Google Business Profile placeholder
 *   7. Two-up: top landing pages + top queries
 *   8. Site health tiles
 *
 * Real data comes from `payload.seo`. Insights are hard-coded for now —
 * see `insights30` / `insights90` at the bottom of this file. A future
 * phase will wire them to the AI summary block.
 */
import { useState } from 'react';
import type { DashboardPayload } from '../types';
import { SectionHeader } from '../components/SectionHeader';
import { Delta } from '../components/Delta';
import { Placeholder } from '../components/Placeholder';
import { SearchConsoleChart } from '../components/SearchConsoleChart';
import { GeoGrid } from '../components/GeoGrid';
import { GeoGridPlaceholder } from '../components/GeoGridPlaceholder';
import { GbpPlaceholder } from '../components/GbpPlaceholder';
import { fmt } from '../lib/format';

type Period = '30' | '90';

interface InsightCard {
  kind: 'good' | 'watch';
  tag: string;
  headline: string;
  body: string;
  metric: { label: string; value: string };
}

export function SeoTab({ payload }: { payload: DashboardPayload; accent: string }) {
  const { seo } = payload;
  const [period, setPeriod] = useState<Period>('30');
  const topline = period === '30' ? seo.topline30 : seo.topline90;
  const periodLabel = period === '30' ? 'Last 30 days vs prior 30' : 'Last 90 days vs prior 90';
  const insights = period === '30' ? insights30 : insights90;

  return (
    <div className="vr-tab">
      {/* Header + 30d / 90d toggle */}
      <SectionHeader
        title="Organic Search — SEO"
        sub="Topline performance and comparative trends across recent periods."
        action={
          <div className="vr-seg" role="tablist" aria-label="Period">
            <button
              type="button"
              role="tab"
              aria-selected={period === '30'}
              className={'vr-seg-btn ' + (period === '30' ? 'is-active' : '')}
              onClick={() => setPeriod('30')}
            >
              Last 30d
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={period === '90'}
              className={'vr-seg-btn ' + (period === '90' ? 'is-active' : '')}
              onClick={() => setPeriod('90')}
            >
              Last 90d
            </button>
          </div>
        }
      />

      {/* Topline tiles */}
      <div className="vr-seo-topline">
        {topline.map((m) => (
          <div key={m.key} className="vr-seo-tile">
            <div className="vr-seo-tile-label">{m.label}</div>
            <div className="vr-seo-tile-value">{fmt.by(m.format)(m.value)}</div>
            <div className="vr-kpi-row">
              <Delta curr={m.value} prev={m.prev} inverse={m.inverse} mini />
              <span className="vr-kpi-compare">{periodLabel}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Insights */}
      <SectionHeader
        title="Insights"
        sub={period === '30' ? 'What changed vs the previous 30 days.' : 'What changed vs the previous 90 days.'}
      />
      <div className="vr-insights-grid">
        {insights.map((ins, i) => (
          <div key={i} className={'vr-insight-card is-' + ins.kind}>
            <div className="vr-insight-tag">{ins.tag}</div>
            <div className="vr-insight-headline">{ins.headline}</div>
            <p className="vr-insight-body">{ins.body}</p>
            <div className="vr-insight-metric">
              <span className="vr-insight-metric-label">{ins.metric.label}</span>
              <span className="vr-insight-metric-value">{ins.metric.value}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Search Console weekly trend */}
      <SectionHeader
        title="Search Console — Performance"
        sub="Weekly trend over the last 24 months. Hover the chart for details."
      />
      {seo.searchConsoleSeries ? (
        <SearchConsoleChart series={seo.searchConsoleSeries} />
      ) : (
        <Placeholder
          label="Search Console data not yet synced"
          height={220}
          sub="Once Google Search Console syncs land in gsc_daily / gsc_queries the 24-month chart renders here automatically."
        />
      )}

      {/* Local GeoGrid */}
      <SectionHeader
        title="Local GeoGrid"
        sub="Google Maps rankings across a grid of points centred on the practice."
      />
      {seo.geoGrid ? <GeoGrid block={seo.geoGrid} /> : <GeoGridPlaceholder />}

      {/* Google Business Profile */}
      <SectionHeader
        title="Google Business Profile"
        sub="Customer interactions vs same period last year."
      />
      <GbpPlaceholder />

      {/* Two-up: top pages + top queries */}
      <div className="vr-two-up">
        <div>
          <SectionHeader title="Top landing pages" sub="By organic users." />
          <div className="vr-data-table-wrap is-compact">
            <table className="vr-data-table is-compact">
              <thead>
                <tr>
                  <th>Page</th>
                  <th>Users</th>
                  <th>Leads</th>
                  <th>Δ</th>
                </tr>
              </thead>
              <tbody>
                {seo.topPages.map((p) => (
                  <tr key={p.url}>
                    <td>
                      <span className="vr-kw">{p.url}</span>
                    </td>
                    <td className="vr-num">{fmt.number(p.users)}</td>
                    <td className="vr-num">{p.leads}</td>
                    <td>
                      <span
                        style={{
                          color: p.change >= 0 ? 'var(--vr-good)' : 'var(--vr-bad)',
                          fontFamily: 'var(--vr-mono)',
                          fontSize: 12,
                        }}
                      >
                        {p.change > 0 ? '+' : ''}
                        {p.change.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <SectionHeader title="Top queries" sub="Search Console — clicks & ranking." />
          <div className="vr-data-table-wrap is-compact">
            <table className="vr-data-table is-compact">
              <thead>
                <tr>
                  <th>Query</th>
                  <th>Clicks</th>
                  <th>Impr.</th>
                  <th>Pos.</th>
                  <th>Δ Pos.</th>
                </tr>
              </thead>
              <tbody>
                {seo.queries.map((q) => (
                  <tr key={q.q}>
                    <td>
                      <span className="vr-kw">{q.q}</span>
                    </td>
                    <td className="vr-num">{fmt.number(q.clicks)}</td>
                    <td className="vr-num">{fmt.number(q.impr)}</td>
                    <td className="vr-num">{q.pos.toFixed(1)}</td>
                    <td>
                      <span
                        style={{
                          color: q.posChange <= 0 ? 'var(--vr-good)' : 'var(--vr-bad)',
                          fontFamily: 'var(--vr-mono)',
                          fontSize: 12,
                        }}
                      >
                        {q.posChange > 0 ? '+' : ''}
                        {q.posChange.toFixed(1)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Site health */}
      <SectionHeader title="Site health" />
      <div className="vr-health-grid">
        <div className="vr-health-tile">
          <span className="vr-health-label">Indexed pages</span>
          <span className="vr-health-value">{fmt.number(seo.health.indexed)}</span>
        </div>
        <div className="vr-health-tile">
          <span className="vr-health-label">Crawl errors</span>
          <span className="vr-health-value">{seo.health.crawlErrors}</span>
        </div>
        <div className="vr-health-tile">
          <span className="vr-health-label">Core Web Vitals</span>
          <span
            className={
              'vr-health-value ' + (seo.health.coreWebVitals === 'Good' ? 'is-good' : '')
            }
          >
            {seo.health.coreWebVitals}
          </span>
        </div>
        <div className="vr-health-tile">
          <span className="vr-health-label">Backlinks</span>
          <span className="vr-health-value">{fmt.number(seo.health.backlinks)}</span>
        </div>
        <div className="vr-health-tile">
          <span className="vr-health-label">Referring domains</span>
          <span className="vr-health-value">{fmt.number(seo.health.referringDomains)}</span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Hard-coded insight cards. Ported verbatim from the mockup; a future
// phase wires them to AI-generated insights for the actual client.
// ─────────────────────────────────────────────────────────────────────

const insights30: InsightCard[] = [
  {
    kind: 'good',
    tag: 'Win',
    headline: 'Emergency Dentist landing page surged',
    body: '/emergency-dentist-manchester users up sharply after on-page refresh on Apr 14 and 4 new internal links from blog posts.',
    metric: { label: 'Users (30d)', value: '+42.1%' },
  },
  {
    kind: 'good',
    tag: 'Ranking',
    headline: 'Invisalign Manchester moved up the SERP',
    body: "Average position improved from 6.5 → 4.1 for 'invisalign manchester cost'. Worth a CRO pass on the page.",
    metric: { label: 'Δ Position', value: '−2.4' },
  },
  {
    kind: 'watch',
    tag: 'Watch',
    headline: 'Branded query plateau',
    body: "Clicks on 'vendo dental' flat MoM. Suggest a small Brand campaign on Google to shore up SERP real estate.",
    metric: { label: 'Clicks', value: '410' },
  },
];

const insights90: InsightCard[] = [
  {
    kind: 'good',
    tag: 'Trend',
    headline: 'Sustained 28.6% lift in organic users',
    body: 'Quarter-over-quarter growth driven by treatment landing pages and the new emergency content cluster.',
    metric: { label: 'Δ Users (90d)', value: '+28.6%' },
  },
  {
    kind: 'good',
    tag: 'Pipeline',
    headline: 'SEO-attributed revenue up 39.5%',
    body: 'Higher-intent queries (implants, makeover) now contribute 42% of organic leads, up from 31% last quarter.',
    metric: { label: 'Δ Revenue (90d)', value: '+39.5%' },
  },
  {
    kind: 'watch',
    tag: 'Risk',
    headline: "Generic 'best dentist near me' still page 2",
    body: 'Plateau at position 9–10 over 90d despite content updates. Recommend backlink push & schema review.',
    metric: { label: 'Avg Position', value: '9.8' },
  },
];
