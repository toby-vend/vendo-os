/**
 * SummaryTab — Phase 2/B2.
 *
 * Two sections, ported from /tmp/vendo-reporting-extract/tab-summary.jsx:
 *   1. AI summary card — headline (markdown) + Wins / Watch / Focus pillars
 *   2. Topline mirror  — repeats the Overview KPI row "at a glance"
 *
 * Headline markdown rendering: deliberately simple. We don't ship a
 * markdown library — instead we recognise `**bold**` and treat each
 * blank line as a paragraph break. That covers every shape
 * `generateReportInsights` produces in practice without adding a
 * dependency to the dashboard bundle.
 *
 * Action buttons (Export / Regenerate) are hidden in client mode.
 */
import { Fragment, type ReactNode } from 'react';
import { KpiCard } from '../components/KpiCard';
import { SectionHeader } from '../components/SectionHeader';
import { Placeholder } from '../components/Placeholder';
import type { DashboardPayload } from '../types';

export function SummaryTab({
  payload,
  accent,
}: {
  payload: DashboardPayload;
  accent: string;
}) {
  const { overview, aiSummary, client, mode } = payload;
  const isClient = mode === 'client';

  const confidenceClass = `vr-ai-confidence is-${aiSummary.confidence}`;
  const subLine = aiSummary.period
    ? `Generated ${aiSummary.period} · ${client.name}`
    : `${client.name}`;

  return (
    <div className="vr-tab-content">
      {/* ── AI summary card ─────────────────────────────────────────── */}
      <div className="vr-ai-summary">
        <div className="vr-ai-head">
          <div className="vr-ai-mark">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
              <path
                d="M10 2L11.5 7L16.5 8L12.5 11L13.8 16L10 13.5L6.2 16L7.5 11L3.5 8L8.5 7L10 2Z"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div>
            <div className="vr-ai-title">AI Performance Summary</div>
            <div className="vr-ai-sub">{subLine}</div>
          </div>
          {!isClient && (
            <div className="vr-ai-actions">
              <button type="button" className="vr-btn">
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden>
                  <path
                    d="M6.5 2V8M3.5 5L6.5 8L9.5 5"
                    stroke="currentColor"
                    strokeWidth="1.3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M2 11H11"
                    stroke="currentColor"
                    strokeWidth="1.3"
                    strokeLinecap="round"
                  />
                </svg>
                Export
              </button>
              <button type="button" className="vr-btn">
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden>
                  <path
                    d="M2 6.5C2 4 4 2 6.5 2C9 2 11 4 11 6.5C11 9 9 11 6.5 11M6.5 11L4.5 9M6.5 11L4.5 13"
                    stroke="currentColor"
                    strokeWidth="1.3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Regenerate
              </button>
            </div>
          )}
        </div>

        <div className="vr-ai-headline">
          {renderHeadline(aiSummary.headlineMd)}
        </div>

        <div className="vr-ai-pillars">
          <Pillar
            kind="good"
            tag="↑ Wins"
            items={aiSummary.wins}
            emptyLabel="No wins recorded yet"
          />
          <Pillar
            kind="watch"
            tag="! Watch"
            items={aiSummary.watch}
            emptyLabel="Nothing flagged to watch"
          />
          <Pillar
            kind="focus"
            tag="→ Focus next month"
            items={aiSummary.focus}
            emptyLabel="No focus items yet"
          />
        </div>

        <div className="vr-ai-meta">
          <span>
            Powered by Claude · Synthesised from Meta Ads, Google Ads &amp; Search
            Console
          </span>
          <span className={confidenceClass}>
            {confidenceLabel(aiSummary.confidence)} confidence · 30-day window
          </span>
        </div>
      </div>

      {/* ── Topline mirror ──────────────────────────────────────────── */}
      <SectionHeader
        title="At a glance"
        sub="Headline numbers — Last 30 days vs prior 30."
      />
      <div className="vr-kpi-grid">
        {overview.kpis.map((k) => (
          <KpiCard key={k.key} kpi={k} accent={accent} />
        ))}
      </div>
    </div>
  );
}

// ── Pillar (Wins / Watch / Focus) ──────────────────────────────────────

interface PillarProps {
  kind: 'good' | 'watch' | 'focus';
  tag: string;
  items: string[];
  emptyLabel: string;
}

function Pillar({ kind, tag, items, emptyLabel }: PillarProps) {
  return (
    <div className={`vr-ai-pillar is-${kind}`}>
      <div className="vr-ai-pillar-head">
        <span className="vr-ai-tag">{tag}</span>
      </div>
      {items.length === 0 ? (
        <Placeholder label={emptyLabel} height={80} />
      ) : (
        <ul className="vr-ai-list">
          {items.map((item, i) => (
            <li key={i}>{renderInline(item)}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Markdown helpers (intentionally tiny — no library) ─────────────────

/**
 * Render the AI-generated headline. Splits on double newlines into
 * paragraphs, and runs each paragraph through inline-bold handling.
 */
function renderHeadline(md: string): ReactNode {
  if (!md || !md.trim()) {
    return <p style={{ margin: 0, color: 'var(--vr-ink-3)' }}>No headline available yet.</p>;
  }
  const paragraphs = md.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  return paragraphs.map((p, i) => <p key={i}>{renderInline(p)}</p>);
}

/**
 * Inline renderer: turns `**bold**` runs into <strong>, preserves
 * single line breaks as <br/>. Everything else is plain text.
 *
 * Deliberately minimal so we don't pull in marked / remark — the
 * upstream insights generator already writes simple prose.
 */
function renderInline(text: string): ReactNode {
  const lines = text.split('\n');
  const nodes: ReactNode[] = [];
  lines.forEach((line, lineIdx) => {
    if (lineIdx > 0) nodes.push(<br key={`br-${lineIdx}`} />);
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    parts.forEach((part, partIdx) => {
      if (!part) return;
      const boldMatch = part.match(/^\*\*(.+)\*\*$/);
      if (boldMatch) {
        nodes.push(
          <strong key={`b-${lineIdx}-${partIdx}`}>{boldMatch[1]}</strong>,
        );
      } else {
        nodes.push(
          <Fragment key={`t-${lineIdx}-${partIdx}`}>{part}</Fragment>,
        );
      }
    });
  });
  return nodes;
}

function confidenceLabel(c: 'high' | 'medium' | 'low'): string {
  return c === 'high' ? 'High' : c === 'medium' ? 'Medium' : 'Low';
}
