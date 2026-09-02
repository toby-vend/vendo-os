import * as React from 'react';

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'style'> {
  /** Field label above the input. */
  label?: string | null;
  /** Leading icon node (e.g. <Icon name="search" size={16} />). */
  icon?: React.ReactNode;
  /** Error message — turns the field red. */
  error?: string | null;
  /** Helper text below the field. */
  hint?: string | null;
  style?: React.CSSProperties;
}

/** Dark text input with optional label, leading icon, focus ring and error state. */
export function Input(props: InputProps): JSX.Element;
