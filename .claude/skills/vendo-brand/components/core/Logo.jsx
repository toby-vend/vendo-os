import React from 'react';

/**
 * Vendo wordmark / icon mark rendered in Manrope. The dot is part of the mark.
 * For print/exact-vector use the SVGs in assets/logo/.
 */
export function Logo({ variant = 'wordmark', tone = 'white', size = 28, style = {}, ...rest }) {
  const colors = {
    white: 'var(--white)',
    green: 'var(--vendo-green)',
    black: 'var(--vendo-black)',
  };
  const c = colors[tone] || colors.white;
  const common = {
    display: 'inline-flex', alignItems: 'baseline',
    fontFamily: 'var(--font-sans)', fontWeight: 800,
    letterSpacing: '-0.04em', lineHeight: 1, color: c,
    userSelect: 'none',
  };
  if (variant === 'icon') {
    return (
      <span style={{ ...common, fontSize: size, ...style }} {...rest}>
        V<span style={{ color: tone === 'green' ? 'var(--vendo-green)' : c }}>.</span>
      </span>
    );
  }
  return (
    <span style={{ ...common, fontSize: size, ...style }} {...rest}>
      Vendo<span style={{ color: tone === 'white' ? 'var(--vendo-green)' : c }}>.</span>
    </span>
  );
}
