/**
 * MessageActions — hover overlay rendered beneath each message body.
 *
 * Assistant messages get Copy + Regenerate.
 * User messages get Copy only.
 * Buttons stay hidden until the parent `.atlas-msg` is hovered.
 */
import * as React from 'react';
import { useState } from 'react';
import { Copy, Check, RotateCcw } from './Icons';

interface Props {
  text: string;
  isAssistant: boolean;
  onRegenerate?: () => void;
}

export function MessageActions({ text, isAssistant, onRegenerate }: Props): React.JSX.Element {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // older browsers / insecure contexts — silently no-op
    }
  }

  return (
    <div className="atlas-msg-actions">
      <button
        type="button"
        className="atlas-msg-action-btn"
        onClick={handleCopy}
        aria-label={copied ? 'Copied' : 'Copy message'}
        title={copied ? 'Copied' : 'Copy'}
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </button>
      {isAssistant && onRegenerate && (
        <button
          type="button"
          className="atlas-msg-action-btn"
          onClick={onRegenerate}
          aria-label="Regenerate response"
          title="Regenerate"
        >
          <RotateCcw size={14} />
        </button>
      )}
    </div>
  );
}
