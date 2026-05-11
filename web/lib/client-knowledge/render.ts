/**
 * Render a ClientBriefing as Markdown — used by the agent tool result and any
 * future Slack/email surface. The Eta page does its own HTML rendering inside
 * the template, so we don't need a renderHtml here today.
 */
import type { ClientBriefing } from './types.js';

function fmtCurrency(n: number): string {
  if (!Number.isFinite(n)) return '£0';
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtNumber(n: number): string {
  return new Intl.NumberFormat('en-GB').format(n || 0);
}

function truncate(s: string | null | undefined, max = 280): string {
  if (!s) return '';
  return s.length > max ? s.slice(0, max - 1).trimEnd() + '…' : s;
}

export function renderBriefingMarkdown(b: ClientBriefing): string {
  const out: string[] = [];

  // Title
  const displayName = b.meta.displayName || b.meta.name;
  out.push(`# ${displayName}`);
  const tags: string[] = [];
  if (b.meta.vertical) tags.push(b.meta.vertical);
  if (b.meta.status) tags.push(b.meta.status);
  if (b.health) tags.push(`health ${b.health.score} (${b.health.tier})`);
  if (tags.length) out.push(`*${tags.join(' · ')}*`);
  out.push('');

  // Snapshot
  out.push('## Snapshot');
  out.push(`- Total invoiced: ${fmtCurrency(b.meta.totalInvoiced)}`);
  out.push(`- Outstanding: ${fmtCurrency(b.meta.outstanding)}`);
  out.push(`- Meetings to date: ${b.meta.meetingCount}`);
  if (b.meta.lastMeetingDate) out.push(`- Last meeting: ${fmtDate(b.meta.lastMeetingDate)}`);
  if (b.health) {
    out.push(`- Health: ${b.health.score}/100 (perf ${b.health.performance}, rel ${b.health.relationship}, fin ${b.health.financial})${b.health.trend ? `, trend ${b.health.trend}` : ''}`);
  }
  out.push('');

  // Notes (Phase B — empty until then)
  if (b.notes.length > 0) {
    out.push('## Notes & tribal knowledge');
    const byCategory = new Map<string, typeof b.notes>();
    for (const n of b.notes) {
      const arr = byCategory.get(n.category) || [];
      arr.push(n);
      byCategory.set(n.category, arr);
    }
    for (const [cat, ns] of byCategory) {
      out.push(`**${cat}**`);
      for (const n of ns) {
        out.push(`- ${truncate(n.body, 200)}${n.authorName ? `  — _${n.authorName}_` : ''}`);
      }
    }
    out.push('');
  }

  // Last meeting
  if (b.activity.lastMeeting) {
    out.push('## Last meeting');
    out.push(`**${b.activity.lastMeeting.title}** (${fmtDate(b.activity.lastMeeting.date)})`);
    out.push('');
  }

  // Recent meetings
  if (b.activity.recentMeetings.length > 0) {
    out.push('## Recent meetings');
    for (const m of b.activity.recentMeetings) {
      out.push(`- ${fmtDate(m.date)} — ${m.title}${m.category ? `  *(${m.category})*` : ''}`);
    }
    out.push('');
  }

  // Open action items
  if (b.activity.openActionItems.length > 0) {
    out.push(`## Open action items (${b.activity.openActionItems.length})`);
    for (const a of b.activity.openActionItems.slice(0, 10)) {
      out.push(`- ${a.description}${a.assignee ? `  — ${a.assignee}` : ''}${a.meetingDate ? `  *(${fmtDate(a.meetingDate)})*` : ''}`);
    }
    out.push('');
  }

  // Overdue Asana
  if (b.activity.overdueTasks.length > 0) {
    out.push(`## Overdue Asana tasks (${b.activity.overdueTasks.length})`);
    for (const t of b.activity.overdueTasks.slice(0, 10)) {
      out.push(`- **${t.name}** — due ${fmtDate(t.dueOn)}${t.assignee ? `  (${t.assignee})` : ''}`);
    }
    out.push('');
  }

  // Active Asana
  if (b.activity.openTasks.length > 0) {
    out.push(`## Active Asana tasks (${b.activity.openTasks.length})`);
    for (const t of b.activity.openTasks.slice(0, 10)) {
      out.push(`- ${t.name}${t.dueOn ? `  *due ${fmtDate(t.dueOn)}*` : ''}${t.assignee ? `  — ${t.assignee}` : ''}`);
    }
    out.push('');
  }

  // 30-day performance
  const perf = b.performance;
  if (perf.metaSpend > 0 || perf.gadsSpend > 0) {
    out.push('## 30-day ad performance');
    if (perf.metaSpend > 0) {
      out.push(`- Meta: ${fmtCurrency(perf.metaSpend)} spend, ${fmtNumber(perf.metaImpressions)} impressions, ${fmtNumber(perf.metaClicks)} clicks`);
    }
    if (perf.gadsSpend > 0) {
      out.push(`- Google Ads: ${fmtCurrency(perf.gadsSpend)} spend, ${fmtNumber(perf.gadsImpressions)} impressions, ${fmtNumber(perf.gadsClicks)} clicks`);
    }
    out.push('');
  }

  // Pipeline
  if (b.pipeline.openOpps.length > 0) {
    out.push(`## Open pipeline (${b.pipeline.openOpps.length} opps, ${fmtCurrency(b.pipeline.totalValueOpen)})`);
    for (const o of b.pipeline.openOpps.slice(0, 5)) {
      out.push(`- ${o.name || '(unnamed)'} — ${fmtCurrency(o.monetaryValue)}${o.stage ? `, ${o.stage}` : ''}${o.contact ? ` — ${o.contact}` : ''}`);
    }
    out.push('');
  }

  // Brand
  if (b.brand.hasGuidelines) {
    out.push(`## Brand guidelines`);
    out.push(`${b.brand.fileCount} indexed brand doc${b.brand.fileCount === 1 ? '' : 's'} available — see the brand hub for details.`);
    out.push('');
  }

  out.push(`---`);
  out.push(`*Generated ${fmtDate(b.generatedAt)} at ${new Date(b.generatedAt).toLocaleTimeString('en-GB')}*`);

  return out.join('\n');
}
