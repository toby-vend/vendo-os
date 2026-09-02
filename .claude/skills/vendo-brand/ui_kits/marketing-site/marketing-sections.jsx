/* Vendo Digital — marketing site sections. Exported to window for index.html. */
const { Button, Tag, Badge, StatCard, Avatar, Logo, Icon, Card } = window.VendoDigitalDesignSystem_1a7a6e;

const NAV_LINKS = ['Services', 'Work', 'About', 'Insights'];
const SERVICES = ['Paid Search', 'Paid Social', 'SEO', 'Web Design', 'Growth Strategy'];

function Nav({ onContact }) {
  return (
    <header style={{ position: 'sticky', top: 0, zIndex: 20, backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)',
      background: 'rgba(5,20,18,0.72)', borderBottom: '1px solid var(--border-hairline)' }}>
      <div style={{ maxWidth: 'var(--container-max)', margin: '0 auto', padding: '0 32px', height: 72,
        display: 'flex', alignItems: 'center', gap: 32 }}>
        <Logo tone="white" size={26} />
        <nav style={{ display: 'flex', gap: 28, marginLeft: 18 }}>
          {NAV_LINKS.map((l) => (
            <a key={l} href="#" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: 14, fontWeight: 500 }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}>{l}</a>
          ))}
        </nav>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 12, alignItems: 'center' }}>
          <Button variant="ghost" size="sm">Client login</Button>
          <Button variant="primary" size="sm" onClick={onContact} iconRight={<Icon name="arrow-right" size={15} />}>Book a call</Button>
        </div>
      </div>
    </header>
  );
}

function PhotoSlot({ label, h = '100%', tint = 'var(--ink-700)' }) {
  return (
    <div style={{ background: tint, borderRadius: 'var(--radius-md)', height: h, position: 'relative', overflow: 'hidden',
      border: '1px solid var(--border-hairline)', display: 'flex', alignItems: 'flex-end', padding: 12 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 20%, rgba(142,254,187,0.10), transparent 60%)' }} />
      <span style={{ position: 'relative', fontSize: 10, letterSpacing: 'var(--tracking-wide)', textTransform: 'uppercase',
        color: 'var(--text-muted)' }}>{label}</span>
    </div>
  );
}

function Hero({ onContact }) {
  const [flourish, setFlourish] = React.useState(0);
  const words = ['growth.', 'ecommerce.', 'dental.', 'local.'];
  React.useEffect(() => {
    const id = setInterval(() => setFlourish((f) => (f + 1) % words.length), 2600);
    return () => clearInterval(id);
  }, []);
  return (
    <section style={{ maxWidth: 'var(--container-max)', margin: '0 auto', padding: '72px 32px 40px',
      display: 'grid', gridTemplateColumns: '1.15fr 0.85fr', gap: 48, alignItems: 'center' }}>
      <div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 'var(--radius-pill)',
          background: 'var(--accent-soft)', border: '1px solid var(--border-strong)', marginBottom: 26 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)' }} />
          <span style={{ color: 'var(--accent)', fontSize: 12, fontWeight: 600, letterSpacing: '0.01em' }}>Data-driven growth partner</span>
        </div>
        <h1 style={{ margin: 0, color: 'var(--text-heading)', fontWeight: 800, fontSize: 64, lineHeight: 1.02, letterSpacing: '-0.035em' }}>
          We Are Vendo{' '}
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 400, fontStyle: 'italic', color: 'var(--accent)', letterSpacing: 0 }}>
            {words[flourish]}
          </span>
        </h1>
        <p style={{ marginTop: 22, color: 'var(--text-secondary)', fontSize: 18, lineHeight: 1.6, maxWidth: 480 }}>
          We build businesses through strategic advertising, beautiful high-converting websites,
          and hands-on partnership. Less guesswork, more growth.
        </p>
        <div style={{ display: 'flex', gap: 14, marginTop: 30 }}>
          <Button variant="primary" size="lg" onClick={onContact}>Start a project</Button>
          <Button variant="secondary" size="lg" iconRight={<Icon name="arrow-up-right" size={17} />}>See our work</Button>
        </div>
        <div style={{ display: 'flex', gap: 36, marginTop: 46 }}>
          <StatHeadline value="200%" label="Avg. traffic increase" />
          <span style={{ width: 1, background: 'var(--border-subtle)' }} />
          <StatHeadline value="200+" label="New customers driven" />
          <span style={{ width: 1, background: 'var(--border-subtle)' }} />
          <StatHeadline value="4.7×" label="Blended ROAS" />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '160px 120px', gap: 12, height: 292 }}>
        <PhotoSlot label="Campaign" tint="var(--ink-700)" />
        <PhotoSlot label="Studio" tint="#0E2C28" />
        <PhotoSlot label="Client" tint="#0E2C28" />
        <PhotoSlot label="Results" tint="var(--ink-700)" />
      </div>
    </section>
  );
}

function StatHeadline({ value, label }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <Icon name="arrow-up-right" size={20} color="var(--accent)" />
        <span style={{ color: 'var(--text-heading)', fontSize: 34, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1 }}>{value}</span>
      </div>
      <div style={{ marginTop: 8, color: 'var(--text-muted)', fontSize: 11, letterSpacing: 'var(--tracking-wide)', textTransform: 'uppercase' }}>{label}</div>
    </div>
  );
}

function Services({ active, setActive }) {
  return (
    <section style={{ maxWidth: 'var(--container-max)', margin: '0 auto', padding: '40px 32px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 22 }}>
        <div>
          <div style={{ color: 'var(--accent)', fontSize: 12, fontWeight: 700, letterSpacing: 'var(--tracking-wide)', textTransform: 'uppercase' }}>What we do</div>
          <h2 style={{ margin: '10px 0 0', color: 'var(--text-heading)', fontSize: 32, fontWeight: 700, letterSpacing: '-0.02em' }}>Full-funnel, in one team</h2>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 22 }}>
        {SERVICES.map((s) => (
          <Tag key={s} active={active === s} onClick={() => setActive(s)}>{s}</Tag>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {[
          { icon: 'megaphone', t: 'Paid media that pays back', d: 'Search and social campaigns engineered around CPL, ROAS and incremental revenue — not vanity clicks.' },
          { icon: 'globe', t: 'Sites that convert', d: 'Fast, beautiful builds with conversion baked in. Designed to turn traffic into booked revenue.' },
          { icon: 'trending-up', t: 'SEO that compounds', d: 'Technical foundations, content and local SEO that grow a durable, lower-cost channel over time.' },
        ].map((c) => (
          <Card key={c.t} variant="solid" hover padding="22px">
            <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-sm)', background: 'var(--accent-soft)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <Icon name={c.icon} size={20} color="var(--accent)" />
            </div>
            <h3 style={{ margin: 0, color: 'var(--text-heading)', fontSize: 18, fontWeight: 700, letterSpacing: '-0.01em' }}>{c.t}</h3>
            <p style={{ margin: '10px 0 0', color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6 }}>{c.d}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}

const TEAM = [
  { name: 'Max Rivens', role: 'Managing Director' },
  { name: 'Alfie Wakelin', role: 'Head of Web, SEO & PPC' },
  { name: 'Toby Raeburn', role: 'Head of Paid Social' },
];

function Team() {
  return (
    <section style={{ maxWidth: 'var(--container-max)', margin: '0 auto', padding: '40px 32px' }}>
      <div style={{ color: 'var(--accent)', fontSize: 12, fontWeight: 700, letterSpacing: 'var(--tracking-wide)', textTransform: 'uppercase' }}>The team</div>
      <h2 style={{ margin: '10px 0 26px', color: 'var(--text-heading)', fontSize: 32, fontWeight: 700, letterSpacing: '-0.02em' }}>
        Senior people, <span style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 400, color: 'var(--accent)' }}>on your account</span>
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {TEAM.map((m) => (
          <Card key={m.name} variant="solid" padding="0" style={{ overflow: 'hidden' }}>
            <div style={{ height: 180, background: 'linear-gradient(160deg, #0E2C28, #09221F)', position: 'relative',
              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 30%, rgba(142,254,187,0.12), transparent 60%)' }} />
              <Avatar name={m.name} size={64} />
            </div>
            <div style={{ padding: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ color: 'var(--text-heading)', fontSize: 16, fontWeight: 700 }}>{m.name}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 3 }}>{m.role}</div>
              </div>
              <div style={{ width: 34, height: 34, borderRadius: '50%', border: '1px solid var(--border-subtle)',
                display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="arrow-up-right" size={16} color="var(--text-secondary)" />
              </div>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}

function Cta({ onContact }) {
  return (
    <section style={{ maxWidth: 'var(--container-max)', margin: '40px auto 0', padding: '0 32px 64px' }}>
      <div style={{ borderRadius: 'var(--radius-xl)', padding: '56px 48px', position: 'relative', overflow: 'hidden',
        background: 'linear-gradient(135deg, #0A1F1B, #051412)', border: '1px solid var(--border-subtle)' }}>
        <div style={{ position: 'absolute', top: -80, right: -40, width: 360, height: 360, borderRadius: '50%',
          background: 'var(--accent)', opacity: 0.10, filter: 'blur(80px)' }} />
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 32, flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ margin: 0, color: 'var(--text-heading)', fontSize: 38, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.1 }}>
              Ready to grow?
            </h2>
            <p style={{ margin: '12px 0 0', color: 'var(--text-secondary)', fontSize: 16, maxWidth: 420 }}>
              Book a free strategy call. We'll map the fastest path to revenue for your business.
            </p>
          </div>
          <Button variant="primary" size="lg" onClick={onContact} iconRight={<Icon name="arrow-right" size={18} />}>Book a call</Button>
        </div>
      </div>
      <footer style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '32px 4px 0', flexWrap: 'wrap', gap: 16 }}>
        <Logo tone="white" size={22} />
        <div style={{ display: 'flex', gap: 18, color: 'var(--text-muted)', fontSize: 13 }}>
          <span>hello@vendodigital.co.uk</span>
          <span>·</span>
          <span>www.vendodigital.co.uk</span>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          {['phone', 'mail', 'map-pin'].map((i) => (
            <span key={i} style={{ width: 34, height: 34, borderRadius: '50%', border: '1px solid var(--border-subtle)',
              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={i} size={16} color="var(--text-secondary)" />
            </span>
          ))}
        </div>
      </footer>
    </section>
  );
}

Object.assign(window, { VNav: Nav, VHero: Hero, VServices: Services, VTeam: Team, VCta: Cta });
