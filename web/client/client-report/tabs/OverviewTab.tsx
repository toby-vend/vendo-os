/**
 * OverviewTab — Phase 2/B2.
 *
 * Three sections, ported from /tmp/vendo-reporting-extract/tab-overview.jsx:
 *   1. Performance summary — KPI grid
 *   2. Channel breakdown   — one card per Meta / Google / SEO channel
 *   3. Treatment breakdown — sortable service-line table
 *
 * Uses the primitives already shipped (KpiCard, StatTile, ChannelPip,
 * SectionHeader, MiniBar, Placeholder, fmt). All visual tokens come from
 * the `--vr-*` namespace defined in public/assets/client-report.css.
 *
 * Tab navigation: the "Open →" link on each channel card emits a
 * `vendo-tab` CustomEvent so App can route to the channel tab without
 * having to thread `setTab` down through every level.
 */
import { useMemo, useState } from 'react';
import { KpiCard } from '../components/KpiCard';
import { StatTile } from '../components/StatTile';
import { ChannelPip } from '../components/ChannelPip';
import { SectionHeader } from '../components/SectionHeader';
import { MiniBar } from '../components/MiniBar';
import { Placeholder } from '../components/Placeholder';
import { fmt } from '../lib/format';
import type {
  DashboardPayload,
  OverviewChannel,
  OverviewTreatment,
} from '../types';

type SortKey = 'spend' | 'leads' | 'cpl' | 'cac' | 'revenue';
type SortDir = 'asc' | 'desc';

export function OverviewTab({
  payload,
  accent,
}: {
  payload: DashboardPayload;
  accent: string;
}) {
  const { overview, flags } = payload;
  const [sortKey, setSortKey] = useState<SortKey>('revenue');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // When the client's GHL source data can't link leads to treatments, the
  // lead/cpl/cac/revenue columns are null — show spend only.
  const attribUnavailable = Boolean(flags.treatmentLeadAttributionUnavailable);

  const sortedTreatments = useMemo<OverviewTreatment[]>(() => {
    const arr = [...overview.treatments];
    arr.sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      return ((Number(a[sortKey] ?? 0)) - (Number(b[sortKey] ?? 0))) * dir;
    });
    return arr;
  }, [overview.treatments, sortKey, sortDir]);

  const totalRev = overview.treatments.reduce((s, t) => s + (t.revenue ?? 0), 0);
  const totalSpend = overview.treatments.reduce((s, t) => s + t.spend, 0);

  const setSort = (key: SortKey): void => {
    if (key === sortKey) {
      setSortDir(sortDir === 'desc' ? 'asc' : 'desc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const sortIcon = (key: SortKey) => {
    if (key !== sortKey) return <span style={{ opacity: 0.3 }}>↕</span>;
    return <span>{sortDir === 'desc' ? '↓' : '↑'}</span>;
  };

  const openChannel = (key: OverviewChannel['key']) => {
    window.dispatchEvent(new CustomEvent('vendo-tab', { detail: key }));
  };

  const treatmentsSub =
    'Performance by service line. Sort by any column.' +
    (flags.averageCaseValueIsDefault
      ? ' Using default average case values until your closed-won data backfills.'
      : '');

  return (
    <div className="vr-tab-content">
      {/* ── Performance summary ─────────────────────────────────────── */}
      <SectionHeader
        title="Performance summary"
        sub="Paid media activity across Meta, Google and SEO."
      />
      <div className="vr-kpi-grid">
        {overview.kpis.map((k) => (
          <KpiCard key={k.key} kpi={k} accent={accent} />
        ))}
      </div>

      {/* ── Channel breakdown ───────────────────────────────────────── */}
      <SectionHeader
        title="Channel breakdown"
        sub="Spend, leads and revenue by channel."
      />
      <div className="vr-channel-grid">
        {overview.channels.map((ch) => (
          <ChannelCard
            key={ch.key}
            channel={ch}
            bookingPipelineMissing={Boolean(flags.bookingPipelineMissing)}
            onOpen={() => openChannel(ch.key)}
          />
        ))}
      </div>

      {/* ── Treatment breakdown ─────────────────────────────────────── */}
      <SectionHeader
        title="Treatment breakdown"
        sub={treatmentsSub}
        action={
          <div className="vr-totals">
            <span>
              <span className="vr-totals-label">Total spend</span>{' '}
              <strong>{fmt.currency(totalSpend)}</strong>
            </span>
            {!attribUnavailable && (
              <span>
                <span className="vr-totals-label">Total revenue</span>{' '}
                <strong>{fmt.currency(totalRev)}</strong>
              </span>
            )}
          </div>
        }
      />
      {sortedTreatments.length === 0 ? (
        <Placeholder
          label="No treatment mappings yet"
          sub="Configure campaign → treatment mappings in the admin panel to see this breakdown."
          height={140}
        />
      ) : (
        <div className="vr-data-table-wrap">
          <table className="vr-data-table">
            <thead>
              <tr>
                <th style={{ width: '26%' }}>Treatment</th>
                <th onClick={() => setSort('spend')}>Spend {sortIcon('spend')}</th>
                <th onClick={() => setSort('leads')}>Leads {sortIcon('leads')}</th>
                <th onClick={() => setSort('cpl')}>CPL {sortIcon('cpl')}</th>
                <th onClick={() => setSort('cac')}>CAC {sortIcon('cac')}</th>
                <th onClick={() => setSort('revenue')}>Revenue {sortIcon('revenue')}</th>
                <th style={{ width: '18%' }}>Share of revenue</th>
              </tr>
            </thead>
            <tbody>
              {sortedTreatments.map((t) => (
                <tr key={t.name}>
                  <td>
                    <div className="vr-row-name">{t.name}</div>
                    {!attribUnavailable && (
                      <div className="vr-row-sub">
                        avg case value {fmt.currency(t.avgValue)}
                        {t.avgValueIsDefault && (
                          <span
                            title="Using a default benchmark — replaced once client closed-won data lands."
                            style={{
                              marginLeft: 6,
                              padding: '1px 6px',
                              borderRadius: 4,
                              fontSize: 10,
                              color: 'var(--vr-ink-3)',
                              border: '1px solid var(--vr-rule)',
                            }}
                          >
                            default
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="vr-num">{fmt.currency(t.spend)}</td>
                  <td className="vr-num">{t.leads == null ? '—' : t.leads}</td>
                  <td className="vr-num">{t.cpl == null ? '—' : fmt.currency(t.cpl)}</td>
                  <td className="vr-num">{t.cac == null ? '—' : fmt.currency(t.cac)}</td>
                  <td className="vr-num is-strong">
                    {t.revenue == null ? '—' : fmt.currency(t.revenue)}
                  </td>
                  <td>
                    {t.revenue == null ? (
                      <span className="vr-num">—</span>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <MiniBar value={t.revenue} max={totalRev} w={100} />
                        <span
                          style={{
                            fontFamily: 'var(--vr-mono)',
                            fontSize: 11,
                            color: 'var(--vr-ink-2)',
                          }}
                        >
                          {totalRev > 0
                            ? ((t.revenue / totalRev) * 100).toFixed(1)
                            : '0.0'}
                          %
                        </span>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {attribUnavailable && (
            <p
              style={{
                margin: '10px 2px 0',
                fontSize: 12,
                lineHeight: 1.5,
                color: 'var(--vr-ink-3)',
              }}
            >
              ⓘ Lead and revenue figures by treatment aren’t available for this
              client yet — the CRM records leads by channel (paid search, paid
              social) rather than by campaign, so they can’t be split across
              service lines. Spend is shown per treatment from campaign names.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── ChannelCard ────────────────────────────────────────────────────────

interface ChannelCardProps {
  channel: OverviewChannel;
  bookingPipelineMissing: boolean;
  onOpen: () => void;
}

/**
 * One card in the channel breakdown grid. Shows pip + name + sub, four
 * stat tiles, and one delta row per metric on `channel.delta`.
 *
 * The delta colouring rule mirrors the mockup: positive deltas are green
 * for every metric *except* CPL, where a negative delta is the win.
 */
function ChannelCard({ channel, bookingPipelineMissing, onOpen }: ChannelCardProps) {
  const deltaEntries = Object.entries(channel.delta) as Array<
    [keyof typeof channel.delta, number]
  >;

  // Surface the booking-pipeline footnote when revenue is zero because
  // we couldn't match a Booked Appointment pipeline in GHL.
  const showBookingFootnote =
    bookingPipelineMissing && channel.revenue === 0 && channel.key !== 'seo';

  return (
    <div className="vr-channel-card">
      <div className="vr-channel-head">
        <ChannelPip tone={channel.tone} letter={channel.name.charAt(0)} />
        <div>
          <div className="vr-channel-name">{channel.name}</div>
          <div className="vr-channel-sub">{channel.sub}</div>
        </div>
        <a
          className="vr-channel-link"
          href={`#${channel.key}`}
          onClick={(e) => {
            e.preventDefault();
            onOpen();
          }}
        >
          Open <span style={{ marginLeft: 2 }}>→</span>
        </a>
      </div>

      <div className="vr-channel-stats">
        {channel.spend != null ? (
          <StatTile label="Spend" value={channel.spend} format="currency" />
        ) : (
          <StatTile label="Traffic" value={channel.traffic ?? 0} format="number" />
        )}
        <StatTile label="Leads" value={channel.leads} format="number" />
        <StatTile label="CPL" value={channel.cpl} format="currency" />
        <StatTile label="Revenue" value={channel.revenue} format="currency" />
      </div>

      <div className="vr-channel-deltas">
        {deltaEntries.map(([k, vRaw]) => {
          const v = vRaw as number;
          const isGood = k === 'cpl' ? v < 0 : v > 0;
          return (
            <span key={k} className="vr-delta-row">
              <span className="vr-delta-label">{k}</span>
              <span
                style={{
                  color: isGood ? 'var(--vr-good)' : 'var(--vr-bad)',
                  fontFamily: 'var(--vr-mono)',
                  fontSize: 11,
                }}
              >
                {v > 0 ? '+' : ''}
                {v.toFixed(1)}%
              </span>
            </span>
          );
        })}
      </div>

      {showBookingFootnote && (
        <div
          style={{
            marginTop: 8,
            fontSize: 11,
            color: 'var(--vr-ink-3)',
            fontStyle: 'italic',
          }}
        >
          Revenue shows £0 — no “Booked Appointment” pipeline matched in GHL.
        </div>
      )}
    </div>
  );
}
