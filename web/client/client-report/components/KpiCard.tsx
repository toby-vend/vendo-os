/**
 * KpiCard — large primary KPI tile with sparkline + delta chip.
 * Used in the Overview tab header row.
 */
import { Delta } from './Delta';
import { Sparkline } from './Sparkline';
import { fmt } from '../lib/format';
import type { Kpi } from '../types';

interface KpiCardProps {
  kpi: Kpi;
  accent?: string;
  comparePeriod?: string;
}

export function KpiCard({ kpi, accent, comparePeriod = 'vs prev 30d' }: KpiCardProps) {
  const valueFmt = fmt.by(kpi.format);
  return (
    <div className="vr-kpi-card">
      <div className="vr-kpi-label">{kpi.label}</div>
      <div className="vr-kpi-value">{valueFmt(kpi.value)}</div>
      <div className="vr-kpi-row">
        <Delta curr={kpi.value} prev={kpi.prev} inverse={kpi.inverse} />
        <span className="vr-kpi-compare">{comparePeriod}</span>
      </div>
      {kpi.series && kpi.series.length > 1 && (
        <div className="vr-kpi-spark">
          <Sparkline
            data={kpi.series}
            w={220}
            h={36}
            color={accent || 'var(--vr-accent)'}
          />
        </div>
      )}
    </div>
  );
}
