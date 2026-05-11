/**
 * Atlas chat surface — the React island that ships at /chat.
 *
 * Drives a single useChat() hook against /api/agent/chat, which streams
 * back UIMessage parts (text, reasoning, tool calls). The component
 * renders:
 *
 *   - A welcome screen on first load (replaced by the message list as
 *     soon as the user sends)
 *   - One bubble per message, parts laid out vertically
 *   - Tool calls as a collapsed grey card showing tool name + status;
 *     expandable to view input/output JSON. (Approval-card UI for
 *     write-tool dry-runs is a follow-up — for now drafts are visible
 *     in the trace and from /inbox once that page lands.)
 *   - A glassmorphism input bar at the bottom with auto-resize textarea
 *
 * Brand match: dark theme, Manrope (loaded by the page), Vendo green
 * #22C55E accent. No emoji, UK English copy.
 */
import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';
import { ConversationDrawer } from './ConversationDrawer';
import { FileChip } from './FileChip';
import { PastedSnippetChip } from './PastedSnippetChip';
import {
  type AttachedFile,
  type PastedSnippet,
  MAX_TOTAL_BYTES,
  PASTE_AS_SNIPPET_THRESHOLD,
  formatFileSize,
  newId,
  prepareAttachment,
  readAsDataUri,
  totalAttachedBytes,
} from './attachments';
import {
  ArrowUp,
  ChevronDown,
  Menu,
  Paperclip,
  Sparkles,
  Stop,
} from './Icons';

// Inline Markdown → safe HTML. Atlas emits **bold**, *italic*, bullet
// lists, and [text](url) links — we render those properly instead of
// leaking the raw syntax. `marked.parseInline` keeps the result inline
// (no <p> wrapper), then `sanitize-html` strips anything dangerous.
function renderMarkdown(text: string): string {
  const html = marked.parse(text, { async: false, breaks: true, gfm: true });
  return sanitizeHtml(html as string, {
    allowedTags: ['a', 'b', 'i', 'em', 'strong', 'code', 'pre', 'ul', 'ol', 'li', 'p', 'br', 'span'],
    allowedAttributes: { a: ['href', 'target', 'rel'] },
    transformTags: {
      a: (tagName, attribs) => ({
        tagName: 'a',
        attribs: { ...attribs, target: '_blank', rel: 'noopener noreferrer' },
      }),
    },
  });
}

interface AppProps {
  userName: string;
  userTier: 'admin' | 'staff';
  // Deep-linked specialist (set when the user landed on /chat/<slug>).
  // Defaults to 'atlas' for the generic /chat entry point.
  initialAgent?: string;
  // When set, the page is resuming an existing conversation: the client
  // fetches messages from /api/agent/conversations/<id> on mount and
  // hydrates useChat. When null, a fresh conversation starts on the first
  // send and the URL is rewritten via history.replaceState.
  initialConversationId?: string | null;
}

// Map agent name → URL base so we can rewrite the URL after the first
// user message lands in a fresh conversation.
const AGENT_TO_URL_BASE: Record<string, string> = {
  'atlas': '/chat',
  'atlas-am': '/chat/am',
  'atlas-paid-social': '/chat/paid-social',
  'atlas-paid-search': '/chat/paid-search',
  'atlas-creative': '/chat/creative',
  'atlas-seo': '/chat/seo',
};

// Specialist picker — admin only. The 'atlas' option falls through to the
// tier router server-side (admin → atlas, staff → atlas-staff). Each
// specialist label is the user-facing name; the value is the agent name
// the server resolves via resolveAgentByName.
const SPECIALISTS: { value: string; label: string; hint: string }[] = [
  { value: 'atlas', label: 'Atlas', hint: 'Generalist' },
  { value: 'atlas-am', label: 'AM', hint: 'Client relationships' },
  { value: 'atlas-paid-social', label: 'Paid Social', hint: 'Meta Ads' },
  { value: 'atlas-paid-search', label: 'Paid Search', hint: 'Google Ads' },
  { value: 'atlas-creative', label: 'Creative', hint: 'Video & Frame.io' },
  { value: 'atlas-seo', label: 'SEO', hint: 'Organic & GSC' },
];

export function App({
  userName,
  userTier,
  initialAgent = 'atlas',
  initialConversationId = null,
}: AppProps): React.JSX.Element {
  const [input, setInput] = useState('');
  const [selectedAgent, setSelectedAgent] = useState<string>(initialAgent);
  const [conversationId, setConversationId] = useState<string | null>(initialConversationId);
  const [files, setFiles] = useState<AttachedFile[]>([]);
  const [snippets, setSnippets] = useState<PastedSnippet[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  // Hydration state — while we're loading prior messages from the server
  // we want to suppress the welcome screen and avoid sending a turn.
  const [hydrationStatus, setHydrationStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>(
    initialConversationId ? 'loading' : 'ready',
  );
  const [initialMessages, setInitialMessages] = useState<UIMessage[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  // When the user landed on /chat/<slug>, the agent is fixed for this
  // session — the picker disappears and we surface a small badge instead.
  const isLocked = initialAgent !== 'atlas';
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  // Read selectedAgent + conversationId + attachments through refs so the
  // transport's body callback always sees the latest value without
  // re-creating the transport on every state change (which would break
  // useChat's stream).
  const selectedAgentRef = useRef(selectedAgent);
  selectedAgentRef.current = selectedAgent;
  const conversationIdRef = useRef(conversationId);
  conversationIdRef.current = conversationId;
  // Pending attachments + snippets for the next outgoing turn. Cleared
  // synchronously after the body callback has consumed them.
  const pendingAttachmentsRef = useRef<{
    attachments: { id: string; name: string; type: string; dataUri: string }[];
    pastedSnippets: { id: string; content: string }[];
  }>({ attachments: [], pastedSnippets: [] });
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const { messages, sendMessage, status, error, stop } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/agent/chat',
      body: () => {
        const { attachments, pastedSnippets } = pendingAttachmentsRef.current;
        // Consume — the next turn starts with an empty pending bag.
        pendingAttachmentsRef.current = { attachments: [], pastedSnippets: [] };
        return {
          agentName: selectedAgentRef.current,
          conversationId: conversationIdRef.current ?? undefined,
          attachments,
          pastedSnippets,
        };
      },
    }),
    messages: initialMessages,
  });

  // Hydrate from server on mount when resuming a conversation.
  useEffect(() => {
    if (!initialConversationId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/agent/conversations/' + encodeURIComponent(initialConversationId));
        if (!res.ok) throw new Error(`status ${res.status}`);
        const body = (await res.json()) as {
          messages: { role: 'user' | 'assistant' | 'system' | 'tool'; text: string }[];
        };
        if (cancelled) return;
        // Convert flat {role, text} into UIMessage shape useChat expects.
        // We only round-trip text parts for visible content; tool calls and
        // reasoning that lived in the original stream are not re-rendered.
        const restored: UIMessage[] = body.messages
          .filter((m) => m.role === 'user' || m.role === 'assistant')
          .map((m, i) => ({
            id: 'restored-' + i,
            role: m.role as 'user' | 'assistant',
            parts: [{ type: 'text', text: m.text }],
          })) as UIMessage[];
        setInitialMessages(restored);
        setHydrationStatus('ready');
      } catch (err) {
        console.error('[atlas-chat] hydration failed:', err);
        if (!cancelled) setHydrationStatus('error');
      }
    })();
    return () => { cancelled = true; };
  }, [initialConversationId]);

  // Rewrite the URL the first time a fresh conversation gets its id.
  // Once present, the URL is bookmarkable / shareable.
  useEffect(() => {
    if (!conversationId) return;
    const base = AGENT_TO_URL_BASE[selectedAgent] ?? '/chat';
    const target = base + '/c/' + conversationId;
    if (window.location.pathname !== target) {
      window.history.replaceState(null, '', target);
    }
  }, [conversationId, selectedAgent]);

  // Auto-scroll on new content
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, status]);

  // Auto-resize textarea
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  }, [input]);

  const isStreaming = status === 'streaming' || status === 'submitted';
  const hasMessages = messages.length > 0;

  // -------------------------------------------------------------------
  // File + paste handlers
  // -------------------------------------------------------------------

  function addFiles(list: FileList | File[]): void {
    const incoming = Array.from(list);
    const next = incoming.map(prepareAttachment);
    const merged = [...files, ...next];
    // Flag too-large items so the chip can show a warning, but keep them
    // on screen — the user removes them explicitly.
    const flagged = merged.map((f) =>
      f.file.size > MAX_TOTAL_BYTES ? { ...f, status: 'too-large' as const } : f,
    );
    setFiles(flagged);

    // Read data-URIs lazily for previewable items so send() can package
    // them without blocking.
    next.forEach((att) => {
      readAsDataUri(att.file).then(
        (dataUri) => {
          setFiles((prev) =>
            prev.map((f) => (f.id === att.id ? { ...f, dataUri, status: f.status === 'too-large' ? 'too-large' : 'ready' } : f)),
          );
        },
        () => {
          setFiles((prev) => prev.filter((f) => f.id !== att.id));
        },
      );
    });
  }

  function removeFile(id: string): void {
    setFiles((prev) => {
      const target = prev.find((f) => f.id === id);
      if (target?.preview) URL.revokeObjectURL(target.preview);
      return prev.filter((f) => f.id !== id);
    });
  }

  function removeSnippet(id: string): void {
    setSnippets((prev) => prev.filter((s) => s.id !== id));
  }

  function onAttachClick(): void {
    fileInputRef.current?.click();
  }

  function onFileInputChange(e: React.ChangeEvent<HTMLInputElement>): void {
    if (e.target.files && e.target.files.length > 0) addFiles(e.target.files);
    e.target.value = ''; // allow re-selecting the same file
  }

  function onDragOver(e: React.DragEvent): void {
    e.preventDefault();
    if (!isDragging) setIsDragging(true);
  }

  function onDragLeave(e: React.DragEvent): void {
    // Only clear when leaving the outer card — internal moves fire enter/leave
    if (e.currentTarget === e.target) setIsDragging(false);
  }

  function onDrop(e: React.DragEvent): void {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  }

  function onPaste(e: React.ClipboardEvent<HTMLTextAreaElement>): void {
    // 1. Pasted files (e.g. screenshot from clipboard) → addFiles
    const filesInClipboard: File[] = [];
    for (let i = 0; i < e.clipboardData.items.length; i++) {
      const item = e.clipboardData.items[i];
      if (item.kind === 'file') {
        const f = item.getAsFile();
        if (f) filesInClipboard.push(f);
      }
    }
    if (filesInClipboard.length > 0) {
      e.preventDefault();
      addFiles(filesInClipboard);
      return;
    }
    // 2. Large pasted text → snippet card; small paste falls through.
    const text = e.clipboardData.getData('text');
    if (text.length > PASTE_AS_SNIPPET_THRESHOLD) {
      e.preventDefault();
      setSnippets((prev) => [
        ...prev,
        { id: newId(), content: text, createdAt: new Date().toISOString() },
      ]);
    }
  }

  function handleSubmit(): void {
    const text = input.trim();
    const readyFiles = files.filter((f) => f.status === 'ready' && f.dataUri);
    const hasAttachments = readyFiles.length > 0 || snippets.length > 0;
    if (!text && !hasAttachments) return;
    if (isStreaming) return;

    // Final size check across the wire payload.
    if (totalAttachedBytes(readyFiles) > MAX_TOTAL_BYTES) {
      // Surface via the UI — chip shows is-too-large; user must remove.
      setFiles((prev) =>
        prev.map((f) => (f.file.size > MAX_TOTAL_BYTES ? { ...f, status: 'too-large' } : f)),
      );
      return;
    }

    ensureConversationId();

    // Stash attachments + snippets for the body callback to pick up.
    pendingAttachmentsRef.current = {
      attachments: readyFiles.map((f) => ({
        id: f.id,
        name: f.file.name,
        type: f.file.type || (f.kind === 'image' ? 'image/png' : 'application/octet-stream'),
        dataUri: f.dataUri ?? '',
      })),
      pastedSnippets: snippets.map((s) => ({ id: s.id, content: s.content })),
    };

    // Build the user message text — empty text is fine when only attachments.
    const messageText = text.length > 0 ? text : '(attachment)';
    sendMessage({ text: messageText });

    // Clear local UI state
    setInput('');
    setFiles((prev) => {
      // Revoke preview URLs to avoid leaks
      for (const f of prev) if (f.preview) URL.revokeObjectURL(f.preview);
      return [];
    });
    setSnippets([]);
    inputRef.current?.focus();
  }

  // Lazily create a stable conversation id on the FIRST send in a fresh
  // chat. After this, the transport body callback picks it up via the ref
  // and the useEffect above rewrites the URL.
  function ensureConversationId(): void {
    if (conversationIdRef.current) return;
    const id =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : 'conv-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
    conversationIdRef.current = id;
    setConversationId(id);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>): void {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  const activeLabel = SPECIALISTS.find((s) => s.value === selectedAgent)?.label ?? 'Atlas';

  // Hydration loading state — show a small placeholder while we fetch
  // the prior message history. Avoids flashing the welcome screen.
  if (hydrationStatus === 'loading') {
    return (
      <div className="atlas-chat">
        <div className="atlas-hydration"><TypingIndicator /> <span>Loading conversation…</span></div>
      </div>
    );
  }
  if (hydrationStatus === 'error') {
    return (
      <div className="atlas-chat">
        <div className="atlas-error">
          Conversation not found or you don't have access. <a href={AGENT_TO_URL_BASE[selectedAgent] ?? '/chat'}>Start a new chat</a>.
        </div>
      </div>
    );
  }

  return (
    <div className="atlas-chat">
      <div className="atlas-toolbar">
        <button
          type="button"
          className="atlas-toolbar-btn"
          onClick={() => setDrawerOpen(true)}
          title="Recent conversations"
        >
          <Menu size={16} />
          <span>Recent</span>
        </button>
        <a
          className="atlas-toolbar-btn"
          href={AGENT_TO_URL_BASE[selectedAgent] ?? '/chat'}
          title="Start a new conversation"
        >
          <span aria-hidden="true">+</span>
          <span>New chat</span>
        </a>
      </div>

      <ConversationDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        agent={selectedAgent}
        currentId={conversationId}
      />

      {!hasMessages && (
        <Welcome
          userName={userName}
          userTier={userTier}
          selectedAgent={selectedAgent}
          onSelectAgent={setSelectedAgent}
          showPicker={!isLocked}
          onSuggestion={(text) => {
            ensureConversationId();
            sendMessage({ text });
            inputRef.current?.focus();
          }}
        />
      )}

      {selectedAgent !== 'atlas' && (hasMessages || isLocked) && (
        <div
          className={`atlas-active-agent${isLocked ? ' is-locked' : ''}`}
          title={
            isLocked
              ? 'This specialist is pinned by URL. Visit /chat to use the picker.'
              : 'Specialist is locked for this conversation. Start a new conversation to switch.'
          }
        >
          Talking to <strong>{activeLabel}</strong>
        </div>
      )}

      {hasMessages && (
        <div className="atlas-messages">
          {messages.map(m => (
            <MessageRow key={m.id} message={m} />
          ))}
          {status === 'submitted' && <TypingIndicator />}
          <div ref={messagesEndRef} />
        </div>
      )}

      {error && (
        <div className="atlas-error">
          Something went wrong: {error.message}
        </div>
      )}

      <form
        className={`atlas-input-card${isDragging ? ' is-dragging' : ''}`}
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        {/* File / snippet chip row — only renders when something is attached */}
        {(files.length > 0 || snippets.length > 0) && (
          <div className="atlas-chip-row">
            {snippets.map((s) => (
              <PastedSnippetChip key={s.id} snippet={s} onRemove={removeSnippet} />
            ))}
            {files.map((f) => (
              <FileChip key={f.id} file={f} onRemove={removeFile} />
            ))}
          </div>
        )}

        <textarea
          ref={inputRef}
          className="atlas-input-textarea"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={onPaste}
          placeholder={isStreaming ? 'Atlas is replying…' : 'How can I help you today?'}
          disabled={isStreaming}
          rows={1}
        />

        <div className="atlas-input-actions">
          <div className="atlas-input-actions-left">
            <button
              type="button"
              className="atlas-icon-btn"
              onClick={onAttachClick}
              aria-label="Attach files"
              title="Attach files"
              disabled={isStreaming}
            >
              <Paperclip size={18} />
            </button>
          </div>

          <div className="atlas-input-actions-right">
            {!isLocked && (
              <div className="atlas-model-chip-wrap">
                <button
                  type="button"
                  className={`atlas-model-chip${modelMenuOpen ? ' is-open' : ''}`}
                  onClick={() => setModelMenuOpen((v) => !v)}
                  aria-haspopup="listbox"
                  aria-expanded={modelMenuOpen}
                >
                  <span>{activeLabel}</span>
                  <ChevronDown size={14} />
                </button>
                {modelMenuOpen && (
                  <ModelMenu
                    selected={selectedAgent}
                    onSelect={(value) => {
                      setSelectedAgent(value);
                      setModelMenuOpen(false);
                    }}
                    onClose={() => setModelMenuOpen(false)}
                    userTier={userTier}
                  />
                )}
              </div>
            )}

            {isStreaming ? (
              <button
                type="button"
                className="atlas-send-btn is-stop"
                onClick={() => stop()}
                aria-label="Stop generation"
                title="Stop"
              >
                <Stop size={16} />
              </button>
            ) : (
              <button
                type="submit"
                className="atlas-send-btn"
                disabled={!input.trim() && files.length === 0 && snippets.length === 0}
                aria-label="Send message"
                title="Send"
              >
                <ArrowUp size={18} />
              </button>
            )}
          </div>
        </div>

        {isDragging && (
          <div className="atlas-drop-overlay" aria-hidden="true">
            <Paperclip size={28} />
            <span>Drop files to attach</span>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={onFileInputChange}
          style={{ display: 'none' }}
          accept="image/*,application/pdf,text/*,.csv,.json,.md,.docx,.xlsx"
        />
      </form>

      {!isLocked && (
        <p className="atlas-disclaimer">Atlas can make mistakes — check important results.</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

interface WelcomeProps extends AppProps {
  onSuggestion: (text: string) => void;
  selectedAgent: string;
  onSelectAgent: (value: string) => void;
  // Hide the specialist picker when the URL deep-linked to a specialist;
  // the agent is fixed for the session in that case.
  showPicker: boolean;
}

const SUGGESTIONS = [
  'Which meetings did we have with Smile Dental last week?',
  "What's the latest CTR for Veltuff's Meta campaigns?",
  'Draft an Asana task for tomorrow’s follow-up call.',
];

function greetingForHour(h: number): string {
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function Welcome({ userName, userTier, onSuggestion, selectedAgent, onSelectAgent, showPicker }: WelcomeProps): React.JSX.Element {
  const greeting = greetingForHour(new Date().getHours());
  const helper =
    userTier === 'admin'
      ? 'Full agency access — clients, campaigns, meetings, decisions, financials.'
      : 'Client work and campaign performance. Ask me anything in scope.';
  return (
    <div className="atlas-welcome">
      <div className="atlas-welcome-mark"><Sparkles size={36} /></div>
      <h2 className="atlas-welcome-title">
        {greeting},{' '}
        <span className="atlas-welcome-name">
          {userName}
          <svg
            className="atlas-welcome-underline"
            viewBox="0 0 140 24"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path d="M6 16 Q 70 24, 134 14" stroke="currentColor" strokeWidth="3" strokeLinecap="round" fill="none" />
          </svg>
        </span>
      </h2>
      <p className="atlas-welcome-helper">{helper}</p>

      {showPicker && userTier === 'admin' && (
        <div className="atlas-specialist-picker">
          <div className="atlas-specialist-picker-label">Talk to</div>
          <div className="atlas-specialist-chips">
            {SPECIALISTS.map((s) => (
              <button
                key={s.value}
                type="button"
                className={`atlas-specialist-chip${selectedAgent === s.value ? ' is-selected' : ''}`}
                onClick={() => onSelectAgent(s.value)}
                title={s.hint}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <ul className="atlas-suggestions">
        {SUGGESTIONS.map((q) => (
          <li key={q}>
            <button
              type="button"
              className="atlas-suggestion-btn"
              onClick={() => onSuggestion(q)}
            >
              {q}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------

function MessageRow({ message }: { message: UIMessage }): React.JSX.Element {
  const role = message.role;
  return (
    <div className={`atlas-msg atlas-msg-${role}`}>
      {message.parts.map((p, i) => (
        <PartView key={i} part={p} />
      ))}
    </div>
  );
}

function PartView({ part }: { part: { type: string; [k: string]: unknown } }): React.JSX.Element | null {
  // Text part — render Markdown so **bold**, lists, and [links] don't
  // leak their raw syntax. Streaming text is still safe: each token
  // appended just reparses inline, which marked handles cleanly.
  if (part.type === 'text') {
    const text = (part as { type: 'text'; text: string }).text;
    return (
      <div
        className="atlas-text atlas-text-md"
        dangerouslySetInnerHTML={{ __html: renderMarkdown(text) }}
      />
    );
  }

  // Reasoning part — collapsed by default
  if (part.type === 'reasoning') {
    return (
      <details className="atlas-reasoning">
        <summary>thinking</summary>
        <pre>{(part as { type: 'reasoning'; text: string }).text}</pre>
      </details>
    );
  }

  // Tool call — naming pattern is `tool-${toolName}` per AI SDK 6
  if (typeof part.type === 'string' && part.type.startsWith('tool-')) {
    return <ToolCallView part={part as ToolPart} />;
  }

  // Step boundary — render nothing
  if (part.type === 'step-start') return null;

  return null;
}

// ---------------------------------------------------------------------------

interface ToolPart {
  type: string; // 'tool-searchMeetings' etc.
  state?: 'input-streaming' | 'input-available' | 'output-available' | 'output-error';
  input?: unknown;
  output?: unknown;
  errorText?: string;
}

function ToolCallView({ part }: { part: ToolPart }): React.JSX.Element {
  const toolName = part.type.replace(/^tool-/, '');
  const state = part.state ?? 'input-streaming';

  // Write tools surface a richer status: drafted vs executed, with an
  // outcome-aware label and inline action link. Read tools fall back to
  // the original neutral 'done' label.
  const isWriteTool = toolName.startsWith('draft');
  const output = (part.output ?? null) as null | {
    mode?: 'dry-run' | 'execute';
    asanaUrl?: string | null;
    posted?: boolean;
    sent?: boolean;
    error?: string | null;
  };
  const wroteForReal = isWriteTool && output?.mode === 'execute';
  const wroteAsDraft = isWriteTool && output?.mode === 'dry-run';

  const stateLabel: Record<string, string> = {
    'input-streaming': 'preparing',
    'input-available': 'running',
    'output-available': wroteForReal ? 'created' : wroteAsDraft ? 'drafted' : 'done',
    'output-error': 'errored',
  };
  const cardClass =
    state === 'output-available' && wroteAsDraft
      ? 'atlas-tool-drafted'
      : state === 'output-available' && wroteForReal
        ? 'atlas-tool-executed'
        : '';

  // Resource link — if the executed tool returned a URL, surface it.
  const resourceUrl = wroteForReal && output && typeof output.asanaUrl === 'string' ? output.asanaUrl : null;

  return (
    <div className={`atlas-tool-wrap atlas-tool-${state} ${cardClass}`}>
      {/* Outcome-aware affordance for write tools — rendered outside
          the collapsed details so the action link is always visible. */}
      {state === 'output-available' && wroteForReal && (
        <div className="atlas-tool-cta">
          <span className="atlas-tool-cta-icon">✓</span>
          <span>Action completed.</span>
          {resourceUrl && (
            <a href={resourceUrl} target="_blank" rel="noopener noreferrer" className="atlas-tool-cta-link">
              Open →
            </a>
          )}
        </div>
      )}
      {state === 'output-available' && wroteAsDraft && (
        <div className="atlas-tool-cta atlas-tool-cta-draft">
          <span className="atlas-tool-cta-icon">✏︎</span>
          <span>Drafted — awaiting approval.</span>
          <a href="/inbox" className="atlas-tool-cta-link">Review in inbox →</a>
        </div>
      )}

      <details className="atlas-tool" open={state === 'output-error'}>
        <summary>
          <span className="atlas-tool-dot" />
          <span className="atlas-tool-name">{toolName}</span>
          <span className="atlas-tool-state">{stateLabel[state] ?? state}</span>
        </summary>

        {part.input !== undefined && (
          <div className="atlas-tool-section">
            <div className="atlas-tool-label">input</div>
            <pre>{JSON.stringify(part.input, null, 2)}</pre>
          </div>
        )}
        {part.output !== undefined && (
          <div className="atlas-tool-section">
            <div className="atlas-tool-label">output</div>
            <pre>{JSON.stringify(part.output, null, 2)}</pre>
          </div>
        )}
        {part.errorText && (
          <div className="atlas-tool-section atlas-tool-error">
            {part.errorText}
          </div>
        )}
      </details>
    </div>
  );
}

// ---------------------------------------------------------------------------

function TypingIndicator(): React.JSX.Element {
  return (
    <div className="atlas-typing">
      <span></span>
      <span></span>
      <span></span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ModelMenu — the popover triggered by the in-input agent chip. Mirrors
// the welcome-screen specialist chip row but as a dropdown so users can
// switch agents mid-conversation. Selecting a specialist takes effect on
// the next turn (the system prompt is re-evaluated per request).
// ---------------------------------------------------------------------------

interface ModelMenuProps {
  selected: string;
  onSelect: (value: string) => void;
  onClose: () => void;
  userTier: 'admin' | 'staff';
}

function ModelMenu({ selected, onSelect, onClose, userTier }: ModelMenuProps): React.JSX.Element {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  // Non-admin users only see Atlas. Specialists are gated server-side via
  // resolveAgentByName, but hiding them in the picker keeps the UX clean.
  const visible = userTier === 'admin' ? SPECIALISTS : SPECIALISTS.filter((s) => s.value === 'atlas');

  return (
    <div ref={ref} className="atlas-model-menu" role="listbox">
      {visible.map((s) => (
        <button
          key={s.value}
          type="button"
          role="option"
          aria-selected={selected === s.value}
          className={`atlas-model-menu-item${selected === s.value ? ' is-selected' : ''}`}
          onClick={() => onSelect(s.value)}
        >
          <div className="atlas-model-menu-item-main">
            <span className="atlas-model-menu-label">{s.label}</span>
            <span className="atlas-model-menu-hint">{s.hint}</span>
          </div>
          {selected === s.value && <span className="atlas-model-menu-tick">✓</span>}
        </button>
      ))}
    </div>
  );
}
