import React from 'react';

/**
 * Avatar — circular image or initials on a sage tile with optional status ring.
 */
export function Avatar({ src = null, name = '', size = 40, ring = false, style = {}, ...rest }) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: size, height: size, borderRadius: 'var(--radius-pill)',
        background: src ? 'transparent' : 'var(--ink-700)',
        color: 'var(--accent)', overflow: 'hidden', flexShrink: 0,
        fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: size * 0.36,
        border: ring ? '2px solid var(--accent)' : '1px solid var(--border-hairline)',
        ...style,
      }}
      {...rest}
    >
      {src ? <img src={src} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}
    </span>
  );
}
