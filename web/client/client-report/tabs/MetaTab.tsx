/**
 * MetaTab — Phase 2/B3.
 *
 * Ported from /tmp/vendo-reporting-extract/tab-meta.jsx. Sections:
 *   1. Topline metrics — 8 large stat tiles with sparkline + delta, optional
 *      booking-rate sidecar on the "bookings" tile.
 *   2. Campaigns — sortable status/spend/leads/CPL/revenue/ROAS table.
 *   3. Two-up — top creative grid + audience share list.
 *
 * All visual tokens come from the `--vr-*` namespace defined in
 * public/assets/client-report.css. Creative thumbnails handle the
 * null-URL case (Meta CDN expiry) by falling back to a teal gradient.
 */
import type { CSSProperties } from 'react';
import { Sparkline } from '../components/Sparkline';
import { MiniBar } from '../components/MiniBar';
import { Delta } from '../components/Delta';
import { SectionHeader } from '../components/SectionHeader';
import { Placeholder } from '../components/Placeholder';
import { fmt } from '../lib/format';
import type {
  DashboardPayload,
  ToplineTile,
  MetaCampaign,
  MetaCreative,
  MetaAudience,
} from '../types';

/** Fallback gradient used when a Meta creative thumb URL is null/expired. */
const CREATIVE_FALLBACK =
  'linear-gradient(135deg, oklch(0.78 0.08 195), oklch(0.66 0.1 215))';

export function MetaTab({
  payload,
  accent,
}: {
  payload: DashboardPayload;
  accent: string;
}) {
  const { meta } = payload;
  // Used to scale the audience MiniBar — max of all audience leads.
  const maxAudienceLeads = meta.audiences.length
    ? Math.max(...meta.audiences.map((a) => a.leads))
    : 0;

  return (
    <div>
      <SectionHeader
        title="Meta — Paid Social"
        sub="Facebook & Instagram performance across prospecting, lookalike and retargeting."
      />

      {/* ── Topline metrics ─────────────────────────────────────────── */}
      <div className="vr-topline-grid">
        {meta.topline.map((m) => (
          <ToplineTileCard key={m.key} tile={m} accent={accent} />
        ))}
      </div>

      {/* ── Campaigns table ─────────────────────────────────────────── */}
      <SectionHeader title="Campaigns" sub="Active and recently-paused campaigns." />
      {meta.campaigns.length === 0 ? (
        <Placeholder
          label="No campaigns in this period"
          sub="Meta campaign data hasn't synced yet or there was no spend in the report window."
          height={140}
        />
      ) : (
        <div className="vr-data-table-wrap">
          <table className="vr-data-table">
            <thead>
              <tr>
                <th style={{ width: '30%' }}>Campaign</th>
                <th>Status</th>
                <th>Spend</th>
                <th>Impr.</th>
                <th>Clicks</th>
                <th>Leads</th>
                <th>CPL</th>
                <th>Revenue</th>
                <th>ROAS</th>
              </tr>
            </thead>
            <tbody>
              {meta.campaigns.map((c) => (
                <CampaignRow key={c.name} campaign={c} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Two-up: Top creative + Audiences ────────────────────────── */}
      <div className="vr-two-up">
        <div>
          <SectionHeader
            title="Top creative"
            sub="Best-performing assets this period."
          />
          {meta.creative.length === 0 ? (
            <Placeholder
              label="No creative data yet"
              sub="Meta creative insights are still syncing."
              height={140}
            />
          ) : (
            <div className="vr-creative-grid">
              {meta.creative.map((c) => (
                <CreativeCard key={c.name} creative={c} />
              ))}
            </div>
          )}
        </div>

        <div>
          <SectionHeader
            title="Audiences"
            sub="Lead share by targeting segment."
          />
          {meta.audiences.length === 0 ? (
            <Placeholder
              label="No audience data yet"
              sub="Audience-level breakdown isn't available for this account."
              height={140}
            />
          ) : (
            <div className="vr-audience-list">
              {meta.audiences.map((a) => (
                <AudienceRow key={a.name} audience={a} maxLeads={maxAudienceLeads} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── ToplineTileCard ────────────────────────────────────────────────────

/**
 * A large stat tile with value, mini delta and 30-day sparkline.
 * For the "bookings" tile, also renders a small Booking-rate badge.
 */
function ToplineTileCard({
  tile,
  accent,
}: {
  tile: ToplineTile;
  accent: string;
}) {
  const valueFmt = fmt.by(tile.format);
  const showBookingRate =
    tile.key === 'bookings' && tile.totalLeads != null && tile.totalLeads > 0;
  const bookingRatePct = showBookingRate
    ? ((tile.value / (tile.totalLeads as number)) * 100).toFixed(1)
    : null;

  return (
    <div className="vr-stat-tile is-lg">
      <div className="vr-stat-label">{tile.label}</div>
      <div className="vr-stat-value is-lg">{valueFmt(tile.value)}</div>
      <Delta curr={tile.value} prev={tile.prev} inverse={tile.inverse} mini />
      {tile.series && tile.series.length > 1 && (
        <div style={{ marginTop: 10 }}>
          <Sparkline data={tile.series} w={180} h={28} color={accent} />
        </div>
      )}
      {showBookingRate && (
        <div className="vr-booking-rate">
          <span className="vr-booking-rate-label">Booking rate</span>
          <span className="vr-booking-rate-value">{bookingRatePct}%</span>
        </div>
      )}
    </div>
  );
}

// ── CampaignRow ────────────────────────────────────────────────────────

function CampaignRow({ campaign }: { campaign: MetaCampaign }) {
  const statusCls =
    'vr-status-pill ' + (campaign.status === 'Active' ? 'is-active' : 'is-paused');
  const roas = campaign.spend > 0 ? campaign.revenue / campaign.spend : 0;
  return (
    <tr>
      <td>
        <div className="vr-row-name">{campaign.name}</div>
      </td>
      <td>
        <span className={statusCls}>
          <span className="vr-status-dot" />
          {campaign.status}
        </span>
      </td>
      <td className="vr-num">{fmt.currency(campaign.spend)}</td>
      <td className="vr-num">{fmt.number(campaign.impr)}</td>
      <td className="vr-num">{fmt.number(campaign.clicks)}</td>
      <td className="vr-num">{campaign.leads}</td>
      <td className="vr-num">{fmt.currency(campaign.cpl)}</td>
      <td className="vr-num is-strong">{fmt.currency(campaign.revenue)}</td>
      <td className="vr-num">{roas.toFixed(1)}×</td>
    </tr>
  );
}

// ── CreativeCard ───────────────────────────────────────────────────────

/**
 * One creative tile in the 2×2 grid. `thumb` is either a Meta CDN URL
 * (used directly as a CSS background-image) or null — we fall back to a
 * teal gradient that matches the mockup's placeholder pattern.
 */
function CreativeCard({ creative }: { creative: MetaCreative }) {
  const thumbStyle: CSSProperties = creative.thumb
    ? {
        background: `center / cover no-repeat url("${creative.thumb}")`,
      }
    : { background: CREATIVE_FALLBACK };

  return (
    <div className="vr-creative-card">
      <div className="vr-creative-thumb" style={thumbStyle}>
        <span className="vr-creative-thumb-label">creative</span>
      </div>
      <div className="vr-creative-body">
        <div className="vr-creative-name">{creative.name}</div>
        <div className="vr-creative-stats">
          <span>
            <span className="vr-creative-stat-label">Spend</span>{' '}
            {fmt.currency(creative.spend)}
          </span>
          <span>
            <span className="vr-creative-stat-label">Leads</span> {creative.leads}
          </span>
          <span>
            <span className="vr-creative-stat-label">CPL</span>{' '}
            {fmt.currency(creative.cpl)}
          </span>
          <span>
            <span className="vr-creative-stat-label">CTR</span>{' '}
            {creative.ctr.toFixed(2)}%
          </span>
        </div>
      </div>
    </div>
  );
}

// ── AudienceRow ────────────────────────────────────────────────────────

function AudienceRow({
  audience,
  maxLeads,
}: {
  audience: MetaAudience;
  maxLeads: number;
}) {
  return (
    <div className="vr-audience-row">
      <div className="vr-audience-head">
        <span className="vr-audience-name">{audience.name}</span>
        <span className="vr-audience-pct">{audience.share}%</span>
      </div>
      <MiniBar value={audience.leads} max={maxLeads} w="100%" h={8} />
      <div className="vr-audience-foot">
        <span>{audience.leads} leads</span>
        <span>CPL {fmt.currency(audience.cpl)}</span>
      </div>
    </div>
  );
}
