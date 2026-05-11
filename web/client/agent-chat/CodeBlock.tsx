/**
 * CodeBlock — renders a fenced code block with a language tag, Copy button,
 * and Prism-highlighted body. Falls back to plain monospace if Prism isn't
 * loaded.
 *
 * The Prism import is lazy + best-effort so we never block render on it;
 * highlight() runs in a useEffect after mount.
 */
import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { Copy, Check } from './Icons';

// Lazy-loaded Prism. Keeping the import out of the top-level lets the
// bundle defer the parse of the language packs until first code block.
let prismPromise: Promise<typeof import('prismjs')> | null = null;
function loadPrism(): Promise<typeof import('prismjs')> {
  if (!prismPromise) {
    prismPromise = import('prismjs').then(async (Prism) => {
      // Component imports below pull in language definitions on demand.
      await Promise.all([
        import('prismjs/components/prism-typescript' as string),
        import('prismjs/components/prism-jsx' as string),
        import('prismjs/components/prism-tsx' as string),
        import('prismjs/components/prism-bash' as string),
        import('prismjs/components/prism-json' as string),
        import('prismjs/components/prism-sql' as string),
        import('prismjs/components/prism-python' as string),
        import('prismjs/components/prism-css' as string),
        import('prismjs/components/prism-markdown' as string),
      ]).catch(() => undefined);
      return Prism;
    });
  }
  return prismPromise;
}

interface Props {
  code: string;
  language: string | null;
}

export function CodeBlock({ code, language }: Props): React.JSX.Element {
  const [copied, setCopied] = useState(false);
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const codeRef = useRef<HTMLElement | null>(null);
  const lang = (language || '').toLowerCase().trim();

  useEffect(() => {
    let cancelled = false;
    loadPrism()
      .then((Prism) => {
        if (cancelled) return;
        const grammar = lang && Prism.languages[lang] ? Prism.languages[lang] : null;
        if (!grammar) return;
        try {
          setHighlighted(Prism.highlight(code, grammar, lang));
        } catch {
          /* fall back to plain */
        }
      })
      .catch(() => {
        /* Prism failed to load — render plain */
      });
    return () => { cancelled = true; };
  }, [code, lang]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* older browsers — no-op */
    }
  }

  return (
    <div className="atlas-code">
      <div className="atlas-code-head">
        <span className="atlas-code-lang">{lang || 'text'}</span>
        <button
          type="button"
          className="atlas-code-copy"
          onClick={handleCopy}
          aria-label={copied ? 'Copied' : 'Copy code'}
        >
          {copied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
        </button>
      </div>
      <pre className="atlas-code-body">
        {highlighted ? (
          <code
            ref={codeRef as React.RefObject<HTMLElement>}
            className={lang ? `language-${lang}` : undefined}
            dangerouslySetInnerHTML={{ __html: highlighted }}
          />
        ) : (
          <code className={lang ? `language-${lang}` : undefined}>{code}</code>
        )}
      </pre>
    </div>
  );
}
