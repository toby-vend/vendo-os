/**
 * ConversationDrawer — right-rail slide-in panel listing the user's
 * recent conversations for the current agent. Lazy-loads on open;
 * supports search (FTS5), archive / restore / delete, and "show
 * archived" toggle.
 *
 * Clicks navigate via location.assign — simpler than SPA routing and
 * makes back/forward + bookmarking work without extra state.
 */
import * as React from 'react';
import { useEffect, useState, useCallback } from 'react';

interface ConversationItem {
  id: string;
  agent: string;
  title: string | null;
  messageCount: number;
  lastMessageAt: string;
  archivedAt: string | null;
}

const AGENT_TO_URL_BASE: Record<string, string> = {
  'atlas': '/chat',
  'atlas-am': '/chat/am',
  'atlas-paid-social': '/chat/paid-social',
  'atlas-paid-search': '/chat/paid-search',
  'atlas-creative': '/chat/creative',
  'atlas-seo': '/chat/seo',
};

interface Props {
  open: boolean;
  onClose: () => void;
  agent: string;
  currentId: string | null;
}

export function ConversationDrawer({ open, onClose, agent, currentId }: Props): React.JSX.Element | null {
  const [items, setItems] = useState<ConversationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [filterByAgent, setFilterByAgent] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterByAgent) params.set('agent', agent);
      if (query.trim().length > 0) params.set('q', query.trim());
      if (showArchived) params.set('archived', '1');
      params.set('limit', '50');
      const res = await fetch('/api/agent/conversations?' + params.toString());
      if (!res.ok) throw new Error(`status ${res.status}`);
      const body = (await res.json()) as { items: ConversationItem[] };
      setItems(body.items);
    } catch (err) {
      console.error('[drawer] refresh failed:', err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [agent, query, showArchived, filterByAgent]);

  // Load on open + when filters change while open
  useEffect(() => {
    if (!open) return;
    refresh();
  }, [open, refresh]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  async function handleArchive(id: string, archived: boolean): Promise<void> {
    try {
      const res = await fetch('/api/agent/conversations/' + encodeURIComponent(id), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archive: archived }),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      await refresh();
    } catch (err) {
      console.error('[drawer] archive failed:', err);
    }
  }

  async function handleDelete(id: string): Promise<void> {
    if (!window.confirm('Permanently delete this conversation? This cannot be undone.')) return;
    try {
      const res = await fetch('/api/agent/conversations/' + encodeURIComponent(id), { method: 'DELETE' });
      if (!res.ok) throw new Error(`status ${res.status}`);
      await refresh();
    } catch (err) {
      console.error('[drawer] delete failed:', err);
    }
  }

  if (!open) return null;

  return (
    <div className="atlas-drawer-backdrop" onClick={onClose}>
      <aside className="atlas-drawer" onClick={(e) => e.stopPropagation()}>
        <header className="atlas-drawer-head">
          <h3>Conversations</h3>
          <button type="button" className="atlas-drawer-close" onClick={onClose} aria-label="Close">×</button>
        </header>

        <div className="atlas-drawer-controls">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') refresh(); }}
            placeholder="Search conversations…"
            className="atlas-drawer-search"
          />
          <label className="atlas-drawer-toggle">
            <input
              type="checkbox"
              checked={filterByAgent}
              onChange={(e) => setFilterByAgent(e.target.checked)}
            />
            <span>This agent only</span>
          </label>
          <label className="atlas-drawer-toggle">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
            <span>Show archived</span>
          </label>
        </div>

        {loading && <div className="atlas-drawer-state">Loading…</div>}
        {!loading && items.length === 0 && (
          <div className="atlas-drawer-state">
            {query.trim().length > 0
              ? `No matches for "${query}"`
              : showArchived
                ? 'No archived conversations.'
                : 'No conversations yet. Send a message to start one.'}
          </div>
        )}

        <ul className="atlas-drawer-list">
          {items.map((item) => {
            const href = (AGENT_TO_URL_BASE[item.agent] ?? '/chat') + '/c/' + item.id;
            const isCurrent = item.id === currentId;
            return (
              <li key={item.id} className={`atlas-drawer-item${isCurrent ? ' is-current' : ''}`}>
                <a href={href} className="atlas-drawer-item-main">
                  <div className="atlas-drawer-item-title">
                    {item.title ?? 'Untitled conversation'}
                  </div>
                  <div className="atlas-drawer-item-meta">
                    <span className="atlas-drawer-item-agent">{shortAgent(item.agent)}</span>
                    <span>·</span>
                    <span>{relativeTime(item.lastMessageAt)}</span>
                    <span>·</span>
                    <span>{item.messageCount} msg</span>
                  </div>
                </a>
                <div className="atlas-drawer-item-actions">
                  {item.archivedAt ? (
                    <>
                      <button type="button" onClick={() => handleArchive(item.id, false)} title="Restore">↺</button>
                      <button type="button" onClick={() => handleDelete(item.id)} title="Delete permanently" className="is-danger">×</button>
                    </>
                  ) : (
                    <button type="button" onClick={() => handleArchive(item.id, true)} title="Archive">⊠</button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </aside>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function relativeTime(ts: string): string {
  // ts is 'YYYY-MM-DD HH:MM:SS' from libSQL datetime('now'); parse as UTC.
  const d = new Date(ts.replace(' ', 'T') + 'Z');
  const diffMs = Date.now() - d.getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function shortAgent(agent: string): string {
  if (agent === 'atlas' || agent === 'atlas-staff') return 'Atlas';
  if (agent === 'atlas-am') return 'AM';
  if (agent === 'atlas-paid-social') return 'Paid Social';
  if (agent === 'atlas-paid-search') return 'Paid Search';
  if (agent === 'atlas-creative') return 'Creative';
  if (agent === 'atlas-seo') return 'SEO';
  return agent.replace(/^atlas-/, '');
}
