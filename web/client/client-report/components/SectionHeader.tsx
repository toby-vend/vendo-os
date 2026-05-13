/**
 * SectionHeader — section title + sub + optional action slot (used for
 * the segmented 30d/90d toggle on the SEO tab, "Total spend" + "Total
 * revenue" totals on Overview's treatment table, etc).
 */
import type { ReactNode } from 'react';

interface SectionHeaderProps {
  title: string;
  sub?: string;
  action?: ReactNode;
}

export function SectionHeader({ title, sub, action }: SectionHeaderProps) {
  return (
    <div className="vr-section-head">
      <div>
        <h2 className="vr-section-title">{title}</h2>
        {sub && <p className="vr-section-sub">{sub}</p>}
      </div>
      {action && <div className="vr-section-action">{action}</div>}
    </div>
  );
}
