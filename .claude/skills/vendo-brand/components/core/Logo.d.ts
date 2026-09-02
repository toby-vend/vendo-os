import * as React from 'react';

export interface LogoProps {
  /** Full wordmark or compact icon. @default "wordmark" */
  variant?: 'wordmark' | 'icon';
  /** @default "white" */
  tone?: 'white' | 'green' | 'black';
  /** Font size in px. @default 28 */
  size?: number;
  style?: React.CSSProperties;
}

/** Vendo wordmark / "V." mark in Manrope. For exact vector use assets/logo/*.svg. */
export function Logo(props: LogoProps): JSX.Element;
