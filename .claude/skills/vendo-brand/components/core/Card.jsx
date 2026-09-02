import React from 'react';

/**
 * Surface container. `glass` = translucent + blur (product chrome),
 * `solid` = sage panel (marketing). Optional hover lift.
 */
export function Card({ children, variant = 'glass', padding = 'var(--space-5)', hover = false, style = {}, ...rest }) {
  const [h, setH] = React.useState(false);
  const skins = {
    glass: {
      background: 'var(--glass-fill)',
      backdropFilter: 'var(--blur-glass)',
      WebkitBackdropFilter: 'var(--blur-glass)',
      border: '1px solid var(--glass-border)',
      boxShadow: 'var(--shadow-lg)',
    },
    solid: {
      background: 'var(--surface-card)',
      border: '1px solid var(--border-hairline)',
      boxShadow: 'var(--shadow-md)',
    },
    bare: {
      background: 'var(--ink-850)',
      border: '1px solid var(--border-hairline)',
    },
  };
  return (
    <div
      onMouseEnter={() => hover && setH(true)}
      onMouseLeave={() => hover && setH(false)}
      style={{
        borderRadius: 'var(--radius-lg)',
        padding,
        transition: 'border-color var(--dur-base) var(--ease-standard), box-shadow var(--dur-base) var(--ease-standard)',
        ...skins[variant],
        ...(h ? { borderColor: 'var(--border-subtle)', boxShadow: 'var(--shadow-xl)' } : null),
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
