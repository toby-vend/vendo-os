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

interface AppProps {
  userName: string;
  userTier: 'admin' | 'staff';
}

export function App({ userName, userTier }: AppProps): React.JSX.Element {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const { messages, sendMessage, status, error, stop } = useChat({
    transport: new DefaultChatTransport({ api: '/api/agent/chat' }),
  });

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

  function handleSubmit(): void {
    const text = input.trim();
    if (!text || isStreaming) return;
    sendMessage({ text });
    setInput('');
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>): void {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <div className="atlas-chat">
      {!hasMessages && <Welcome userName={userName} userTier={userTier} />}

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
        className="atlas-input-bar"
        onSubmit={e => {
          e.preventDefault();
          handleSubmit();
        }}
      >
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            isStreaming
              ? 'Atlas is replying...'
              : 'Ask Atlas anything about clients, meetings, or campaigns'
          }
          disabled={isStreaming}
          rows={1}
        />
        {isStreaming ? (
          <button type="button" className="atlas-stop" onClick={() => stop()}>
            Stop
          </button>
        ) : (
          <button
            type="submit"
            className="atlas-send"
            disabled={!input.trim()}
            aria-label="Send"
          >
            <SendIcon />
          </button>
        )}
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------

function Welcome({ userName, userTier }: AppProps): React.JSX.Element {
  const helper =
    userTier === 'admin'
      ? 'Full agency access — clients, campaigns, meetings, decisions, financials.'
      : 'Client work and campaign performance. Ask me anything in scope.';
  return (
    <div className="atlas-welcome">
      <div className="atlas-welcome-mark">A</div>
      <h2>Hello {userName}.</h2>
      <p>{helper}</p>
      <ul className="atlas-suggestions">
        <li>"Which meetings did we have with Smile Dental last week?"</li>
        <li>"What's the latest CTR for Veltuff's Meta campaigns?"</li>
        <li>"Draft an Asana task for tomorrow's follow-up call."</li>
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
  // Text part
  if (part.type === 'text') {
    return <div className="atlas-text">{(part as { type: 'text'; text: string }).text}</div>;
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
  const stateLabel: Record<string, string> = {
    'input-streaming': 'preparing',
    'input-available': 'running',
    'output-available': 'done',
    'output-error': 'errored',
  };
  return (
    <details className={`atlas-tool atlas-tool-${state}`}>
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

function SendIcon(): React.JSX.Element {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M22 2L11 13" />
      <path d="M22 2l-7 20-4-9-9-4 20-7z" />
    </svg>
  );
}
