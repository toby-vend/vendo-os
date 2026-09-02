import * as React from 'react';

export interface BadgeProps {
  children?: React.ReactNode;
  /** @default "neutral" */
  tone?: 'positive' | 'warning' | 'negative' | 'info' | 'accent' | 'neutral';
  /** Show a leading status dot. @default false */
  dot?: boolean;
  style?: React.CSSProperties;
}

/** Small status pill for states (active, overdue, approved…). */
export function Badge(props: BadgeProps): JSX.Element;
