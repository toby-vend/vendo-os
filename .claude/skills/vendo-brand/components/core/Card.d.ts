import * as React from 'react';

/** Surface container — glassmorphic product card or solid marketing panel. */
export interface CardProps {
  children?: React.ReactNode;
  /** glass = translucent blur (product) · solid = sage panel (marketing) · bare. @default "glass" */
  variant?: 'glass' | 'solid' | 'bare';
  /** CSS padding value. @default var(--space-5) */
  padding?: string;
  /** Lift border + shadow on hover. @default false */
  hover?: boolean;
  style?: React.CSSProperties;
}

/** Surface container — glassmorphic product card or solid marketing panel. */
export function Card(props: CardProps): JSX.Element;
