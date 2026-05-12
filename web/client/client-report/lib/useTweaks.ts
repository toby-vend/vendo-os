/**
 * useTweaks — local-storage-backed customisation state for the dashboard.
 *
 * Internal users get a right-side drawer to toggle dark mode / accent hue
 * / density / date range. Client mode never instantiates the TweaksPanel
 * so the values stay at the defaults defined here.
 */
import { useEffect, useState } from 'react';

export interface Tweaks {
  darkMode: boolean;
  accentHue: number;
  density: 'compact' | 'default' | 'comfy';
  dateRange: string;
  showSparklines: boolean;
}

export const TWEAK_DEFAULTS: Tweaks = {
  darkMode: false,
  accentHue: 195,
  density: 'default',
  dateRange: 'Last 30 days',
  showSparklines: true,
};

const STORAGE_KEY = 'vendo-report-tweaks';

function load(): Tweaks {
  if (typeof window === 'undefined') return TWEAK_DEFAULTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return TWEAK_DEFAULTS;
    const parsed = JSON.parse(raw);
    return { ...TWEAK_DEFAULTS, ...parsed };
  } catch {
    return TWEAK_DEFAULTS;
  }
}

export function useTweaks(): [Tweaks, <K extends keyof Tweaks>(key: K, value: Tweaks[K]) => void] {
  const [tweaks, setTweaks] = useState<Tweaks>(load);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tweaks));
    } catch {
      /* quota exceeded / private mode — ignore */
    }
  }, [tweaks]);

  function setTweak<K extends keyof Tweaks>(key: K, value: Tweaks[K]): void {
    setTweaks(prev => ({ ...prev, [key]: value }));
  }

  return [tweaks, setTweak];
}
