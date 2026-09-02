import React from 'react';
import { Icon } from './Icon.jsx';

/**
 * KPI / metric tile — oversized accent number, uppercase label, optional delta.
 */
export function StatCard({ value, label, delta = null, deltaTone = 'positive', breakdown = null, variant = 'glass', style = {}, ...rest }) {
  const skins = {
    glass: { background: 'var(--glass-fill)', backdropFilter: 'var(--blur-glass)', WebkitBackdropFilter: 'var(--blur-glass)', border: '1px solid var(--glass-border)', boxShadow: 'var(--shadow-lg)' },
    solid: { background: 'var(--surface-card)', border: '1px solid var(--border-hairline)' },
  };
  const tone = { positive: 'var(--signal-positive)', negative: 'var(--signal-negative)', warning: 'var(--signal-warning)' }[deltaTone];
  return (
    <div style={{ borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)', ...skins[variant], ...style }} {...rest}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: '40px', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1, color: 'var(--accent)' }}>{value}</div>
        {delta != null && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', color: tone, fontSize: '13px', fontWeight: 700 }}>
            <Icon name={deltaTone === 'negative' ? 'arrow-right' : 'arrow-up-right'} size={15} color={tone} />
            {delta}
          </span>
        )}
      </div>
      <div style={{ marginTop: '0.7rem', fontFamily: 'var(--font-sans)', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 'var(--tracking-wide)', color: 'var(--text-muted)' }}>{label}</div>
      {breakdown && <div style={{ marginTop: '0.35rem', fontSize: '11px', color: 'var(--text-muted)' }}>{breakdown}</div>}
    </div>
  );
}
