/**
 * FileChip — the 96x96 preview tile rendered in the row above the
 * textarea when the user has attached one or more files. Images get a
 * cover-fitted thumbnail; non-images get an icon + extension badge.
 */
import * as React from 'react';
import type { AttachedFile } from './attachments';
import { formatFileSize } from './attachments';
import { FileText, Loader2, X } from './Icons';

interface Props {
  file: AttachedFile;
  onRemove: (id: string) => void;
}

export function FileChip({ file, onRemove }: Props): React.JSX.Element {
  const isImage = file.kind === 'image' && file.preview;
  const ext = file.file.name.split('.').pop()?.toUpperCase() ?? 'FILE';
  const tooLarge = file.status === 'too-large';

  return (
    <div className={`atlas-chip atlas-chip-file${tooLarge ? ' is-too-large' : ''}`}>
      {isImage ? (
        <img src={file.preview!} alt={file.file.name} className="atlas-chip-img" />
      ) : (
        <div className="atlas-chip-doc">
          <div className="atlas-chip-doc-head">
            <span className="atlas-chip-doc-icon"><FileText size={16} /></span>
            <span className="atlas-chip-doc-ext">{ext}</span>
          </div>
          <div className="atlas-chip-doc-body">
            <div className="atlas-chip-doc-name" title={file.file.name}>{file.file.name}</div>
            <div className="atlas-chip-doc-size">{formatFileSize(file.file.size)}</div>
          </div>
        </div>
      )}

      {file.status === 'pending' && (
        <div className="atlas-chip-spinner">
          <span className="atlas-spin"><Loader2 size={20} /></span>
        </div>
      )}

      {tooLarge && (
        <div className="atlas-chip-too-large">Too large</div>
      )}

      <button
        type="button"
        className="atlas-chip-remove"
        onClick={() => onRemove(file.id)}
        aria-label={`Remove ${file.file.name}`}
      >
        <X size={12} />
      </button>
    </div>
  );
}
