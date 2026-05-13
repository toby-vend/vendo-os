/**
 * StatTile — compact KPI tile (no sparkline). Used inside ChannelCard
 * stat grids and in the channel-tab topline grid (with `size="lg"`).
 *
 * `size="lg"` adds a sparkline-friendly area; the actual sparkline is
 * supplied by the parent via children for flexibility.
 */
import type { ReactNode } from 'react';
import { Delta } from './Delta';
import { fmt, type FormatKind } from '../lib/format';

interface StatTileProps {
  label: string;
  value: number | null | undefined;
  format?: FormatKind;
  prev?: number | null;
  inverse?: boolean;
  /** When true, renders in the large topline layout. */
  size?: 'sm' | 'lg';
  /** Optional inner content (sparkline, badge etc.) rendered below value. */
  children?: ReactNode;
}

export function StatTile({
  label,
  value,
  format = 'number',
  prev,
  inverse,
  size = 'sm',
  children,
}: StatTileProps) {
  const valueFmt = fmt.by(format);
  const cls = 'vr-stat-tile' + (size === 'lg' ? ' is-lg' : '');
  return (
    <div className={cls}>
      <div className="vr-stat-label">{label}</div>
      <div className={'vr-stat-value' + (size === 'lg' ? ' is-lg' : '')}>{valueFmt(value ?? null)}</div>
      {prev != null && value != null && (
        <Delta curr={value} prev={prev} inverse={inverse} mini />
      )}
      {children}
    </div>
  );
}
