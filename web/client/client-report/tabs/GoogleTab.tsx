/**
 * GoogleTab — Phase 2/B3.
 *
 * Ported from /tmp/vendo-reporting-extract/tab-google.jsx. Sections:
 *   1. Topline metrics — 8 large stat tiles with sparkline + delta, optional
 *      booking-rate sidecar on the "bookings" tile.
 *   2. Campaigns — same table shape as Meta.
 *   3. Two-up — top keywords compact table + device split with icons.
 *
 * Device split shows a Placeholder when payload.google.devices is empty
 * (typically when flags.deviceSplitMissing — device data not synced yet).
 */
import { Sparkline } from '../components/Sparkline';
import { MiniBar } from '../components/MiniBar';
import { Delta } from '../components/Delta';
import { SectionHeader } from '../components/SectionHeader';
import { Placeholder } from '../components/Placeholder';
import { fmt } from '../lib/format';
import type {
  DashboardPayload,
  ToplineTile,
  GoogleCampaign,
  GoogleKeyword,
  GoogleDevice,
} from '../types';

export function GoogleTab({
  payload,
  accent,
}: {
  payload: DashboardPayload;
  accent: string;
}) {
  const { google } = payload;

  return (
    <div>
      <SectionHeader
        title="Google — Paid Search"
        sub="Search, Performance Max and Brand activity across UK targeting."
      />

      {/* ── Topline metrics ─────────────────────────────────────────── */}
      <div className="vr-topline-grid">
        {google.topline.map((m) => (
          <ToplineTileCard key={m.key} tile={m} accent={accent} />
        ))}
      </div>

      {/* ── Campaigns table ─────────────────────────────────────────── */}
      <SectionHeader title="Campaigns" sub="All active paid search campaigns." />
      {google.campaigns.length === 0 ? (
        <Placeholder
          label="No campaigns in this period"
          sub="Google Ads campaign data hasn't synced yet or there was no spend in the report window."
          height={140}
        />
      ) : (
        <div className="vr-data-table-wrap">
          <table className="vr-data-table">
            <thead>
              <tr>
                <th style={{ width: '28%' }}>Campaign</th>
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
              {google.campaigns.map((c) => (
                <CampaignRow key={c.name} campaign={c} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Two-up: Top keywords + Devices ──────────────────────────── */}
      <div className="vr-two-up">
        <div>
          <SectionHeader
            title="Top keywords"
            sub="Highest-volume terms by clicks."
          />
          {google.keywords.length === 0 ? (
            <Placeholder
              label="No keyword data yet"
              sub="Search-term data isn't available for this account."
              height={140}
            />
          ) : (
            <div className="vr-data-table-wrap">
              <table className="vr-data-table is-compact">
                <thead>
                  <tr>
                    <th>Keyword</th>
                    <th>Clicks</th>
                    <th>Cost</th>
                    <th>CPC</th>
                    <th>Leads</th>
                  </tr>
                </thead>
                <tbody>
                  {google.keywords.map((k) => (
                    <KeywordRow key={k.kw} keyword={k} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div>
          <SectionHeader title="Devices" sub="Lead share & CPL by device." />
          {google.devices.length === 0 ? (
            <Placeholder
              label="Device split not yet available"
              sub="Device-level segmentation isn't synced for this account. We'll fill this in once the Google Ads sync includes segments.device."
              height={140}
            />
          ) : (
            <div className="vr-device-list">
              {google.devices.map((d) => (
                <DeviceRow key={d.name} device={d} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── ToplineTileCard ────────────────────────────────────────────────────

/** Large topline tile: value + mini delta + 30-day sparkline + optional
 *  booking-rate sidecar (when key === "bookings" and totalLeads is set). */
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

function CampaignRow({ campaign }: { campaign: GoogleCampaign }) {
  const roas = campaign.spend > 0 ? campaign.revenue / campaign.spend : 0;
  // Google campaign status is a free-form string in the contract — treat
  // anything that isn't "Paused" as active for the pill colour.
  const isPaused = /paused/i.test(campaign.status);
  const statusCls = 'vr-status-pill ' + (isPaused ? 'is-paused' : 'is-active');

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

// ── KeywordRow ─────────────────────────────────────────────────────────

function KeywordRow({ keyword }: { keyword: GoogleKeyword }) {
  return (
    <tr>
      <td>
        <span className="vr-kw">{keyword.kw}</span>
      </td>
      <td className="vr-num">{fmt.number(keyword.clicks)}</td>
      <td className="vr-num">{fmt.currency(keyword.cost)}</td>
      <td className="vr-num">{fmt.currency(keyword.cpc)}</td>
      <td className="vr-num is-strong">{keyword.leads}</td>
    </tr>
  );
}

// ── DeviceRow ──────────────────────────────────────────────────────────

function DeviceRow({ device }: { device: GoogleDevice }) {
  return (
    <div className="vr-device-row">
      <div className="vr-device-head">
        <span className="vr-device-icon" aria-hidden>
          <DeviceIcon name={device.name} />
        </span>
        <span className="vr-device-name">{device.name}</span>
        <span className="vr-device-share">{device.share}%</span>
      </div>
      <MiniBar value={device.share} max={100} w="100%" h={8} />
      <div className="vr-device-foot">
        <span>{device.leads} leads</span>
        <span>CPL {fmt.currency(device.cpl)}</span>
      </div>
    </div>
  );
}

// ── Device icons (inline SVG, ported from the mockup) ──────────────────

function DeviceIcon({ name }: { name: GoogleDevice['name'] }) {
  if (name === 'Mobile') return <DeviceMobile />;
  if (name === 'Desktop') return <DeviceDesktop />;
  return <DeviceTablet />;
}

function DeviceMobile() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect
        x="3.5"
        y="1.5"
        width="7"
        height="11"
        rx="1.2"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <circle cx="7" cy="10.5" r="0.6" fill="currentColor" />
    </svg>
  );
}

function DeviceDesktop() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect
        x="1.5"
        y="2.5"
        width="11"
        height="7"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <path
        d="M5 12.5h4"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function DeviceTablet() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect
        x="2"
        y="1.5"
        width="10"
        height="11"
        rx="1.2"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <circle cx="7" cy="10.6" r="0.5" fill="currentColor" />
    </svg>
  );
}
