import React from 'react';

/**
 * Pill tag / chip — services labels and filters. Solid or outline; selectable.
 */
export function Tag({ children, variant = 'outline', active = false, onClick, style = {}, ...rest }) {
  const interactive = typeof onClick === 'function';
  const base = {
    display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
    padding: '0.45rem 0.9rem', borderRadius: 'var(--radius-pill)',
    fontFamily: 'var(--font-sans)', fontSize: '12px', fontWeight: 600,
    letterSpacing: '-0.005em', lineHeight: 1, whiteSpace: 'nowrap',
    cursor: interactive ? 'pointer' : 'default',
    transition: 'all var(--dur-fast) var(--ease-standard)',
    border: '1px solid transparent',
  };
  const skins = {
    outline: active
      ? { background: 'var(--accent-soft)', color: 'var(--accent)', borderColor: 'var(--border-strong)' }
      : { background: 'transparent', color: 'var(--text-secondary)', borderColor: 'var(--border-subtle)' },
    solid: active
      ? { background: 'var(--accent)', color: 'var(--text-on-accent)', borderColor: 'var(--accent)' }
      : { background: 'var(--ink-700)', color: 'var(--text-body)', borderColor: 'transparent' },
  };
  return (
    <span onClick={onClick} style={{ ...base, ...skins[variant], ...style }} {...rest}>
      {children}
    </span>
  );
}
