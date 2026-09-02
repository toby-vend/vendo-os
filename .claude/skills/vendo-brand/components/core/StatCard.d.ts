import * as React from 'react';

/** KPI tile — oversized mint number, uppercase label, optional delta arrow. */
export interface StatCardProps {
  /** Big metric value, e.g. "£23.8K" or "200%". */
  value: React.ReactNode;
  /** Uppercase label below the number. */
  label: string;
  /** Optional delta, e.g. "+12%". */
  delta?: React.ReactNode;
  /** @default "positive" */
  deltaTone?: 'positive' | 'negative' | 'warning';
  /** Small secondary breakdown line. */
  breakdown?: React.ReactNode;
  /** @default "glass" */
  variant?: 'glass' | 'solid';
  style?: React.CSSProperties;
}

/** KPI tile — oversized mint number, uppercase label, optional delta arrow. */
export function StatCard(props: StatCardProps): JSX.Element;
