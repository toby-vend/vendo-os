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
import { CodeBlock } from './CodeBlock';
import { MessageActions } from './MessageActions';
import { VoiceInput } from './VoiceInput';
import { ArrowUp, Menu, Paperclip, Stop, X } from './Icons';
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

/**
 * Extract the concatenated text content from a UIMessage. Used by
 * MessageActions (Copy) and regenerate (re-send last user message).
 */
function extractTextFromMessage(message: UIMessage): string {
  const parts = (message as { parts?: Array<{ type?: string; text?: string }> }).parts;
  if (!Array.isArray(parts)) return '';
  return parts
    .filter((p) => p && p.type === 'text' && typeof p.text === 'string')
    .map((p) => p.text as string)
    .join('\n')
    .trim();
}

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
  // Hydration state — while we're loading prior messages from the server
  // we want to suppress the welcome screen and avoid sending a turn.
  const [hydrationStatus, setHydrationStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>(
    initialConversationId ? 'loading' : 'ready',
  );
  const [initialMessages, setInitialMessages] = useState<UIMessage[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [files, setFiles] = useState<AttachedFile[]>([]);
  const [snippets, setSnippets] = useState<PastedSnippet[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  // When the user landed on /chat/<slug>, the agent is fixed for this
  // session — the picker disappears and we surface a small badge instead.
  const isLocked = initialAgent !== 'atlas';
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  // Read selectedAgent + conversationId + attachments via refs so the
  // transport's body callback always sees the latest value without
  // re-creating the transport on every state change (which would break
  // useChat's stream).
  const selectedAgentRef = useRef(selectedAgent);
  selectedAgentRef.current = selectedAgent;
  const conversationIdRef = useRef(conversationId);
  conversationIdRef.current = conversationId;
  const pendingAttachmentsRef = useRef<{
    attachments: { id: string; name: string; type: string; dataUri: string }[];
    pastedSnippets: { id: string; content: string }[];
  }>({ attachments: [], pastedSnippets: [] });
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const { messages, sendMessage, status, error, stop, setMessages } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/agent/chat',
      body: () => {
        const { attachments, pastedSnippets } = pendingAttachmentsRef.current;
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
    const flagged = next.map((f) =>
      f.file.size > MAX_TOTAL_BYTES ? { ...f, status: 'too-large' as const } : f,
    );
    setFiles((prev) => [...prev, ...flagged]);

    flagged.forEach((att) => {
      if (att.status === 'too-large') return;
      readAsDataUri(att.file).then(
        (dataUri) => {
          setFiles((prev) =>
            prev.map((f) => (f.id === att.id ? { ...f, dataUri, status: 'ready' } : f)),
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
    e.target.value = '';
  }

  function onDragOver(e: React.DragEvent): void {
    e.preventDefault();
    if (!isDragging) setIsDragging(true);
  }
  function onDragLeave(e: React.DragEvent): void {
    if (e.currentTarget === e.target) setIsDragging(false);
  }
  function onDrop(e: React.DragEvent): void {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
  }

  function onPaste(e: React.ClipboardEvent<HTMLTextAreaElement>): void {
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

    if (totalAttachedBytes(readyFiles) > MAX_TOTAL_BYTES) {
      setFiles((prev) =>
        prev.map((f) => (f.file.size > MAX_TOTAL_BYTES ? { ...f, status: 'too-large' } : f)),
      );
      return;
    }

    ensureConversationId();

    pendingAttachmentsRef.current = {
      attachments: readyFiles.map((f) => ({
        id: f.id,
        name: f.file.name,
        type: f.file.type || (f.kind === 'image' ? 'image/png' : 'application/octet-stream'),
        dataUri: f.dataUri ?? '',
      })),
      pastedSnippets: snippets.map((s) => ({ id: s.id, content: s.content })),
    };

    const messageText = text.length > 0 ? text : '(attachment)';
    sendMessage({ text: messageText });

    setInput('');
    setFiles((prev) => {
      for (const f of prev) if (f.preview) URL.revokeObjectURL(f.preview);
      return [];
    });
    setSnippets([]);
    inputRef.current?.focus();
  }

  // Regenerate the last assistant reply for the active conversation.
  // Splices the assistant message out of useChat's state, then re-sends
  // the most recent user message — the server treats it as a normal turn
  // (an extra assistant reply lands in the DB but that's acceptable for
  // v1; the run row makes the lineage easy to follow).
  async function regenerateLastResponse(): Promise<void> {
    if (isStreaming) return;
    const lastUserIdx = (() => {
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === 'user') return i;
      }
      return -1;
    })();
    if (lastUserIdx === -1) return;
    const lastUser = messages[lastUserIdx];
    const lastUserText = extractTextFromMessage(lastUser);
    if (!lastUserText) return;

    setMessages(messages.slice(0, lastUserIdx + 1));
    sendMessage({ text: lastUserText });
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
          ☰ Recent
        </button>
        <a
          className="atlas-toolbar-btn"
          href={AGENT_TO_URL_BASE[selectedAgent] ?? '/chat'}
          title="Start a new conversation"
        >
          + New chat
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
          {messages.map((m, i) => (
            <MessageRow
              key={m.id}
              message={m}
              isLast={i === messages.length - 1 && !isStreaming}
              onRegenerate={regenerateLastResponse}
            />
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
        className={`atlas-input${isDragging ? ' is-dragging' : ''}`}
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        {(files.length > 0 || snippets.length > 0) && (
          <div className="atlas-input-attachments">
            {snippets.map((s) => (
              <span key={s.id} className="atlas-attach-pill atlas-attach-snippet">
                <span className="atlas-attach-pill-label">Pasted snippet</span>
                <span className="atlas-attach-pill-meta">{s.content.length} chars</span>
                <button
                  type="button"
                  className="atlas-attach-pill-remove"
                  onClick={() => removeSnippet(s.id)}
                  aria-label="Remove snippet"
                >
                  <X size={12} />
                </button>
              </span>
            ))}
            {files.map((f) => (
              <span
                key={f.id}
                className={`atlas-attach-pill${f.status === 'too-large' ? ' is-too-large' : ''}${f.status === 'pending' ? ' is-pending' : ''}`}
                title={f.file.name}
              >
                <span className="atlas-attach-pill-label">{f.file.name}</span>
                <span className="atlas-attach-pill-meta">
                  {f.status === 'too-large' ? 'too large' : formatFileSize(f.file.size)}
                </span>
                <button
                  type="button"
                  className="atlas-attach-pill-remove"
                  onClick={() => removeFile(f.id)}
                  aria-label={`Remove ${f.file.name}`}
                >
                  <X size={12} />
                </button>
              </span>
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
          placeholder={isStreaming ? 'Atlas is replying…' : 'Reply to Atlas…'}
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
              <Paperclip size={20} />
            </button>
            <VoiceInput
              disabled={isStreaming}
              onTranscript={(t) =>
                setInput((prev) => (prev.length === 0 ? t : prev + (prev.endsWith(' ') ? '' : ' ') + t))
              }
            />
          </div>
          <div className="atlas-input-actions-right">
            {isStreaming ? (
              <button
                type="button"
                className="atlas-send-btn is-stop"
                onClick={() => stop()}
                aria-label="Stop generation"
                title="Stop"
              >
                <Stop size={14} />
              </button>
            ) : (
              <button
                type="submit"
                className="atlas-send-btn"
                disabled={!input.trim() && files.length === 0 && snippets.length === 0}
                aria-label="Send message"
                title="Send"
              >
                <ArrowUp size={16} />
              </button>
            )}
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={onFileInputChange}
          style={{ display: 'none' }}
          accept="image/*,application/pdf,text/*,.csv,.json,.md,.docx,.xlsx"
        />
      </form>
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

function Welcome({ userName, userTier, onSuggestion, selectedAgent, onSelectAgent, showPicker }: WelcomeProps): React.JSX.Element {
  const helper =
    userTier === 'admin'
      ? 'Full agency access — clients, campaigns, meetings, decisions, financials.'
      : 'Client work and campaign performance. Ask me anything in scope.';
  return (
    <div className="atlas-welcome">
      <div className="atlas-welcome-mark">A</div>
      <h2>Hello {userName}.</h2>
      <p>{helper}</p>

      {showPicker && userTier === 'admin' && (
        <div className="atlas-specialist-picker">
          <div className="atlas-specialist-picker-label">Talk to:</div>
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
              &ldquo;{q}&rdquo;
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------

interface MessageRowProps {
  message: UIMessage;
  isLast: boolean;
  onRegenerate?: () => void;
}

function MessageRow({ message, isLast, onRegenerate }: MessageRowProps): React.JSX.Element {
  const role = message.role;
  const text = extractTextFromMessage(message);
  // Show actions for completed messages — never on the just-emitted streaming
  // tail of an assistant message (caller passes isLast=false for the in-flight
  // one indirectly via streaming state).
  return (
    <div className={`atlas-msg atlas-msg-${role}`}>
      {message.parts.map((p, i) => (
        <PartView key={i} part={p} />
      ))}
      {text.length > 0 && (
        <MessageActions
          text={text}
          isAssistant={role === 'assistant'}
          onRegenerate={role === 'assistant' && isLast && onRegenerate ? onRegenerate : undefined}
        />
      )}
    </div>
  );
}

/**
 * Split a markdown text into segments — either a fenced code block (with
 * optional language) or plain prose. Used by PartView to render code with
 * CodeBlock + leave the rest to the markdown renderer.
 */
function splitCodeBlocks(text: string): Array<{ kind: 'code'; lang: string | null; code: string } | { kind: 'prose'; text: string }> {
  const segments: Array<{ kind: 'code'; lang: string | null; code: string } | { kind: 'prose'; text: string }> = [];
  const fence = /```([a-zA-Z0-9_+-]*)\n([\s\S]*?)```/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = fence.exec(text)) !== null) {
    if (m.index > last) segments.push({ kind: 'prose', text: text.slice(last, m.index) });
    segments.push({ kind: 'code', lang: m[1] || null, code: m[2].replace(/\n$/, '') });
    last = fence.lastIndex;
  }
  if (last < text.length) segments.push({ kind: 'prose', text: text.slice(last) });
  return segments;
}

function PartView({ part }: { part: { type: string; [k: string]: unknown } }): React.JSX.Element | null {
  if (part.type === 'text') {
    const text = (part as { type: 'text'; text: string }).text;
    const segments = splitCodeBlocks(text);
    if (segments.length === 1 && segments[0].kind === 'prose') {
      return (
        <div
          className="atlas-text atlas-text-md"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(segments[0].text) }}
        />
      );
    }
    return (
      <div className="atlas-text-md">
        {segments.map((seg, i) =>
          seg.kind === 'code' ? (
            <CodeBlock key={i} code={seg.code} language={seg.lang} />
          ) : (
            <div
              key={i}
              className="atlas-text-md-segment"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(seg.text) }}
            />
          ),
        )}
      </div>
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

