import React from 'react';

/**
 * Text input on dark. Optional label, leading icon, error state.
 */
export function Input({ label = null, icon = null, error = null, hint = null, id, style = {}, ...rest }) {
  const [focus, setFocus] = React.useState(false);
  const inputId = id || (label ? `in-${label.replace(/\s+/g, '-').toLowerCase()}` : undefined);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', width: '100%' }}>
      {label && (
        <label htmlFor={inputId} style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>{label}</label>
      )}
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          padding: '0 0.85rem', height: 42,
          background: 'var(--ink-850)',
          border: `1px solid ${error ? 'var(--signal-negative)' : focus ? 'var(--accent)' : 'var(--border-subtle)'}`,
          borderRadius: 'var(--radius-sm)',
          boxShadow: focus && !error ? 'var(--focus-ring)' : 'none',
          transition: 'border-color var(--dur-fast) var(--ease-standard), box-shadow var(--dur-fast) var(--ease-standard)',
          ...style,
        }}
      >
        {icon}
        <input
          id={inputId}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          style={{
            flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent',
            color: 'var(--text-body)', fontFamily: 'var(--font-sans)', fontSize: '14px',
          }}
          {...rest}
        />
      </div>
      {(error || hint) && (
        <span style={{ fontSize: '11px', color: error ? 'var(--signal-negative)' : 'var(--text-muted)' }}>{error || hint}</span>
      )}
    </div>
  );
}
