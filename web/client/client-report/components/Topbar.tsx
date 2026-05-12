/**
 * Top bar — breadcrumb + period chip + (mode-conditional) action buttons.
 *
 * Internal mode shows Download PDF / Export / Share report.
 * Client mode shows only Download PDF.
 */
import type { ClientHeader, DashboardMode, ReportHeader } from '../types';

interface TopbarProps {
  client: ClientHeader;
  report: ReportHeader;
  tabLabel: string;
  mode: DashboardMode;
}

export function Topbar({ client, report, tabLabel, mode }: TopbarProps) {
  return (
    <header className="vr-topbar">
      <div className="vr-crumbs">
        <span>{client.name}</span>
        <span className="vr-crumb-sep">/</span>
        <span className="vr-crumb-current">{tabLabel}</span>
      </div>

      <div className="vr-topbar-actions">
        <div className="vr-date-pill" aria-label="Report period">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
            <rect x="1.5" y="2.5" width="11" height="10" rx="1" stroke="currentColor" strokeWidth="1.3" />
            <path d="M1.5 5.5H12.5M4.5 1V4M9.5 1V4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          {report.periodLabel}
        </div>

        <button
          type="button"
          className="vr-btn"
          onClick={() => window.print()}
        >
          <DownloadIcon /> Download PDF
        </button>

        {mode === 'internal' && (
          <>
            <button type="button" className="vr-btn" disabled>
              <DownloadIcon /> Export
            </button>
            <button type="button" className="vr-btn vr-btn-primary" disabled>
              Share report
            </button>
          </>
        )}
      </div>
    </header>
  );
}

function DownloadIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden>
      <path d="M6.5 1V8M3.5 5L6.5 8L9.5 5M2 11H11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
