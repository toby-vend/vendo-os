import * as React from 'react';

export type IconName =
  | 'phone' | 'mail' | 'map-pin' | 'cursor' | 'search'
  | 'arrow-right' | 'arrow-up-right' | 'chevron-right' | 'chevron-down'
  | 'menu' | 'x' | 'check' | 'plus' | 'bell' | 'settings' | 'user'
  | 'trending-up' | 'bar-chart' | 'target' | 'globe' | 'megaphone'
  | 'layout-grid' | 'file-text' | 'users' | 'star' | 'external';

export interface IconProps {
  /** Glyph name (see iconNames). */
  name: IconName;
  /** Pixel size. @default 20 */
  size?: number;
  /** @default 1.8 */
  strokeWidth?: number;
  /** Stroke colour. @default "currentColor" */
  color?: string;
  style?: React.CSSProperties;
}

/** Vendo line icons — light, rounded-stroke glyphs on a 24×24 grid. */
export function Icon(props: IconProps): JSX.Element;
export const iconNames: string[];
