import React from 'react';

/**
 * Status badge — small pill for states (positive/warning/negative/info/neutral).
 */
export function Badge({ children, tone = 'neutral', dot = false, style = {}, ...rest }) {
  const tones = {
    positive: { bg: 'rgba(34,197,94,0.14)', fg: 'var(--signal-positive)' },
    warning:  { bg: 'rgba(245,214,116,0.14)', fg: 'var(--signal-warning)' },
    negative: { bg: 'rgba(239,68,68,0.14)', fg: 'var(--signal-negative)' },
    info:     { bg: 'rgba(96,165,250,0.14)', fg: 'var(--signal-info)' },
    accent:   { bg: 'var(--accent-soft)', fg: 'var(--accent)' },
    neutral:  { bg: 'rgba(255,255,255,0.07)', fg: 'var(--text-secondary)' },
  };
  const t = tones[tone] || tones.neutral;
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '0.4em',
        padding: '0.2rem 0.55rem', borderRadius: 'var(--radius-pill)',
        background: t.bg, color: t.fg,
        fontFamily: 'var(--font-sans)', fontSize: '11px', fontWeight: 600,
        letterSpacing: '0.02em', lineHeight: 1.4, whiteSpace: 'nowrap',
        ...style,
      }}
      {...rest}
    >
      {dot && <span style={{ width: 6, height: 6, borderRadius: '50%', background: t.fg }} />}
      {children}
    </span>
  );
}
