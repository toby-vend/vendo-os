/**
 * Left sidebar — brand, client switch (placeholder), tab nav.
 *
 * In internal mode the client switch is interactive (Phase 3); in client
 * mode it's static (clients only see their own report).
 */
import type { ClientHeader, DashboardMode, TabId } from '../types';

interface SidebarProps {
  client: ClientHeader;
  tab: TabId;
  setTab: (t: TabId) => void;
  mode: DashboardMode;
}

const TABS: Array<{ id: TabId; label: string; pill: string | null; icon: 'overview' | 'summary' | 'meta' | 'google' | 'seo' }> = [
  { id: 'overview', label: 'Overview',       pill: null,     icon: 'overview' },
  { id: 'summary',  label: 'Summary',        pill: 'AI',     icon: 'summary' },
  { id: 'meta',     label: 'Paid Social',    pill: 'Meta',   icon: 'meta' },
  { id: 'google',   label: 'Paid Search',    pill: 'Google', icon: 'google' },
  { id: 'seo',      label: 'Organic Search', pill: 'SEO',    icon: 'seo' },
];

export function Sidebar({ client, tab, setTab, mode }: SidebarProps) {
  return (
    <aside className="vr-sidebar">
      <div className="vr-brand">
        <div className="vr-brand-mark">V</div>
        <div>
          <div className="vr-brand-name">Vendo Reporting</div>
          <div className="vr-brand-sub">v2.0 · {new Date().toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}</div>
        </div>
      </div>

      <div className="vr-client-switch" aria-label={mode === 'client' ? 'Your account' : 'Switch client'}>
        <div className="vr-client-mono">{client.initials}</div>
        <div className="vr-client-body">
          <div className="vr-client-name">{client.name}</div>
          <div className="vr-client-meta">{client.location}</div>
        </div>
        {mode === 'internal' && (
          <svg className="vr-client-chev" width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
            <path d="M3 5L6 8L9 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>

      <div className="vr-nav-label">Reporting</div>
      {TABS.map(t => (
        <button
          key={t.id}
          type="button"
          className={'vr-nav-item ' + (tab === t.id ? 'is-active' : '')}
          onClick={() => setTab(t.id)}
        >
          <span className="vr-nav-icon"><NavIcon kind={t.icon} /></span>
          <span>{t.label}</span>
          {t.pill && <span className="vr-nav-pill">{t.pill}</span>}
        </button>
      ))}

      <div className="vr-sidebar-foot">
        <span className="vr-dot" />
        <span>Data synced · just now</span>
      </div>
    </aside>
  );
}

function NavIcon({ kind }: { kind: 'overview' | 'summary' | 'meta' | 'google' | 'seo' }) {
  const stroke = 'currentColor';
  const props = { width: 16, height: 16, viewBox: '0 0 16 16', fill: 'none' as const };
  switch (kind) {
    case 'overview':
      return (
        <svg {...props}>
          <rect x="2" y="2" width="5" height="5" rx="1" stroke={stroke} strokeWidth="1.4" />
          <rect x="9" y="2" width="5" height="5" rx="1" stroke={stroke} strokeWidth="1.4" />
          <rect x="2" y="9" width="5" height="5" rx="1" stroke={stroke} strokeWidth="1.4" />
          <rect x="9" y="9" width="5" height="5" rx="1" stroke={stroke} strokeWidth="1.4" />
        </svg>
      );
    case 'meta':
      return (
        <svg {...props}>
          <circle cx="6" cy="8" r="3.5" stroke={stroke} strokeWidth="1.4" />
          <circle cx="11" cy="8" r="3.5" stroke={stroke} strokeWidth="1.4" />
        </svg>
      );
    case 'google':
      return (
        <svg {...props}>
          <circle cx="7" cy="7" r="4.5" stroke={stroke} strokeWidth="1.4" />
          <path d="M10.5 10.5L14 14" stroke={stroke} strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      );
    case 'seo':
      return (
        <svg {...props}>
          <path d="M2 12L6 7L9 10L14 4" stroke={stroke} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="14" cy="4" r="1.2" fill={stroke} />
        </svg>
      );
    case 'summary':
      return (
        <svg {...props}>
          <path d="M8 2L9.2 5.5L12.8 6L10 8.5L11 12L8 10L5 12L6 8.5L3.2 6L6.8 5.5L8 2Z" stroke={stroke} strokeWidth="1.3" strokeLinejoin="round" />
        </svg>
      );
  }
}
