/**
 * TweaksPanel — right-side floating drawer (internal mode only) with
 * appearance + report controls. Persists settings via the useTweaks
 * hook so a dev/admin's preferences survive a page refresh.
 *
 * Hidden entirely when mode === 'client'.
 */
import { useState } from 'react';
import type { Tweaks } from '../lib/useTweaks';

interface TweaksPanelProps {
  tweaks: Tweaks;
  setTweak: <K extends keyof Tweaks>(key: K, value: Tweaks[K]) => void;
}

export function TweaksPanel({ tweaks, setTweak }: TweaksPanelProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="vr-tweaks-fab"
        onClick={() => setOpen(o => !o)}
        aria-label="Open tweaks panel"
        title={open ? 'Close tweaks' : 'Open tweaks'}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
          <circle cx="8" cy="8" r="1.4" stroke="currentColor" strokeWidth="1.4" />
          <path
            d="M8 1V3M8 13V15M15 8H13M3 8H1M12.5 3.5L11 5M5 11L3.5 12.5M12.5 12.5L11 11M5 5L3.5 3.5"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {open && (
        <div className="vr-tweaks-panel" role="dialog" aria-label="Tweaks">
          <div className="vr-tweaks-head">
            <span className="vr-tweaks-title">Tweaks</span>
            <button
              type="button"
              className="vr-tweaks-close"
              onClick={() => setOpen(false)}
              aria-label="Close"
            >
              ×
            </button>
          </div>

          <div className="vr-tweaks-section">
            <div className="vr-tweaks-section-label">Appearance</div>

            <label className="vr-tweaks-row">
              <span>Dark mode</span>
              <input
                type="checkbox"
                checked={tweaks.darkMode}
                onChange={e => setTweak('darkMode', e.target.checked)}
              />
            </label>

            <label className="vr-tweaks-row vr-tweaks-row-col">
              <span>
                Accent hue
                <span className="vr-tweaks-meta">{tweaks.accentHue}°</span>
              </span>
              <input
                type="range"
                min={0}
                max={360}
                step={5}
                value={tweaks.accentHue}
                onChange={e => setTweak('accentHue', Number(e.target.value))}
              />
            </label>

            <div className="vr-tweaks-row vr-tweaks-row-col">
              <span>Density</span>
              <div className="vr-tweaks-radios">
                {(['compact', 'default', 'comfy'] as const).map(d => (
                  <label key={d} className="vr-tweaks-radio">
                    <input
                      type="radio"
                      name="vr-density"
                      checked={tweaks.density === d}
                      onChange={() => setTweak('density', d)}
                    />
                    <span>{d[0].toUpperCase() + d.slice(1)}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="vr-tweaks-section">
            <div className="vr-tweaks-section-label">Report</div>

            <label className="vr-tweaks-row vr-tweaks-row-col">
              <span>Date range</span>
              <select
                value={tweaks.dateRange}
                onChange={e => setTweak('dateRange', e.target.value)}
              >
                {[
                  'Last 7 days',
                  'Last 30 days',
                  'Last 90 days',
                  'This quarter',
                  'Year to date',
                ].map(opt => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      )}
    </>
  );
}
