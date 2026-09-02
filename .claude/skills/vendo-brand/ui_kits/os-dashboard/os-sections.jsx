/* Vendo OS — internal ops dashboard. Sections exported to window for index.html. */
const { StatCard, Badge, Tag, Avatar, Logo, Icon, Button, Input, Card } = window.VendoDigitalDesignSystem_1a7a6e;

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: 'layout-grid' },
  { id: 'pipeline', label: 'Pipeline', icon: 'trending-up' },
  { id: 'clients', label: 'Clients', icon: 'users' },
  { id: 'reports', label: 'Reports', icon: 'file-text' },
  { id: 'ads', label: 'Ad Performance', icon: 'target' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
];

function Sidebar({ view, setView }) {
  return (
    <aside style={{ width: 248, flexShrink: 0, background: 'var(--glass-fill-strong)',
      backdropFilter: 'var(--blur-glass)', WebkitBackdropFilter: 'var(--blur-glass)',
      border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '20px 18px', borderBottom: '1px solid var(--border-hairline)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--accent)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Logo variant="icon" tone="black" size={18} />
        </span>
        <div>
          <div style={{ color: 'var(--text-heading)', fontWeight: 700, fontSize: 14, letterSpacing: '-0.01em' }}>Vendo OS</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>Operations</div>
        </div>
      </div>
      <nav style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
        {NAV.map((n) => {
          const active = view === n.id;
          return (
            <button key={n.id} onClick={() => setView(n.id)} style={{ display: 'flex', alignItems: 'center', gap: 11,
              padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer', textAlign: 'left',
              background: active ? 'var(--accent-soft)' : 'transparent',
              color: active ? 'var(--accent)' : 'var(--text-secondary)',
              fontFamily: 'var(--font-sans)', fontSize: 13.5, fontWeight: active ? 600 : 500,
              transition: 'background var(--dur-fast), color var(--dur-fast)' }}
              onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
              onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}>
              <Icon name={n.icon} size={18} />
              {n.label}
            </button>
          );
        })}
      </nav>
      <div style={{ padding: 12, borderTop: '1px solid var(--border-hairline)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <Avatar name="Max Rivens" size={34} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: 'var(--text-body)', fontSize: 13, fontWeight: 600 }}>Max Rivens</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>Admin</div>
        </div>
        <Icon name="settings" size={16} color="var(--text-muted)" />
      </div>
    </aside>
  );
}

function Topbar({ title }) {
  return (
    <div style={{ height: 60, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 16,
      background: 'var(--glass-fill)', backdropFilter: 'var(--blur-glass)', WebkitBackdropFilter: 'var(--blur-glass)',
      border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)', padding: '0 18px' }}>
      <h1 style={{ margin: 0, color: 'var(--text-heading)', fontSize: 18, fontWeight: 700, letterSpacing: '-0.01em' }}>{title}</h1>
      <div style={{ width: 280, marginLeft: 8 }}>
        <Input icon={<Icon name="search" size={15} color="var(--text-muted)" />} placeholder="Search clients, reports…" />
      </div>
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ position: 'relative', width: 38, height: 38, borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <Icon name="bell" size={17} color="var(--text-secondary)" />
          <span style={{ position: 'absolute', top: 8, right: 9, width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)' }} />
        </span>
        <Button variant="primary" size="sm" iconLeft={<Icon name="plus" size={15} />}>New report</Button>
      </div>
    </div>
  );
}

const SECTION_LABEL = { fontSize: 12, fontWeight: 700, letterSpacing: 'var(--tracking-wide)', textTransform: 'uppercase', color: 'var(--text-muted)', margin: '4px 0 14px' };

function DashboardView() {
  return (
    <div>
      <p style={SECTION_LABEL}>Revenue &amp; margin</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 28 }}>
        <StatCard value="£148.2K" label="Monthly Revenue" delta="+8%" />
        <StatCard value="£1.78M" label="Annual Run Rate" breakdown="Target £2M" />
        <StatCard value="24%" label="Net Margin" breakdown="Target 25%" />
        <StatCard value="+8%" label="vs Last Month" breakdown="£12.3k above plan" />
      </div>
      <p style={SECTION_LABEL}>Pipeline &amp; ad performance</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 28 }}>
        <StatCard value="£92.4K" label="Open Deals" breakdown="14 opportunities" />
        <StatCard value="6" label="Won This Month" breakdown="£41.2k value" />
        <StatCard value="£38.4K" label="Ad Spend 30d" breakdown="Meta £22.3k · Google £16.1k" />
        <StatCard value="£9.32" label="Avg CPL" delta="-6%" deltaTone="positive" />
      </div>
      <p style={SECTION_LABEL}>Spend vs leads — last 12 weeks</p>
      <Card variant="glass" padding="22px">
        <MiniChart />
      </Card>
    </div>
  );
}

function MiniChart() {
  const data = [42, 48, 45, 60, 55, 68, 64, 72, 70, 82, 78, 91];
  const max = Math.max(...data);
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 150 }}>
        {data.map((v, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <div style={{ width: '100%', height: `${(v / max) * 130}px`, borderRadius: 6,
              background: i === data.length - 1 ? 'var(--accent)' : 'linear-gradient(180deg, rgba(142,254,187,0.55), rgba(142,254,187,0.12))' }} />
            <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>W{i + 1}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const CLIENTS = [
  { name: 'Sutton Dental Co', channels: ['Paid Social', 'SEO'], status: ['positive', 'Active'], mrr: '£4,200', report: 'Today' },
  { name: 'Harbourline Kitchens', channels: ['Paid Search'], status: ['warning', 'Generating'], mrr: '£3,650', report: '2d ago' },
  { name: 'Meridian Fitness', channels: ['Paid Social', 'Web'], status: ['positive', 'Active'], mrr: '£5,100', report: 'Yesterday' },
  { name: 'Oakfield Law', channels: ['SEO'], status: ['info', 'Draft ready'], mrr: '£2,400', report: '4d ago' },
  { name: 'Verde Landscaping', channels: ['Paid Search', 'SEO'], status: ['negative', 'Overdue'], mrr: '£1,950', report: '11d ago' },
];

function ClientsView() {
  const [q, setQ] = React.useState('');
  const rows = CLIENTS.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 18, alignItems: 'center' }}>
        <div style={{ width: 280 }}>
          <Input icon={<Icon name="search" size={15} color="var(--text-muted)" />} placeholder="Filter clients…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Badge tone="neutral">{rows.length} clients</Badge>
        <Button variant="secondary" size="sm" style={{ marginLeft: 'auto' }} iconLeft={<Icon name="plus" size={15} />}>Add client</Button>
      </div>
      <Card variant="glass" padding="0" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
              {['Client', 'Channels', 'Status', 'MRR', 'Last report'].map((h) => (
                <th key={h} style={{ textAlign: 'left', padding: '13px 18px', fontSize: 11, fontWeight: 600,
                  textTransform: 'uppercase', letterSpacing: 'var(--tracking-wide)', color: 'var(--text-muted)',
                  borderBottom: '1px solid var(--border-hairline)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.name} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                <td style={{ padding: '13px 18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                    <Avatar name={c.name} size={32} />
                    <span style={{ color: 'var(--text-heading)', fontSize: 14, fontWeight: 600 }}>{c.name}</span>
                  </div>
                </td>
                <td style={{ padding: '13px 18px' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {c.channels.map((ch) => <Tag key={ch} style={{ padding: '0.3rem 0.65rem', fontSize: 11 }}>{ch}</Tag>)}
                  </div>
                </td>
                <td style={{ padding: '13px 18px' }}><Badge tone={c.status[0]} dot>{c.status[1]}</Badge></td>
                <td style={{ padding: '13px 18px', color: 'var(--text-body)', fontSize: 14, fontWeight: 600 }}>{c.mrr}</td>
                <td style={{ padding: '13px 18px', color: 'var(--text-muted)', fontSize: 13 }}>{c.report}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function PlaceholderView({ title }) {
  return (
    <Card variant="glass" padding="48px" style={{ textAlign: 'center' }}>
      <div style={{ width: 48, height: 48, borderRadius: 'var(--radius-md)', background: 'var(--accent-soft)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
        <Icon name="layout-grid" size={22} color="var(--accent)" />
      </div>
      <h3 style={{ margin: 0, color: 'var(--text-heading)', fontSize: 18, fontWeight: 700 }}>{title}</h3>
      <p style={{ margin: '8px 0 0', color: 'var(--text-muted)', fontSize: 14 }}>This surface is part of the live Vendo OS product.</p>
    </Card>
  );
}

Object.assign(window, { OsSidebar: Sidebar, OsTopbar: Topbar, OsDashboard: DashboardView, OsClients: ClientsView, OsPlaceholder: PlaceholderView });
