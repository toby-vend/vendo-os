/**
 * PastedSnippetChip — the 112x112 tile rendered when the user pastes a
 * block of text larger than the PASTE_AS_SNIPPET_THRESHOLD. Keeps the
 * input clean while letting the user see + remove the inlined content
 * before sending.
 */
import * as React from 'react';
import type { PastedSnippet } from './attachments';
import { X } from './Icons';

interface Props {
  snippet: PastedSnippet;
  onRemove: (id: string) => void;
}

export function PastedSnippetChip({ snippet, onRemove }: Props): React.JSX.Element {
  return (
    <div className="atlas-chip atlas-chip-snippet">
      <div className="atlas-chip-snippet-preview">{snippet.content}</div>
      <div className="atlas-chip-snippet-foot">
        <span className="atlas-chip-snippet-badge">PASTED</span>
      </div>
      <button
        type="button"
        className="atlas-chip-remove"
        onClick={() => onRemove(snippet.id)}
        aria-label="Remove pasted snippet"
      >
        <X size={12} />
      </button>
    </div>
  );
}
