import React from 'react';

/**
 * Vendo primary action. Mint pill on dark, dark ink label.
 * Variants: primary | secondary | ghost | danger. Sizes: sm | md | lg.
 */
export function Button({
  children,
  variant = 'primary',
  size = 'md',
  iconLeft = null,
  iconRight = null,
  disabled = false,
  full = false,
  type = 'button',
  onClick,
  style = {},
  ...rest
}) {
  const pad = {
    sm: '0.45rem 0.85rem',
    md: '0.6rem 1.15rem',
    lg: '0.8rem 1.6rem',
  }[size];
  const fontSize = { sm: '12px', md: '13px', lg: '15px' }[size];

  const base = {
    display: full ? 'flex' : 'inline-flex',
    width: full ? '100%' : 'auto',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    padding: pad,
    fontSize,
    fontFamily: 'var(--font-sans)',
    fontWeight: 700,
    letterSpacing: '-0.01em',
    lineHeight: 1,
    borderRadius: 'var(--radius-pill)',
    border: '1px solid transparent',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.45 : 1,
    transition: 'background var(--dur-fast) var(--ease-standard), border-color var(--dur-fast) var(--ease-standard), color var(--dur-fast) var(--ease-standard), box-shadow var(--dur-fast) var(--ease-standard), transform var(--dur-fast) var(--ease-standard)',
    WebkitTapHighlightColor: 'transparent',
  };

  const variants = {
    primary: {
      background: 'var(--accent)',
      color: 'var(--text-on-accent)',
      borderColor: 'var(--accent)',
    },
    secondary: {
      background: 'transparent',
      color: 'var(--text-heading)',
      borderColor: 'var(--border-subtle)',
    },
    ghost: {
      background: 'transparent',
      color: 'var(--text-secondary)',
      borderColor: 'transparent',
    },
    danger: {
      background: 'rgba(239,68,68,0.12)',
      color: 'var(--signal-negative)',
      borderColor: 'rgba(239,68,68,0.30)',
    },
  };

  const [hover, setHover] = React.useState(false);
  const hoverStyle = !disabled && hover ? {
    primary: { background: 'var(--accent-hover)', borderColor: 'var(--accent-hover)', boxShadow: 'var(--shadow-glow)' },
    secondary: { borderColor: 'var(--accent)', color: 'var(--accent)' },
    ghost: { color: 'var(--accent)', background: 'var(--accent-soft)' },
    danger: { background: 'rgba(239,68,68,0.2)' },
  }[variant] : {};

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ ...base, ...variants[variant], ...hoverStyle, ...style }}
      {...rest}
    >
      {iconLeft}
      {children}
      {iconRight}
    </button>
  );
}
