/* @ds-bundle: {"format":4,"namespace":"VendoDigitalDesignSystem_1a7a6e","components":[{"name":"Avatar","sourcePath":"components/core/Avatar.jsx"},{"name":"Badge","sourcePath":"components/core/Badge.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Card","sourcePath":"components/core/Card.jsx"},{"name":"Icon","sourcePath":"components/core/Icon.jsx"},{"name":"Logo","sourcePath":"components/core/Logo.jsx"},{"name":"StatCard","sourcePath":"components/core/StatCard.jsx"},{"name":"Tag","sourcePath":"components/core/Tag.jsx"},{"name":"Input","sourcePath":"components/forms/Input.jsx"},{"name":"Switch","sourcePath":"components/forms/Switch.jsx"}],"sourceHashes":{"components/core/Avatar.jsx":"85b6774af5a0","components/core/Badge.jsx":"01c79e19208a","components/core/Button.jsx":"2cc0cb468332","components/core/Card.jsx":"ac8ebc229dc7","components/core/Icon.jsx":"5f7061173710","components/core/Logo.jsx":"f3ac05517405","components/core/StatCard.jsx":"5d8d5979eb36","components/core/Tag.jsx":"45137215f678","components/forms/Input.jsx":"821b331e8e6a","components/forms/Switch.jsx":"95db9c998784","landing-pages/vendo-dental-forecast/app.js":"1cf471102db3","landing-pages/vendo-dental-gap/app.js":"835ff8d0281c","ui_kits/marketing-site/marketing-sections.jsx":"5aa6d7e60025","ui_kits/os-dashboard/os-sections.jsx":"5463f46b5698","website/vendo-dental/chrome.js":"9fbccb22f34c"},"inlinedExternals":[],"unexposedExports":[{"name":"iconNames","sourcePath":"components/core/Icon.jsx"}]} */

(() => {

const __ds_ns = (window.VendoDigitalDesignSystem_1a7a6e = window.VendoDigitalDesignSystem_1a7a6e || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/core/Avatar.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Avatar — circular image or initials on a sage tile with optional status ring.
 */
function Avatar({
  src = null,
  name = '',
  size = 40,
  ring = false,
  style = {},
  ...rest
}) {
  const initials = name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: size,
      height: size,
      borderRadius: 'var(--radius-pill)',
      background: src ? 'transparent' : 'var(--ink-700)',
      color: 'var(--accent)',
      overflow: 'hidden',
      flexShrink: 0,
      fontFamily: 'var(--font-sans)',
      fontWeight: 700,
      fontSize: size * 0.36,
      border: ring ? '2px solid var(--accent)' : '1px solid var(--border-hairline)',
      ...style
    }
  }, rest), src ? /*#__PURE__*/React.createElement("img", {
    src: src,
    alt: name,
    style: {
      width: '100%',
      height: '100%',
      objectFit: 'cover'
    }
  }) : initials);
}
Object.assign(__ds_scope, { Avatar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Avatar.jsx", error: String((e && e.message) || e) }); }

// components/core/Badge.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Status badge — small pill for states (positive/warning/negative/info/neutral).
 */
function Badge({
  children,
  tone = 'neutral',
  dot = false,
  style = {},
  ...rest
}) {
  const tones = {
    positive: {
      bg: 'rgba(34,197,94,0.14)',
      fg: 'var(--signal-positive)'
    },
    warning: {
      bg: 'rgba(245,214,116,0.14)',
      fg: 'var(--signal-warning)'
    },
    negative: {
      bg: 'rgba(239,68,68,0.14)',
      fg: 'var(--signal-negative)'
    },
    info: {
      bg: 'rgba(96,165,250,0.14)',
      fg: 'var(--signal-info)'
    },
    accent: {
      bg: 'var(--accent-soft)',
      fg: 'var(--accent)'
    },
    neutral: {
      bg: 'rgba(255,255,255,0.07)',
      fg: 'var(--text-secondary)'
    }
  };
  const t = tones[tone] || tones.neutral;
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.4em',
      padding: '0.2rem 0.55rem',
      borderRadius: 'var(--radius-pill)',
      background: t.bg,
      color: t.fg,
      fontFamily: 'var(--font-sans)',
      fontSize: '11px',
      fontWeight: 600,
      letterSpacing: '0.02em',
      lineHeight: 1.4,
      whiteSpace: 'nowrap',
      ...style
    }
  }, rest), dot && /*#__PURE__*/React.createElement("span", {
    style: {
      width: 6,
      height: 6,
      borderRadius: '50%',
      background: t.fg
    }
  }), children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Badge.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Vendo primary action. Mint pill on dark, dark ink label.
 * Variants: primary | secondary | ghost | danger. Sizes: sm | md | lg.
 */
function Button({
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
    lg: '0.8rem 1.6rem'
  }[size];
  const fontSize = {
    sm: '12px',
    md: '13px',
    lg: '15px'
  }[size];
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
    WebkitTapHighlightColor: 'transparent'
  };
  const variants = {
    primary: {
      background: 'var(--accent)',
      color: 'var(--text-on-accent)',
      borderColor: 'var(--accent)'
    },
    secondary: {
      background: 'transparent',
      color: 'var(--text-heading)',
      borderColor: 'var(--border-subtle)'
    },
    ghost: {
      background: 'transparent',
      color: 'var(--text-secondary)',
      borderColor: 'transparent'
    },
    danger: {
      background: 'rgba(239,68,68,0.12)',
      color: 'var(--signal-negative)',
      borderColor: 'rgba(239,68,68,0.30)'
    }
  };
  const [hover, setHover] = React.useState(false);
  const hoverStyle = !disabled && hover ? {
    primary: {
      background: 'var(--accent-hover)',
      borderColor: 'var(--accent-hover)',
      boxShadow: 'var(--shadow-glow)'
    },
    secondary: {
      borderColor: 'var(--accent)',
      color: 'var(--accent)'
    },
    ghost: {
      color: 'var(--accent)',
      background: 'var(--accent-soft)'
    },
    danger: {
      background: 'rgba(239,68,68,0.2)'
    }
  }[variant] : {};
  return /*#__PURE__*/React.createElement("button", _extends({
    type: type,
    disabled: disabled,
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      ...base,
      ...variants[variant],
      ...hoverStyle,
      ...style
    }
  }, rest), iconLeft, children, iconRight);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/Card.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Surface container. `glass` = translucent + blur (product chrome),
 * `solid` = sage panel (marketing). Optional hover lift.
 */
function Card({
  children,
  variant = 'glass',
  padding = 'var(--space-5)',
  hover = false,
  style = {},
  ...rest
}) {
  const [h, setH] = React.useState(false);
  const skins = {
    glass: {
      background: 'var(--glass-fill)',
      backdropFilter: 'var(--blur-glass)',
      WebkitBackdropFilter: 'var(--blur-glass)',
      border: '1px solid var(--glass-border)',
      boxShadow: 'var(--shadow-lg)'
    },
    solid: {
      background: 'var(--surface-card)',
      border: '1px solid var(--border-hairline)',
      boxShadow: 'var(--shadow-md)'
    },
    bare: {
      background: 'var(--ink-850)',
      border: '1px solid var(--border-hairline)'
    }
  };
  return /*#__PURE__*/React.createElement("div", _extends({
    onMouseEnter: () => hover && setH(true),
    onMouseLeave: () => hover && setH(false),
    style: {
      borderRadius: 'var(--radius-lg)',
      padding,
      transition: 'border-color var(--dur-base) var(--ease-standard), box-shadow var(--dur-base) var(--ease-standard)',
      ...skins[variant],
      ...(h ? {
        borderColor: 'var(--border-subtle)',
        boxShadow: 'var(--shadow-xl)'
      } : null),
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Card.jsx", error: String((e && e.message) || e) }); }

// components/core/Icon.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Vendo line icons — light, rounded-stroke glyphs (Lucide-derived) on a 24×24
 * grid. stroke = currentColor, so colour them with `color`.
 */

// Inner SVG markup per icon (Lucide path data — 24×24, 2px round strokes).
const PATHS = {
  phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 5L2 7"/>',
  'map-pin': '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  cursor: '<path d="m4 4 7.07 17 2.51-7.39L21 11.07z"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  'arrow-right': '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  'arrow-up-right': '<path d="M7 17 17 7"/><path d="M7 7h10v10"/>',
  'chevron-right': '<path d="m9 18 6-6-6-6"/>',
  'chevron-down': '<path d="m6 9 6 6 6-6"/>',
  menu: '<path d="M4 12h16"/><path d="M4 6h16"/><path d="M4 18h16"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  settings: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
  user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  'trending-up': '<path d="M22 7 13.5 15.5 8.5 10.5 2 17"/><path d="M16 7h6v6"/>',
  'bar-chart': '<line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/>',
  target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/><path d="M2 12h20"/>',
  megaphone: '<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
  'layout-grid': '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>',
  'file-text': '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/><path d="M14 2v5h5"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  star: '<path d="M12 2 15.09 8.26 22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14l-5-4.87 6.91-1.01z"/>',
  external: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>'
};
function Icon({
  name,
  size = 20,
  strokeWidth = 1.8,
  color = 'currentColor',
  style = {},
  ...rest
}) {
  const inner = PATHS[name] || '';
  return /*#__PURE__*/React.createElement("svg", _extends({
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: color,
    strokeWidth: strokeWidth,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    style: {
      display: 'inline-block',
      flexShrink: 0,
      ...style
    },
    "aria-hidden": "true",
    dangerouslySetInnerHTML: {
      __html: inner
    }
  }, rest));
}

/** Names available in this build. */
const iconNames = Object.keys(PATHS);
Object.assign(__ds_scope, { Icon, iconNames });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Icon.jsx", error: String((e && e.message) || e) }); }

// components/core/Logo.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Vendo wordmark / icon mark rendered in Manrope. The dot is part of the mark.
 * For print/exact-vector use the SVGs in assets/logo/.
 */
function Logo({
  variant = 'wordmark',
  tone = 'white',
  size = 28,
  style = {},
  ...rest
}) {
  const colors = {
    white: 'var(--white)',
    green: 'var(--vendo-green)',
    black: 'var(--vendo-black)'
  };
  const c = colors[tone] || colors.white;
  const common = {
    display: 'inline-flex',
    alignItems: 'baseline',
    fontFamily: 'var(--font-sans)',
    fontWeight: 800,
    letterSpacing: '-0.04em',
    lineHeight: 1,
    color: c,
    userSelect: 'none'
  };
  if (variant === 'icon') {
    return /*#__PURE__*/React.createElement("span", _extends({
      style: {
        ...common,
        fontSize: size,
        ...style
      }
    }, rest), "V", /*#__PURE__*/React.createElement("span", {
      style: {
        color: tone === 'green' ? 'var(--vendo-green)' : c
      }
    }, "."));
  }
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      ...common,
      fontSize: size,
      ...style
    }
  }, rest), "Vendo", /*#__PURE__*/React.createElement("span", {
    style: {
      color: tone === 'white' ? 'var(--vendo-green)' : c
    }
  }, "."));
}
Object.assign(__ds_scope, { Logo });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Logo.jsx", error: String((e && e.message) || e) }); }

// components/core/StatCard.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * KPI / metric tile — oversized accent number, uppercase label, optional delta.
 */
function StatCard({
  value,
  label,
  delta = null,
  deltaTone = 'positive',
  breakdown = null,
  variant = 'glass',
  style = {},
  ...rest
}) {
  const skins = {
    glass: {
      background: 'var(--glass-fill)',
      backdropFilter: 'var(--blur-glass)',
      WebkitBackdropFilter: 'var(--blur-glass)',
      border: '1px solid var(--glass-border)',
      boxShadow: 'var(--shadow-lg)'
    },
    solid: {
      background: 'var(--surface-card)',
      border: '1px solid var(--border-hairline)'
    }
  };
  const tone = {
    positive: 'var(--signal-positive)',
    negative: 'var(--signal-negative)',
    warning: 'var(--signal-warning)'
  }[deltaTone];
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      borderRadius: 'var(--radius-lg)',
      padding: 'var(--space-5)',
      ...skins[variant],
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: '0.5rem'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-sans)',
      fontSize: '40px',
      fontWeight: 800,
      letterSpacing: '-0.03em',
      lineHeight: 1,
      color: 'var(--accent)'
    }
  }, value), delta != null && /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.2rem',
      color: tone,
      fontSize: '13px',
      fontWeight: 700
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: deltaTone === 'negative' ? 'arrow-right' : 'arrow-up-right',
    size: 15,
    color: tone
  }), delta)), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: '0.7rem',
      fontFamily: 'var(--font-sans)',
      fontSize: '11px',
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: 'var(--tracking-wide)',
      color: 'var(--text-muted)'
    }
  }, label), breakdown && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: '0.35rem',
      fontSize: '11px',
      color: 'var(--text-muted)'
    }
  }, breakdown));
}
Object.assign(__ds_scope, { StatCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/StatCard.jsx", error: String((e && e.message) || e) }); }

// components/core/Tag.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Pill tag / chip — services labels and filters. Solid or outline; selectable.
 */
function Tag({
  children,
  variant = 'outline',
  active = false,
  onClick,
  style = {},
  ...rest
}) {
  const interactive = typeof onClick === 'function';
  const base = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.4rem',
    padding: '0.45rem 0.9rem',
    borderRadius: 'var(--radius-pill)',
    fontFamily: 'var(--font-sans)',
    fontSize: '12px',
    fontWeight: 600,
    letterSpacing: '-0.005em',
    lineHeight: 1,
    whiteSpace: 'nowrap',
    cursor: interactive ? 'pointer' : 'default',
    transition: 'all var(--dur-fast) var(--ease-standard)',
    border: '1px solid transparent'
  };
  const skins = {
    outline: active ? {
      background: 'var(--accent-soft)',
      color: 'var(--accent)',
      borderColor: 'var(--border-strong)'
    } : {
      background: 'transparent',
      color: 'var(--text-secondary)',
      borderColor: 'var(--border-subtle)'
    },
    solid: active ? {
      background: 'var(--accent)',
      color: 'var(--text-on-accent)',
      borderColor: 'var(--accent)'
    } : {
      background: 'var(--ink-700)',
      color: 'var(--text-body)',
      borderColor: 'transparent'
    }
  };
  return /*#__PURE__*/React.createElement("span", _extends({
    onClick: onClick,
    style: {
      ...base,
      ...skins[variant],
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Tag });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Tag.jsx", error: String((e && e.message) || e) }); }

// components/forms/Input.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Text input on dark. Optional label, leading icon, error state.
 */
function Input({
  label = null,
  icon = null,
  error = null,
  hint = null,
  id,
  style = {},
  ...rest
}) {
  const [focus, setFocus] = React.useState(false);
  const inputId = id || (label ? `in-${label.replace(/\s+/g, '-').toLowerCase()}` : undefined);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: '0.4rem',
      width: '100%'
    }
  }, label && /*#__PURE__*/React.createElement("label", {
    htmlFor: inputId,
    style: {
      fontFamily: 'var(--font-sans)',
      fontSize: '12px',
      fontWeight: 600,
      color: 'var(--text-secondary)'
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      padding: '0 0.85rem',
      height: 42,
      background: 'var(--ink-850)',
      border: `1px solid ${error ? 'var(--signal-negative)' : focus ? 'var(--accent)' : 'var(--border-subtle)'}`,
      borderRadius: 'var(--radius-sm)',
      boxShadow: focus && !error ? 'var(--focus-ring)' : 'none',
      transition: 'border-color var(--dur-fast) var(--ease-standard), box-shadow var(--dur-fast) var(--ease-standard)',
      ...style
    }
  }, icon, /*#__PURE__*/React.createElement("input", _extends({
    id: inputId,
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    style: {
      flex: 1,
      minWidth: 0,
      border: 'none',
      outline: 'none',
      background: 'transparent',
      color: 'var(--text-body)',
      fontFamily: 'var(--font-sans)',
      fontSize: '14px'
    }
  }, rest))), (error || hint) && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: '11px',
      color: error ? 'var(--signal-negative)' : 'var(--text-muted)'
    }
  }, error || hint));
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Input.jsx", error: String((e && e.message) || e) }); }

// components/forms/Switch.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Toggle switch — mint when on.
 */
function Switch({
  checked = false,
  onChange,
  disabled = false,
  label = null,
  style = {},
  ...rest
}) {
  const toggle = () => {
    if (!disabled && onChange) onChange(!checked);
  };
  return /*#__PURE__*/React.createElement("label", _extends({
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.6rem',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1,
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("span", {
    onClick: toggle,
    style: {
      position: 'relative',
      width: 40,
      height: 23,
      borderRadius: 'var(--radius-pill)',
      background: checked ? 'var(--accent)' : 'var(--ink-700)',
      border: `1px solid ${checked ? 'var(--accent)' : 'var(--border-subtle)'}`,
      transition: 'background var(--dur-base) var(--ease-standard), border-color var(--dur-base) var(--ease-standard)',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      top: 2,
      left: checked ? 19 : 2,
      width: 17,
      height: 17,
      borderRadius: '50%',
      background: checked ? 'var(--vendo-black)' : 'var(--neutral-100)',
      transition: 'left var(--dur-base) var(--ease-emphasis)'
    }
  })), label && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-sans)',
      fontSize: '13px',
      color: 'var(--text-body)'
    }
  }, label));
}
Object.assign(__ds_scope, { Switch });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Switch.jsx", error: String((e && e.message) || e) }); }

// landing-pages/vendo-dental-forecast/app.js
try { (() => {
/* Vendo Dental "Forecast" LP (v2) — interactions + Tweaks host protocol. */
(function () {
  'use strict';

  /* ---------- Hero variant copy (predictability angle) ---------- */
  var HERO = {
    A: {
      head: 'A full diary of the treatments you actually want. <span class="flo">Every month.</span>',
      sub: 'We build single practices and groups a predictable flow of high-value new patients, so you can stop guessing, start planning, and grow your practice on your terms.'
    },
    B: {
      head: 'Build a practice that grows <span class="flo">without you living in the chair.</span>',
      sub: 'A predictable flow of high-value patients that keeps running whether you are treating, on holiday, or planning your next site. Stop being the marketing department.'
    },
    C: {
      head: 'Turn patient flow into a tap you control, <span class="flo">not a tide you chase.</span>',
      sub: 'We engineer a steady, forecastable stream of the treatments with real margin, so your diary fills on a plan instead of feast-or-famine luck.'
    }
  };

  /* lead-promise emphasis swaps the subhead lead clause */
  var LEAD = {
    treatments: {
      A: 'We build single practices and groups a predictable flow of high-value new patients, so you can stop guessing, start planning, and grow your practice on your terms.'
    },
    predictable: {
      A: 'We give single practices and groups a flow of new patients you can actually forecast, weighted to the high-value treatments that pay, so you can plan, hire and grow with confidence.'
    }
  };
  var CTA = {
    strategy: 'Book a free strategy call',
    forecast: 'Book a free Patient Flow Forecast call'
  };

  /* ---------- State ---------- */
  var state = Object.assign({}, window.TWEAK_DEFAULTS || {
    heroVariant: 'A',
    leadPromise: 'treatments',
    ctaLabel: 'strategy'
  });
  var headEl = document.querySelector('[data-hero-headline]');
  var subEl = document.querySelector('[data-hero-subhead]');
  function applyHero() {
    var v = HERO[state.heroVariant] || HERO.A;
    if (headEl) headEl.innerHTML = v.head;
    if (subEl) {
      // lead-promise override only customises variant A's subhead; B/C keep their own
      var override = state.heroVariant === 'A' && LEAD[state.leadPromise] && LEAD[state.leadPromise].A;
      subEl.textContent = override ? LEAD[state.leadPromise].A : v.sub;
    }
  }
  function applyCta() {
    var label = CTA[state.ctaLabel] || CTA.strategy;
    document.querySelectorAll('[data-cta]').forEach(function (a) {
      var svg = a.querySelector('svg');
      a.childNodes.forEach(function (n) {
        if (n.nodeType === 3) n.textContent = '';
      });
      a.insertBefore(document.createTextNode(label + (svg ? ' ' : '')), a.firstChild);
    });
  }
  function applyAll() {
    applyHero();
    applyCta();
    syncPanel();
  }

  /* ---------- FAQ: single-open accordion ---------- */
  document.querySelectorAll('.faq details').forEach(function (d) {
    d.addEventListener('toggle', function () {
      if (d.open) document.querySelectorAll('.faq details').forEach(function (o) {
        if (o !== d) o.open = false;
      });
    });
  });

  /* ---------- Reveal on scroll ---------- */
  if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      });
    }, {
      threshold: 0.12,
      rootMargin: '0px 0px -8% 0px'
    });
    document.querySelectorAll('.reveal').forEach(function (el) {
      io.observe(el);
    });
  } else {
    document.querySelectorAll('.reveal').forEach(function (el) {
      el.classList.add('in');
    });
  }

  /* ---------- Tweaks panel ---------- */
  var panel = document.getElementById('tweaks');
  function syncPanel() {
    panel.querySelectorAll('.seg').forEach(function (seg) {
      var key = seg.getAttribute('data-tw');
      seg.querySelectorAll('button').forEach(function (b) {
        b.classList.toggle('on', b.getAttribute('data-val') === state[key]);
      });
    });
  }
  panel.querySelectorAll('.seg').forEach(function (seg) {
    var key = seg.getAttribute('data-tw');
    seg.addEventListener('click', function (e) {
      var btn = e.target.closest('button');
      if (!btn) return;
      state[key] = btn.getAttribute('data-val');
      applyAll();
      try {
        window.parent.postMessage({
          type: '__edit_mode_set_keys',
          edits: makeEdits()
        }, '*');
      } catch (err) {}
    });
  });
  function makeEdits() {
    return {
      heroVariant: state.heroVariant,
      leadPromise: state.leadPromise,
      ctaLabel: state.ctaLabel
    };
  }
  document.getElementById('tw-close').addEventListener('click', function () {
    panel.classList.remove('open');
    try {
      window.parent.postMessage({
        type: '__edit_mode_dismissed'
      }, '*');
    } catch (err) {}
  });
  window.addEventListener('message', function (e) {
    var t = e.data && e.data.type;
    if (t === '__activate_edit_mode') {
      panel.classList.add('open');
      syncPanel();
    } else if (t === '__deactivate_edit_mode') {
      panel.classList.remove('open');
    }
  });
  try {
    window.parent.postMessage({
      type: '__edit_mode_available'
    }, '*');
  } catch (err) {}

  /* ---------- Init ---------- */
  applyAll();
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "landing-pages/vendo-dental-forecast/app.js", error: String((e && e.message) || e) }); }

// landing-pages/vendo-dental-gap/app.js
try { (() => {
/* Vendo Dental "Gap" LP — interactions + Tweaks host protocol. */
(function () {
  'use strict';

  /* ---------- Hero variant copy ---------- */
  var HERO = {
    A: {
      head: 'Two practices. Same town. Same budget. One is worth <span class="flo">twice as much.</span>',
      sub: 'The difference is not how much they spend. It is the gap between what a patient costs to acquire and what they are worth over their lifetime. We help you widen it.'
    },
    B: {
      head: 'You are not short of leads. You are <span class="flo">leaking patients.</span>',
      sub: 'New patient numbers look fine, but they leave faster than you can replace them. We find the holes in the bucket and plug them, so every pound you spend goes further.'
    },
    C: {
      head: 'More profit from the same ad spend. We show you <span class="flo">where every pound goes.</span>',
      sub: 'No vanity metrics, no guesswork. We map your real cost per patient, widen the gap between what they cost and what they are worth, and report on the numbers that decide whether you grow.'
    }
  };
  var CTA = {
    strategy: 'Book a free strategy call',
    gap: 'Book your free Gap Analysis call'
  };

  /* ---------- State ---------- */
  var state = Object.assign({}, window.TWEAK_DEFAULTS || {
    heroVariant: 'A',
    benchmark: 'teased',
    casePlacement: 'after-problem',
    ctaLabel: 'strategy'
  });
  var headEl = document.querySelector('[data-hero-headline]');
  var subEl = document.querySelector('[data-hero-subhead]');
  var benchEl = document.querySelector('[data-bench]');
  var caseEl = document.querySelector('[data-case]');
  var caseAnchorAfterProblem = caseEl ? caseEl.nextElementSibling : null; // the CTA band that follows the case study
  var bucketEl = document.getElementById('bucket');
  function applyHero() {
    var v = HERO[state.heroVariant] || HERO.A;
    if (headEl) headEl.innerHTML = v.head;
    if (subEl) subEl.textContent = v.sub;
  }
  function applyBench() {
    if (benchEl) benchEl.setAttribute('data-mode', state.benchmark);
  }
  function applyCta() {
    var label = CTA[state.ctaLabel] || CTA.strategy;
    document.querySelectorAll('[data-cta]').forEach(function (a) {
      // preserve trailing arrow svg if present
      var svg = a.querySelector('svg');
      a.childNodes.forEach(function (n) {
        if (n.nodeType === 3) n.textContent = '';
      });
      a.insertBefore(document.createTextNode(label + (svg ? ' ' : '')), a.firstChild);
    });
  }
  function applyCasePlacement() {
    if (!caseEl) return;
    var main = document.querySelector('main');
    if (state.casePlacement === 'after-hero') {
      // move case study (and keep its following CTA band with it) right after the leaky-bucket section
      if (bucketEl && bucketEl.nextElementSibling !== caseEl) {
        bucketEl.insertAdjacentElement('afterend', caseEl);
        if (caseAnchorAfterProblem) caseEl.insertAdjacentElement('afterend', caseAnchorAfterProblem);
      }
    } else {
      // restore: case study before the proofbar (its natural home is after section 7 CTA → before proofbar)
      var proofbar = document.getElementById('proofbar');
      if (proofbar && proofbar.previousElementSibling !== caseAnchorAfterProblem) {
        proofbar.insertAdjacentElement('beforebegin', caseEl);
        if (caseAnchorAfterProblem) caseEl.insertAdjacentElement('afterend', caseAnchorAfterProblem);
      }
    }
  }
  function applyAll() {
    applyHero();
    applyBench();
    applyCta();
    applyCasePlacement();
    syncPanel();
  }

  /* ---------- FAQ: single-open accordion ---------- */
  document.querySelectorAll('.faq details').forEach(function (d) {
    d.addEventListener('toggle', function () {
      if (d.open) {
        document.querySelectorAll('.faq details').forEach(function (o) {
          if (o !== d) o.open = false;
        });
      }
    });
  });

  /* ---------- Reveal on scroll ---------- */
  if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      });
    }, {
      threshold: 0.12,
      rootMargin: '0px 0px -8% 0px'
    });
    document.querySelectorAll('.reveal').forEach(function (el) {
      io.observe(el);
    });
  } else {
    document.querySelectorAll('.reveal').forEach(function (el) {
      el.classList.add('in');
    });
  }

  /* ---------- Tweaks panel ---------- */
  var panel = document.getElementById('tweaks');
  function syncPanel() {
    panel.querySelectorAll('.seg').forEach(function (seg) {
      var key = seg.getAttribute('data-tw');
      seg.querySelectorAll('button').forEach(function (b) {
        b.classList.toggle('on', b.getAttribute('data-val') === state[key]);
      });
    });
  }
  panel.querySelectorAll('.seg').forEach(function (seg) {
    var key = seg.getAttribute('data-tw');
    seg.addEventListener('click', function (e) {
      var btn = e.target.closest('button');
      if (!btn) return;
      state[key] = btn.getAttribute('data-val');
      applyAll();
      try {
        window.parent.postMessage({
          type: '__edit_mode_set_keys',
          edits: makeEdits()
        }, '*');
      } catch (err) {}
    });
  });
  function makeEdits() {
    return {
      heroVariant: state.heroVariant,
      benchmark: state.benchmark,
      casePlacement: state.casePlacement,
      ctaLabel: state.ctaLabel
    };
  }
  document.getElementById('tw-close').addEventListener('click', function () {
    panel.classList.remove('open');
    try {
      window.parent.postMessage({
        type: '__edit_mode_dismissed'
      }, '*');
    } catch (err) {}
  });

  // Register listener BEFORE announcing availability.
  window.addEventListener('message', function (e) {
    var t = e.data && e.data.type;
    if (t === '__activate_edit_mode') {
      panel.classList.add('open');
      syncPanel();
    } else if (t === '__deactivate_edit_mode') {
      panel.classList.remove('open');
    }
  });
  try {
    window.parent.postMessage({
      type: '__edit_mode_available'
    }, '*');
  } catch (err) {}

  /* ---------- Init ---------- */
  applyAll();
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "landing-pages/vendo-dental-gap/app.js", error: String((e && e.message) || e) }); }

// ui_kits/marketing-site/marketing-sections.jsx
try { (() => {
/* Vendo Digital — marketing site sections. Exported to window for index.html. */
const {
  Button,
  Tag,
  Badge,
  StatCard,
  Avatar,
  Logo,
  Icon,
  Card
} = window.VendoDigitalDesignSystem_1a7a6e;
const NAV_LINKS = ['Services', 'Work', 'About', 'Insights'];
const SERVICES = ['Paid Search', 'Paid Social', 'SEO', 'Web Design', 'Growth Strategy'];
function Nav({
  onContact
}) {
  return /*#__PURE__*/React.createElement("header", {
    style: {
      position: 'sticky',
      top: 0,
      zIndex: 20,
      backdropFilter: 'blur(18px)',
      WebkitBackdropFilter: 'blur(18px)',
      background: 'rgba(5,20,18,0.72)',
      borderBottom: '1px solid var(--border-hairline)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 'var(--container-max)',
      margin: '0 auto',
      padding: '0 32px',
      height: 72,
      display: 'flex',
      alignItems: 'center',
      gap: 32
    }
  }, /*#__PURE__*/React.createElement(Logo, {
    tone: "white",
    size: 26
  }), /*#__PURE__*/React.createElement("nav", {
    style: {
      display: 'flex',
      gap: 28,
      marginLeft: 18
    }
  }, NAV_LINKS.map(l => /*#__PURE__*/React.createElement("a", {
    key: l,
    href: "#",
    style: {
      color: 'var(--text-secondary)',
      textDecoration: 'none',
      fontSize: 14,
      fontWeight: 500
    },
    onMouseEnter: e => e.currentTarget.style.color = 'var(--accent)',
    onMouseLeave: e => e.currentTarget.style.color = 'var(--text-secondary)'
  }, l))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginLeft: 'auto',
      display: 'flex',
      gap: 12,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    size: "sm"
  }, "Client login"), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    size: "sm",
    onClick: onContact,
    iconRight: /*#__PURE__*/React.createElement(Icon, {
      name: "arrow-right",
      size: 15
    })
  }, "Book a call"))));
}
function PhotoSlot({
  label,
  h = '100%',
  tint = 'var(--ink-700)'
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: tint,
      borderRadius: 'var(--radius-md)',
      height: h,
      position: 'relative',
      overflow: 'hidden',
      border: '1px solid var(--border-hairline)',
      display: 'flex',
      alignItems: 'flex-end',
      padding: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      background: 'radial-gradient(ellipse at 50% 20%, rgba(142,254,187,0.10), transparent 60%)'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'relative',
      fontSize: 10,
      letterSpacing: 'var(--tracking-wide)',
      textTransform: 'uppercase',
      color: 'var(--text-muted)'
    }
  }, label));
}
function Hero({
  onContact
}) {
  const [flourish, setFlourish] = React.useState(0);
  const words = ['growth.', 'ecommerce.', 'dental.', 'local.'];
  React.useEffect(() => {
    const id = setInterval(() => setFlourish(f => (f + 1) % words.length), 2600);
    return () => clearInterval(id);
  }, []);
  return /*#__PURE__*/React.createElement("section", {
    style: {
      maxWidth: 'var(--container-max)',
      margin: '0 auto',
      padding: '72px 32px 40px',
      display: 'grid',
      gridTemplateColumns: '1.15fr 0.85fr',
      gap: 48,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      padding: '6px 14px',
      borderRadius: 'var(--radius-pill)',
      background: 'var(--accent-soft)',
      border: '1px solid var(--border-strong)',
      marginBottom: 26
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 7,
      height: 7,
      borderRadius: '50%',
      background: 'var(--accent)'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--accent)',
      fontSize: 12,
      fontWeight: 600,
      letterSpacing: '0.01em'
    }
  }, "Data-driven growth partner")), /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: 0,
      color: 'var(--text-heading)',
      fontWeight: 800,
      fontSize: 64,
      lineHeight: 1.02,
      letterSpacing: '-0.035em'
    }
  }, "We Are Vendo", ' ', /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 400,
      fontStyle: 'italic',
      color: 'var(--accent)',
      letterSpacing: 0
    }
  }, words[flourish])), /*#__PURE__*/React.createElement("p", {
    style: {
      marginTop: 22,
      color: 'var(--text-secondary)',
      fontSize: 18,
      lineHeight: 1.6,
      maxWidth: 480
    }
  }, "We build businesses through strategic advertising, beautiful high-converting websites, and hands-on partnership. Less guesswork, more growth."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 14,
      marginTop: 30
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    size: "lg",
    onClick: onContact
  }, "Start a project"), /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    size: "lg",
    iconRight: /*#__PURE__*/React.createElement(Icon, {
      name: "arrow-up-right",
      size: 17
    })
  }, "See our work")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 36,
      marginTop: 46
    }
  }, /*#__PURE__*/React.createElement(StatHeadline, {
    value: "200%",
    label: "Avg. traffic increase"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      width: 1,
      background: 'var(--border-subtle)'
    }
  }), /*#__PURE__*/React.createElement(StatHeadline, {
    value: "200+",
    label: "New customers driven"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      width: 1,
      background: 'var(--border-subtle)'
    }
  }), /*#__PURE__*/React.createElement(StatHeadline, {
    value: "4.7\xD7",
    label: "Blended ROAS"
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gridTemplateRows: '160px 120px',
      gap: 12,
      height: 292
    }
  }, /*#__PURE__*/React.createElement(PhotoSlot, {
    label: "Campaign",
    tint: "var(--ink-700)"
  }), /*#__PURE__*/React.createElement(PhotoSlot, {
    label: "Studio",
    tint: "#0E2C28"
  }), /*#__PURE__*/React.createElement(PhotoSlot, {
    label: "Client",
    tint: "#0E2C28"
  }), /*#__PURE__*/React.createElement(PhotoSlot, {
    label: "Results",
    tint: "var(--ink-700)"
  })));
}
function StatHeadline({
  value,
  label
}) {
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 4
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "arrow-up-right",
    size: 20,
    color: "var(--accent)"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--text-heading)',
      fontSize: 34,
      fontWeight: 800,
      letterSpacing: '-0.03em',
      lineHeight: 1
    }
  }, value)), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 8,
      color: 'var(--text-muted)',
      fontSize: 11,
      letterSpacing: 'var(--tracking-wide)',
      textTransform: 'uppercase'
    }
  }, label));
}
function Services({
  active,
  setActive
}) {
  return /*#__PURE__*/React.createElement("section", {
    style: {
      maxWidth: 'var(--container-max)',
      margin: '0 auto',
      padding: '40px 32px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      marginBottom: 22
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      color: 'var(--accent)',
      fontSize: 12,
      fontWeight: 700,
      letterSpacing: 'var(--tracking-wide)',
      textTransform: 'uppercase'
    }
  }, "What we do"), /*#__PURE__*/React.createElement("h2", {
    style: {
      margin: '10px 0 0',
      color: 'var(--text-heading)',
      fontSize: 32,
      fontWeight: 700,
      letterSpacing: '-0.02em'
    }
  }, "Full-funnel, in one team"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      flexWrap: 'wrap',
      marginBottom: 22
    }
  }, SERVICES.map(s => /*#__PURE__*/React.createElement(Tag, {
    key: s,
    active: active === s,
    onClick: () => setActive(s)
  }, s))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: 16
    }
  }, [{
    icon: 'megaphone',
    t: 'Paid media that pays back',
    d: 'Search and social campaigns engineered around CPL, ROAS and incremental revenue — not vanity clicks.'
  }, {
    icon: 'globe',
    t: 'Sites that convert',
    d: 'Fast, beautiful builds with conversion baked in. Designed to turn traffic into booked revenue.'
  }, {
    icon: 'trending-up',
    t: 'SEO that compounds',
    d: 'Technical foundations, content and local SEO that grow a durable, lower-cost channel over time.'
  }].map(c => /*#__PURE__*/React.createElement(Card, {
    key: c.t,
    variant: "solid",
    hover: true,
    padding: "22px"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 40,
      height: 40,
      borderRadius: 'var(--radius-sm)',
      background: 'var(--accent-soft)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: c.icon,
    size: 20,
    color: "var(--accent)"
  })), /*#__PURE__*/React.createElement("h3", {
    style: {
      margin: 0,
      color: 'var(--text-heading)',
      fontSize: 18,
      fontWeight: 700,
      letterSpacing: '-0.01em'
    }
  }, c.t), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '10px 0 0',
      color: 'var(--text-secondary)',
      fontSize: 14,
      lineHeight: 1.6
    }
  }, c.d)))));
}
const TEAM = [{
  name: 'Max Rivens',
  role: 'Managing Director'
}, {
  name: 'Alfie Wakelin',
  role: 'Head of Web, SEO & PPC'
}, {
  name: 'Toby Raeburn',
  role: 'Head of Paid Social'
}];
function Team() {
  return /*#__PURE__*/React.createElement("section", {
    style: {
      maxWidth: 'var(--container-max)',
      margin: '0 auto',
      padding: '40px 32px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      color: 'var(--accent)',
      fontSize: 12,
      fontWeight: 700,
      letterSpacing: 'var(--tracking-wide)',
      textTransform: 'uppercase'
    }
  }, "The team"), /*#__PURE__*/React.createElement("h2", {
    style: {
      margin: '10px 0 26px',
      color: 'var(--text-heading)',
      fontSize: 32,
      fontWeight: 700,
      letterSpacing: '-0.02em'
    }
  }, "Senior people, ", /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-display)',
      fontStyle: 'italic',
      fontWeight: 400,
      color: 'var(--accent)'
    }
  }, "on your account")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: 16
    }
  }, TEAM.map(m => /*#__PURE__*/React.createElement(Card, {
    key: m.name,
    variant: "solid",
    padding: "0",
    style: {
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: 180,
      background: 'linear-gradient(160deg, #0E2C28, #09221F)',
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      background: 'radial-gradient(ellipse at 50% 30%, rgba(142,254,187,0.12), transparent 60%)'
    }
  }), /*#__PURE__*/React.createElement(Avatar, {
    name: m.name,
    size: 64
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 18,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      color: 'var(--text-heading)',
      fontSize: 16,
      fontWeight: 700
    }
  }, m.name), /*#__PURE__*/React.createElement("div", {
    style: {
      color: 'var(--text-muted)',
      fontSize: 12,
      marginTop: 3
    }
  }, m.role)), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 34,
      height: 34,
      borderRadius: '50%',
      border: '1px solid var(--border-subtle)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "arrow-up-right",
    size: 16,
    color: "var(--text-secondary)"
  })))))));
}
function Cta({
  onContact
}) {
  return /*#__PURE__*/React.createElement("section", {
    style: {
      maxWidth: 'var(--container-max)',
      margin: '40px auto 0',
      padding: '0 32px 64px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      borderRadius: 'var(--radius-xl)',
      padding: '56px 48px',
      position: 'relative',
      overflow: 'hidden',
      background: 'linear-gradient(135deg, #0A1F1B, #051412)',
      border: '1px solid var(--border-subtle)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: -80,
      right: -40,
      width: 360,
      height: 360,
      borderRadius: '50%',
      background: 'var(--accent)',
      opacity: 0.10,
      filter: 'blur(80px)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 32,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h2", {
    style: {
      margin: 0,
      color: 'var(--text-heading)',
      fontSize: 38,
      fontWeight: 800,
      letterSpacing: '-0.03em',
      lineHeight: 1.1
    }
  }, "Ready to grow?"), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '12px 0 0',
      color: 'var(--text-secondary)',
      fontSize: 16,
      maxWidth: 420
    }
  }, "Book a free strategy call. We'll map the fastest path to revenue for your business.")), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    size: "lg",
    onClick: onContact,
    iconRight: /*#__PURE__*/React.createElement(Icon, {
      name: "arrow-right",
      size: 18
    })
  }, "Book a call"))), /*#__PURE__*/React.createElement("footer", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '32px 4px 0',
      flexWrap: 'wrap',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement(Logo, {
    tone: "white",
    size: 22
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 18,
      color: 'var(--text-muted)',
      fontSize: 13
    }
  }, /*#__PURE__*/React.createElement("span", null, "hello@vendodigital.co.uk"), /*#__PURE__*/React.createElement("span", null, "\xB7"), /*#__PURE__*/React.createElement("span", null, "www.vendodigital.co.uk")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 12
    }
  }, ['phone', 'mail', 'map-pin'].map(i => /*#__PURE__*/React.createElement("span", {
    key: i,
    style: {
      width: 34,
      height: 34,
      borderRadius: '50%',
      border: '1px solid var(--border-subtle)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: i,
    size: 16,
    color: "var(--text-secondary)"
  }))))));
}
Object.assign(window, {
  VNav: Nav,
  VHero: Hero,
  VServices: Services,
  VTeam: Team,
  VCta: Cta
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/marketing-site/marketing-sections.jsx", error: String((e && e.message) || e) }); }

// ui_kits/os-dashboard/os-sections.jsx
try { (() => {
/* Vendo OS — internal ops dashboard. Sections exported to window for index.html. */
const {
  StatCard,
  Badge,
  Tag,
  Avatar,
  Logo,
  Icon,
  Button,
  Input,
  Card
} = window.VendoDigitalDesignSystem_1a7a6e;
const NAV = [{
  id: 'dashboard',
  label: 'Dashboard',
  icon: 'layout-grid'
}, {
  id: 'pipeline',
  label: 'Pipeline',
  icon: 'trending-up'
}, {
  id: 'clients',
  label: 'Clients',
  icon: 'users'
}, {
  id: 'reports',
  label: 'Reports',
  icon: 'file-text'
}, {
  id: 'ads',
  label: 'Ad Performance',
  icon: 'target'
}, {
  id: 'settings',
  label: 'Settings',
  icon: 'settings'
}];
function Sidebar({
  view,
  setView
}) {
  return /*#__PURE__*/React.createElement("aside", {
    style: {
      width: 248,
      flexShrink: 0,
      background: 'var(--glass-fill-strong)',
      backdropFilter: 'var(--blur-glass)',
      WebkitBackdropFilter: 'var(--blur-glass)',
      border: '1px solid var(--glass-border)',
      borderRadius: 'var(--radius-lg)',
      boxShadow: 'var(--shadow-lg)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '20px 18px',
      borderBottom: '1px solid var(--border-hairline)',
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 34,
      height: 34,
      borderRadius: 9,
      background: 'var(--accent)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(Logo, {
    variant: "icon",
    tone: "black",
    size: 18
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      color: 'var(--text-heading)',
      fontWeight: 700,
      fontSize: 14,
      letterSpacing: '-0.01em'
    }
  }, "Vendo OS"), /*#__PURE__*/React.createElement("div", {
    style: {
      color: 'var(--text-muted)',
      fontSize: 11
    }
  }, "Operations"))), /*#__PURE__*/React.createElement("nav", {
    style: {
      padding: 12,
      display: 'flex',
      flexDirection: 'column',
      gap: 2,
      flex: 1
    }
  }, NAV.map(n => {
    const active = view === n.id;
    return /*#__PURE__*/React.createElement("button", {
      key: n.id,
      onClick: () => setView(n.id),
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 11,
        padding: '10px 12px',
        borderRadius: 'var(--radius-sm)',
        border: 'none',
        cursor: 'pointer',
        textAlign: 'left',
        background: active ? 'var(--accent-soft)' : 'transparent',
        color: active ? 'var(--accent)' : 'var(--text-secondary)',
        fontFamily: 'var(--font-sans)',
        fontSize: 13.5,
        fontWeight: active ? 600 : 500,
        transition: 'background var(--dur-fast), color var(--dur-fast)'
      },
      onMouseEnter: e => {
        if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
      },
      onMouseLeave: e => {
        if (!active) e.currentTarget.style.background = 'transparent';
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: n.icon,
      size: 18
    }), n.label);
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 12,
      borderTop: '1px solid var(--border-hairline)',
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: "Max Rivens",
    size: 34
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      color: 'var(--text-body)',
      fontSize: 13,
      fontWeight: 600
    }
  }, "Max Rivens"), /*#__PURE__*/React.createElement("div", {
    style: {
      color: 'var(--text-muted)',
      fontSize: 11
    }
  }, "Admin")), /*#__PURE__*/React.createElement(Icon, {
    name: "settings",
    size: 16,
    color: "var(--text-muted)"
  })));
}
function Topbar({
  title
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      height: 60,
      flexShrink: 0,
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      background: 'var(--glass-fill)',
      backdropFilter: 'var(--blur-glass)',
      WebkitBackdropFilter: 'var(--blur-glass)',
      border: '1px solid var(--glass-border)',
      borderRadius: 'var(--radius-lg)',
      boxShadow: 'var(--shadow-lg)',
      padding: '0 18px'
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: 0,
      color: 'var(--text-heading)',
      fontSize: 18,
      fontWeight: 700,
      letterSpacing: '-0.01em'
    }
  }, title), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 280,
      marginLeft: 8
    }
  }, /*#__PURE__*/React.createElement(Input, {
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "search",
      size: 15,
      color: "var(--text-muted)"
    }),
    placeholder: "Search clients, reports\u2026"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginLeft: 'auto',
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'relative',
      width: 38,
      height: 38,
      borderRadius: 'var(--radius-sm)',
      border: '1px solid var(--border-subtle)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "bell",
    size: 17,
    color: "var(--text-secondary)"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      top: 8,
      right: 9,
      width: 6,
      height: 6,
      borderRadius: '50%',
      background: 'var(--accent)'
    }
  })), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    size: "sm",
    iconLeft: /*#__PURE__*/React.createElement(Icon, {
      name: "plus",
      size: 15
    })
  }, "New report")));
}
const SECTION_LABEL = {
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: 'var(--tracking-wide)',
  textTransform: 'uppercase',
  color: 'var(--text-muted)',
  margin: '4px 0 14px'
};
function DashboardView() {
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("p", {
    style: SECTION_LABEL
  }, "Revenue & margin"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: 14,
      marginBottom: 28
    }
  }, /*#__PURE__*/React.createElement(StatCard, {
    value: "\xA3148.2K",
    label: "Monthly Revenue",
    delta: "+8%"
  }), /*#__PURE__*/React.createElement(StatCard, {
    value: "\xA31.78M",
    label: "Annual Run Rate",
    breakdown: "Target \xA32M"
  }), /*#__PURE__*/React.createElement(StatCard, {
    value: "24%",
    label: "Net Margin",
    breakdown: "Target 25%"
  }), /*#__PURE__*/React.createElement(StatCard, {
    value: "+8%",
    label: "vs Last Month",
    breakdown: "\xA312.3k above plan"
  })), /*#__PURE__*/React.createElement("p", {
    style: SECTION_LABEL
  }, "Pipeline & ad performance"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: 14,
      marginBottom: 28
    }
  }, /*#__PURE__*/React.createElement(StatCard, {
    value: "\xA392.4K",
    label: "Open Deals",
    breakdown: "14 opportunities"
  }), /*#__PURE__*/React.createElement(StatCard, {
    value: "6",
    label: "Won This Month",
    breakdown: "\xA341.2k value"
  }), /*#__PURE__*/React.createElement(StatCard, {
    value: "\xA338.4K",
    label: "Ad Spend 30d",
    breakdown: "Meta \xA322.3k \xB7 Google \xA316.1k"
  }), /*#__PURE__*/React.createElement(StatCard, {
    value: "\xA39.32",
    label: "Avg CPL",
    delta: "-6%",
    deltaTone: "positive"
  })), /*#__PURE__*/React.createElement("p", {
    style: SECTION_LABEL
  }, "Spend vs leads \u2014 last 12 weeks"), /*#__PURE__*/React.createElement(Card, {
    variant: "glass",
    padding: "22px"
  }, /*#__PURE__*/React.createElement(MiniChart, null)));
}
function MiniChart() {
  const data = [42, 48, 45, 60, 55, 68, 64, 72, 70, 82, 78, 91];
  const max = Math.max(...data);
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-end',
      gap: 10,
      height: 150
    }
  }, data.map((v, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: '100%',
      height: `${v / max * 130}px`,
      borderRadius: 6,
      background: i === data.length - 1 ? 'var(--accent)' : 'linear-gradient(180deg, rgba(142,254,187,0.55), rgba(142,254,187,0.12))'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 9,
      color: 'var(--text-muted)'
    }
  }, "W", i + 1)))));
}
const CLIENTS = [{
  name: 'Sutton Dental Co',
  channels: ['Paid Social', 'SEO'],
  status: ['positive', 'Active'],
  mrr: '£4,200',
  report: 'Today'
}, {
  name: 'Harbourline Kitchens',
  channels: ['Paid Search'],
  status: ['warning', 'Generating'],
  mrr: '£3,650',
  report: '2d ago'
}, {
  name: 'Meridian Fitness',
  channels: ['Paid Social', 'Web'],
  status: ['positive', 'Active'],
  mrr: '£5,100',
  report: 'Yesterday'
}, {
  name: 'Oakfield Law',
  channels: ['SEO'],
  status: ['info', 'Draft ready'],
  mrr: '£2,400',
  report: '4d ago'
}, {
  name: 'Verde Landscaping',
  channels: ['Paid Search', 'SEO'],
  status: ['negative', 'Overdue'],
  mrr: '£1,950',
  report: '11d ago'
}];
function ClientsView() {
  const [q, setQ] = React.useState('');
  const rows = CLIENTS.filter(c => c.name.toLowerCase().includes(q.toLowerCase()));
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 12,
      marginBottom: 18,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 280
    }
  }, /*#__PURE__*/React.createElement(Input, {
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "search",
      size: 15,
      color: "var(--text-muted)"
    }),
    placeholder: "Filter clients\u2026",
    value: q,
    onChange: e => setQ(e.target.value)
  })), /*#__PURE__*/React.createElement(Badge, {
    tone: "neutral"
  }, rows.length, " clients"), /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    size: "sm",
    style: {
      marginLeft: 'auto'
    },
    iconLeft: /*#__PURE__*/React.createElement(Icon, {
      name: "plus",
      size: 15
    })
  }, "Add client")), /*#__PURE__*/React.createElement(Card, {
    variant: "glass",
    padding: "0",
    style: {
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("table", {
    style: {
      width: '100%',
      borderCollapse: 'collapse'
    }
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", {
    style: {
      background: 'rgba(255,255,255,0.03)'
    }
  }, ['Client', 'Channels', 'Status', 'MRR', 'Last report'].map(h => /*#__PURE__*/React.createElement("th", {
    key: h,
    style: {
      textAlign: 'left',
      padding: '13px 18px',
      fontSize: 11,
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: 'var(--tracking-wide)',
      color: 'var(--text-muted)',
      borderBottom: '1px solid var(--border-hairline)'
    }
  }, h)))), /*#__PURE__*/React.createElement("tbody", null, rows.map(c => /*#__PURE__*/React.createElement("tr", {
    key: c.name,
    style: {
      borderBottom: '1px solid rgba(255,255,255,0.04)'
    },
    onMouseEnter: e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)',
    onMouseLeave: e => e.currentTarget.style.background = 'transparent'
  }, /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '13px 18px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 11
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: c.name,
    size: 32
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--text-heading)',
      fontSize: 14,
      fontWeight: 600
    }
  }, c.name))), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '13px 18px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6
    }
  }, c.channels.map(ch => /*#__PURE__*/React.createElement(Tag, {
    key: ch,
    style: {
      padding: '0.3rem 0.65rem',
      fontSize: 11
    }
  }, ch)))), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '13px 18px'
    }
  }, /*#__PURE__*/React.createElement(Badge, {
    tone: c.status[0],
    dot: true
  }, c.status[1])), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '13px 18px',
      color: 'var(--text-body)',
      fontSize: 14,
      fontWeight: 600
    }
  }, c.mrr), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '13px 18px',
      color: 'var(--text-muted)',
      fontSize: 13
    }
  }, c.report)))))));
}
function PlaceholderView({
  title
}) {
  return /*#__PURE__*/React.createElement(Card, {
    variant: "glass",
    padding: "48px",
    style: {
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 48,
      height: 48,
      borderRadius: 'var(--radius-md)',
      background: 'var(--accent-soft)',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "layout-grid",
    size: 22,
    color: "var(--accent)"
  })), /*#__PURE__*/React.createElement("h3", {
    style: {
      margin: 0,
      color: 'var(--text-heading)',
      fontSize: 18,
      fontWeight: 700
    }
  }, title), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '8px 0 0',
      color: 'var(--text-muted)',
      fontSize: 14
    }
  }, "This surface is part of the live Vendo OS product."));
}
Object.assign(window, {
  OsSidebar: Sidebar,
  OsTopbar: Topbar,
  OsDashboard: DashboardView,
  OsClients: ClientsView,
  OsPlaceholder: PlaceholderView
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/os-dashboard/os-sections.jsx", error: String((e && e.message) || e) }); }

// website/vendo-dental/chrome.js
try { (() => {
/* ============================================================
   Vendo Dental — shared chrome (header mega-menu + footer sitemap)
   Injected into every page so the IA lives in ONE place.
   Set data-active on <body> (e.g. "marketing") to highlight nav.
   ============================================================ */
(function () {
  'use strict';

  var BASE = window.VD_BASE !== undefined ? window.VD_BASE : '';
  var L = function (p) {
    return BASE + p;
  };
  var HEADER = '\
  <header class="site-header">\
    <div class="wrap nav">\
      <a class="brand" href="' + L('home.html') + '" aria-label="Vendo Dental home">\
        <img src="../../assets/logo/VD_LOGO_WHITE.svg" alt="Vendo">\
        <span class="sub">Dental</span>\
      </a>\
      <nav class="nav-links" aria-label="Primary">\
        <div class="nav-item">\
          <button class="nav-link">Dental Marketing <svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg></button>\
          <div class="drop mega">\
            <div class="mega-grid">\
              <div class="mega-col">\
                <span class="pill-h">Paid Ads</span>\
                <ul>\
                  <li><a href="' + L('service.html') + '">Google Ads Management<span class="sub">Paid search</span></a></li>\
                  <li><a href="' + L('service.html') + '">Microsoft Ads Management<span class="sub">Paid search</span></a></li>\
                  <li><a href="' + L('service.html') + '">Meta Ads Management<span class="sub">Paid social</span></a></li>\
                  <li><a href="' + L('service.html') + '">TikTok Ads Management<span class="sub">Paid social</span></a></li>\
                </ul>\
              </div>\
              <div class="mega-col">\
                <span class="pill-h">Organic Growth</span>\
                <ul>\
                  <li><a href="' + L('service.html') + '">Dental SEO</a></li>\
                  <li><a href="' + L('service.html') + '">Local SEO</a></li>\
                  <li><a href="' + L('service.html') + '">AI SEO / GEO</a></li>\
                  <li><a href="' + L('service.html') + '">Content Production</a></li>\
                  <li><a href="' + L('service.html') + '">Social Media</a></li>\
                </ul>\
              </div>\
              <div class="mega-col">\
                <span class="pill-h">Websites &amp; Brand</span>\
                <ul>\
                  <li><a href="' + L('service.html') + '">Dental Websites</a></li>\
                  <li><a href="' + L('service.html') + '">Landing Pages</a></li>\
                  <li><a href="' + L('service.html') + '">Branding &amp; Design</a></li>\
                  <li><a href="' + L('service.html') + '">Photo &amp; Video</a></li>\
                </ul>\
              </div>\
              <div class="mega-col">\
                <span class="pill-h">Practice Growth</span>\
                <ul>\
                  <li><a href="' + L('service.html') + '">Treatment Open Days</a></li>\
                  <li><a href="' + L('service.html') + '">Dental CRM &amp; Lead Nurture</a></li>\
                  <li><a href="' + L('service.html') + '">Reputation &amp; Reviews</a></li>\
                  <li><a href="' + L('service.html') + '">Patient Journey Mapping</a></li>\
                  <li><a href="' + L('service.html') + '">PMS Integration</a></li>\
                </ul>\
              </div>\
            </div>\
            <div class="mega-foot">\
              <span>Not sure where to start? We\u2019ll map the fastest path to growth for your practice.</span>\
              <a class="btn btn-primary" href="' + L('home.html') + '#book">Book a free strategy call</a>\
            </div>\
          </div>\
        </div>\
        <div class="nav-item">\
          <button class="nav-link">Who We Serve <svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg></button>\
          <div class="drop drop-sm">\
            <a class="drop-link" href="' + L('who-we-serve.html') + '"><b>Private Practices</b><span>Fee-per-item, cosmetic-led</span></a>\
            <a class="drop-link" href="' + L('who-we-serve.html') + '"><b>Mixed NHS &amp; Private</b><span>Convert NHS to private</span></a>\
            <a class="drop-link" href="' + L('who-we-serve.html') + '"><b>Squat Practices</b><span>Launch from zero</span></a>\
            <a class="drop-link" href="' + L('who-we-serve.html') + '"><b>Multi-Site &amp; DSOs</b><span>Consolidated growth</span></a>\
            <a class="drop-link" href="' + L('who-we-serve.html') + '"><b>Specialist Clinics</b><span>Implants, ortho, cosmetic</span></a>\
          </div>\
        </div>\
        <div class="nav-item"><a class="nav-link" href="' + L('case-study.html') + '">Case Studies</a></div>\
        <div class="nav-item">\
          <button class="nav-link">Resources <svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg></button>\
          <div class="drop drop-sm">\
            <a class="drop-link" href="' + L('home.html') + '#tools"><b>Marketing Scorecard</b><span>Free 2-min practice quiz</span></a>\
            <a class="drop-link" href="' + L('home.html') + '#tools"><b>MER Calculator</b><span>Benchmark spend vs revenue</span></a>\
            <a class="drop-link" href="' + L('home.html') + '"><b>Guides</b><span>Playbooks for UK practices</span></a>\
            <a class="drop-link" href="' + L('home.html') + '"><b>Blog</b><span>Dental marketing insights</span></a>\
          </div>\
        </div>\
        <div class="nav-item"><a class="nav-link" href="' + L('home.html') + '">About</a></div>\
      </nav>\
      <div class="nav-cta">\
        <a class="btn btn-ghost" href="' + L('home.html') + '#book">Client login</a>\
        <a class="btn btn-primary" href="' + L('home.html') + '#book">Book a call</a>\
      </div>\
      <button class="menu-toggle" aria-label="Menu"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 12h16M4 6h16M4 18h16"/></svg></button>\
    </div>\
  </header>';
  var FOOTER = '\
  <footer class="site-footer">\
    <div class="wrap">\
      <div class="footer-top">\
        <div class="footer-brand">\
          <img src="../../assets/logo/VD_LOGO_WHITE.svg" alt="Vendo Dental">\
          <p>The growth agency for UK dental practices. We only do dental \u2014 paid ads, SEO, websites and patient systems that fill your diary.</p>\
          <div class="social">\
            <a href="#" aria-label="Instagram"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg></a>\
            <a href="#" aria-label="LinkedIn"><svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M4.98 3.5A2.5 2.5 0 1 0 5 8.5 2.5 2.5 0 0 0 4.98 3.5zM3 9h4v12H3zM9 9h3.8v1.7h.05c.53-1 1.83-2.05 3.76-2.05 4 0 4.74 2.64 4.74 6.07V21H19v-5.4c0-1.29-.02-2.95-1.8-2.95-1.8 0-2.08 1.4-2.08 2.85V21H9z"/></svg></a>\
            <a href="#" aria-label="Facebook"><svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M14 9h3V5h-3c-2.2 0-4 1.8-4 4v2H7v4h3v8h4v-8h3l1-4h-4V9c0-.6.4-1 1-1z"/></svg></a>\
          </div>\
        </div>\
        <div class="footer-col">\
          <h4>Dental Marketing</h4>\
          <ul>\
            <li><a href="' + L('service.html') + '">Paid Ads</a></li>\
            <li><a href="' + L('service.html') + '">Dental &amp; Local SEO</a></li>\
            <li><a href="' + L('service.html') + '">Websites &amp; Brand</a></li>\
            <li><a href="' + L('service.html') + '">Treatment Open Days</a></li>\
            <li><a href="' + L('service.html') + '">Dental CRM</a></li>\
          </ul>\
        </div>\
        <div class="footer-col">\
          <h4>Who We Serve</h4>\
          <ul>\
            <li><a href="' + L('who-we-serve.html') + '">Private Practices</a></li>\
            <li><a href="' + L('who-we-serve.html') + '">Mixed NHS &amp; Private</a></li>\
            <li><a href="' + L('who-we-serve.html') + '">Squat Practices</a></li>\
            <li><a href="' + L('who-we-serve.html') + '">Multi-Site &amp; DSOs</a></li>\
            <li><a href="' + L('who-we-serve.html') + '">Specialist Clinics</a></li>\
          </ul>\
        </div>\
        <div class="footer-col">\
          <h4>Company</h4>\
          <ul>\
            <li><a href="' + L('case-study.html') + '">Case Studies</a></li>\
            <li><a href="' + L('home.html') + '">Our Story</a></li>\
            <li><a href="' + L('home.html') + '">Meet the Team</a></li>\
            <li><a href="' + L('home.html') + '">Onboarding</a></li>\
            <li><a href="' + L('home.html') + '#book">Contact</a></li>\
          </ul>\
        </div>\
        <div class="footer-col">\
          <h4>Resources</h4>\
          <ul>\
            <li><a href="' + L('home.html') + '#tools">Marketing Scorecard</a></li>\
            <li><a href="' + L('home.html') + '#tools">MER Calculator</a></li>\
            <li><a href="' + L('home.html') + '">Guides</a></li>\
            <li><a href="' + L('home.html') + '">Blog</a></li>\
          </ul>\
        </div>\
      </div>\
      <div class="footer-bottom">\
        <span>\u00A9 2026 Vendo Dental \u2014 a division of Vendo Digital. All rights reserved.</span>\
        <div class="links"><a href="#">Privacy</a><a href="#">Terms</a><a href="#">Cookies</a></div>\
      </div>\
    </div>\
  </footer>';
  function mount() {
    var h = document.getElementById('vd-header');
    var f = document.getElementById('vd-footer');
    if (h) h.outerHTML = HEADER;
    if (f) f.outerHTML = FOOTER;

    // Reveal-on-scroll
    var reveals = document.querySelectorAll('.reveal');
    if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      var io = new IntersectionObserver(function (en) {
        en.forEach(function (e) {
          if (e.isIntersecting) {
            e.target.classList.add('in');
            io.unobserve(e.target);
          }
        });
      }, {
        threshold: 0.1,
        rootMargin: '0px 0px -6% 0px'
      });
      reveals.forEach(function (el) {
        io.observe(el);
      });
    } else {
      reveals.forEach(function (el) {
        el.classList.add('in');
      });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);else mount();
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "website/vendo-dental/chrome.js", error: String((e && e.message) || e) }); }

__ds_ns.Avatar = __ds_scope.Avatar;

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.Icon = __ds_scope.Icon;

__ds_ns.Logo = __ds_scope.Logo;

__ds_ns.StatCard = __ds_scope.StatCard;

__ds_ns.Tag = __ds_scope.Tag;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.Switch = __ds_scope.Switch;

})();
