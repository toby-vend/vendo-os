import * as React from 'react';

export interface SwitchProps {
  /** On/off state. @default false */
  checked?: boolean;
  onChange?: (next: boolean) => void;
  disabled?: boolean;
  /** Optional trailing label. */
  label?: string | null;
  style?: React.CSSProperties;
}

/** Toggle switch — mint track when on. */
export function Switch(props: SwitchProps): JSX.Element;
