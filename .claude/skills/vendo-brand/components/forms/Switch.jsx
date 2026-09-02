import React from 'react';

/**
 * Toggle switch — mint when on.
 */
export function Switch({ checked = false, onChange, disabled = false, label = null, style = {}, ...rest }) {
  const toggle = () => { if (!disabled && onChange) onChange(!checked); };
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.6rem', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1, ...style }} {...rest}>
      <span
        onClick={toggle}
        style={{
          position: 'relative', width: 40, height: 23, borderRadius: 'var(--radius-pill)',
          background: checked ? 'var(--accent)' : 'var(--ink-700)',
          border: `1px solid ${checked ? 'var(--accent)' : 'var(--border-subtle)'}`,
          transition: 'background var(--dur-base) var(--ease-standard), border-color var(--dur-base) var(--ease-standard)',
          flexShrink: 0,
        }}
      >
        <span style={{
          position: 'absolute', top: 2, left: checked ? 19 : 2,
          width: 17, height: 17, borderRadius: '50%',
          background: checked ? 'var(--vendo-black)' : 'var(--neutral-100)',
          transition: 'left var(--dur-base) var(--ease-emphasis)',
        }} />
      </span>
      {label && <span style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--text-body)' }}>{label}</span>}
    </label>
  );
}
