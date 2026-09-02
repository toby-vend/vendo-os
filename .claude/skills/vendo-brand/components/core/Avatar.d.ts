import * as React from 'react';

export interface AvatarProps {
  /** Image URL; falls back to initials when absent. */
  src?: string | null;
  /** Full name — drives initials and alt text. */
  name?: string;
  /** Pixel diameter. @default 40 */
  size?: number;
  /** Mint status ring. @default false */
  ring?: boolean;
  style?: React.CSSProperties;
}

/** Circular avatar — image or initials on a sage tile. */
export function Avatar(props: AvatarProps): JSX.Element;
