/**
 * Server-side renderer for the conversation chatroom view.
 *
 * Walks a ConversationNode tree and produces an HTML string of nested
 * speech bubbles. Each agent gets a stable colour. invokeAgent calls
 * render their child as an indented sub-conversation. Other tool calls
 * collapse to a compact one-liner with expandable input/output.
 *
 * Why server-side? The tree max depth is 3 and total bubbles per page
 * is bounded (≤200 runs × ≤32 steps each). Server-rendered keeps the
 * client lightweight, the view trivial, and avoids hydration churn.
 */
import { escape } from 'node:querystring';
import { colourForAgent } from './conversations.js';
import { formatGbp } from '../format/currency.js';
import type {
  ConversationNode,
  ConversationEvent,
  MessageEvent,
  ToolCallEvent,
} from './conversations.js';

/**
 * Render a full conversation tree to HTML. The caller wraps the result
 * in the page chrome.
 */
export function renderConversationHtml(root: ConversationNode): string {
  return renderRun(root, 0);
}

function renderRun(node: ConversationNode, depth: number): string {
  const agentColour = colourForAgent(node.run.agent);
  const eventsHtml = node.events.map(ev => renderEvent(ev, node.run.agent, depth)).join('');
  const errBlock = node.run.error
    ? `<div class="conv-run-error">${html(node.run.error)}</div>`
    : '';
  // Only show the run header if this is the root or there are no events
  // — sub-runs are introduced by their invokeAgent bubble already.
  const header = depth === 0
    ? `
      <div class="conv-run-header">
        <span class="conv-agent-pill" style="background:${agentColour}1F;color:${agentColour}">${html(node.run.agent)}</span>
        <span class="conv-run-meta">
          ${html(node.run.trigger)} · ${html(node.run.model)} · ${html(node.run.channel)}
          · started ${shortTime(node.run.started_at)}
          · ${tokenSummary(node.run)}
          · ${formatGbp(node.run.cost_usd, 4)}
          · ${html(node.run.status)}
        </span>
      </div>`
    : '';
  return `
    <section class="conv-run conv-depth-${depth}">
      ${header}
      ${eventsHtml}
      ${errBlock}
    </section>`;
}

function renderEvent(ev: ConversationEvent, agent: string, depth: number): string {
  if (ev.type === 'message') return renderMessage(ev, agent, depth);
  return renderToolCall(ev, agent, depth);
}

function renderMessage(ev: MessageEvent, agent: string, depth: number): string {
  if (!ev.text.trim()) return '';
  const colour = colourForAgent(agent);
  const label = ev.role === 'assistant' ? agent : ev.role.toUpperCase();
  return `
    <div class="conv-bubble conv-bubble-${ev.role}" data-step="${ev.step}">
      <div class="conv-bubble-header">
        <span class="conv-agent-pill" style="background:${colour}1F;color:${colour}">${html(label)}</span>
        <span class="conv-bubble-time">${shortTime(ev.createdAt)}</span>
        <span class="conv-bubble-step">step ${ev.step}</span>
        ${ev.finishReason ? `<span class="conv-bubble-finish">${html(ev.finishReason)}</span>` : ''}
      </div>
      <pre class="conv-bubble-text">${html(ev.text)}</pre>
    </div>`;
}

function renderToolCall(ev: ToolCallEvent, parentAgent: string, depth: number): string {
  if (ev.toolName === 'invokeAgent') return renderInvokeAgent(ev, parentAgent, depth);

  // Compact one-liner for ordinary tool calls.
  const argSummary = compactArgs(ev.input);
  const errStr = ev.error
    ? `<span class="conv-tool-error">err: ${html(ev.error.slice(0, 200))}</span>`
    : '';
  const dur = ev.durationMs !== null ? `${(ev.durationMs / 1000).toFixed(2)}s` : '—';
  return `
    <details class="conv-tool" data-step="${ev.step}" data-tool="${html(ev.toolName)}">
      <summary>
        <span class="conv-tool-label">tool</span>
        <code>${html(ev.toolName)}(${html(argSummary)})</code>
        <span class="conv-tool-meta">${dur}</span>
        ${errStr}
      </summary>
      <div class="conv-tool-body">
        <div class="conv-tool-section">
          <div class="conv-tool-section-label">input</div>
          <pre class="conv-tool-json">${html(safeJson(ev.input))}</pre>
        </div>
        <div class="conv-tool-section">
          <div class="conv-tool-section-label">output</div>
          <pre class="conv-tool-json">${html(safeJson(ev.output))}</pre>
        </div>
      </div>
    </details>`;
}

function renderInvokeAgent(ev: ToolCallEvent, parentAgent: string, depth: number): string {
  const target = (ev.input?.agentName as string) ?? '<unknown>';
  const prompt = (ev.input?.prompt as string) ?? '';
  const reply = (ev.output?.text as string) ?? '';
  const status = (ev.output?.status as string) ?? (ev.error ? 'errored' : 'unknown');
  const cost = formatGbp((ev.output?.costUsd as number | null | undefined) ?? null, 4);
  const dur = ev.durationMs !== null ? `${(ev.durationMs / 1000).toFixed(2)}s` : '—';

  const fromColour = colourForAgent(parentAgent);
  const toColour = colourForAgent(target);

  const errBlock = ev.error
    ? `<div class="conv-invoke-error">${html(ev.error)}</div>`
    : '';

  // Render the child conversation inline (recursive).
  const childBlock = ev.child
    ? `<div class="conv-child-block">${renderRun(ev.child, depth + 1)}</div>`
    : reply
      ? `<div class="conv-invoke-reply">
           <div class="conv-invoke-label">${html(target)} replied</div>
           <pre class="conv-bubble-text">${html(reply)}</pre>
         </div>`
      : '';

  return `
    <div class="conv-invoke" data-step="${ev.step}">
      <div class="conv-invoke-header">
        <span class="conv-agent-pill" style="background:${fromColour}1F;color:${fromColour}">${html(parentAgent)}</span>
        <span class="conv-invoke-arrow">→</span>
        <span class="conv-agent-pill" style="background:${toColour}1F;color:${toColour}">${html(target)}</span>
        <span class="conv-bubble-time">${shortTime(ev.createdAt)}</span>
        <span class="conv-tool-meta">${dur} · ${cost} · ${html(status)}</span>
      </div>
      <div class="conv-invoke-prompt">
        <div class="conv-invoke-label">asked</div>
        <pre class="conv-bubble-text">${html(prompt)}</pre>
      </div>
      ${childBlock}
      ${errBlock}
    </div>`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function html(s: string): string {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function shortTime(iso: string): string {
  if (!iso) return '';
  return iso.replace('T', ' ').slice(11, 19);
}

function tokenSummary(run: { input_tokens: number | null; output_tokens: number | null }): string {
  const i = run.input_tokens ?? 0;
  const o = run.output_tokens ?? 0;
  if (i === 0 && o === 0) return '— tok';
  return `${i.toLocaleString('en-GB')} in / ${o.toLocaleString('en-GB')} out`;
}

function safeJson(v: unknown): string {
  if (v == null) return '—';
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

function compactArgs(input: Record<string, unknown> | null): string {
  if (!input) return '';
  const entries = Object.entries(input).slice(0, 3);
  return entries
    .map(([k, v]) => {
      const vs = typeof v === 'string' ? v.slice(0, 40) : String(v ?? '').slice(0, 40);
      return `${k}: ${vs}`;
    })
    .join(', ');
}

// Silence unused import: querystring.escape is not actually needed any more.
void escape;
