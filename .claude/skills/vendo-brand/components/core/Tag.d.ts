import * as React from 'react';

export interface TagProps {
  children?: React.ReactNode;
  /** @default "outline" */
  variant?: 'outline' | 'solid';
  /** Selected state. @default false */
  active?: boolean;
  onClick?: (e: React.MouseEvent<HTMLSpanElement>) => void;
  style?: React.CSSProperties;
}

/** Pill chip for service labels and selectable filters. */
export function Tag(props: TagProps): JSX.Element;
