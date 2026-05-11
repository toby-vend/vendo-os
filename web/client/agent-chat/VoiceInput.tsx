/**
 * VoiceInput — browser SpeechRecognition button.
 *
 * Mic icon button next to the paperclip. Click to start dictation;
 * transcribed text is appended to the textarea (via the onTranscript
 * callback). Click again to stop. The button only renders when the
 * browser supports SpeechRecognition (Chrome / Edge / Safari yes;
 * Firefox no).
 *
 * No backend, no API key. Stops cleanly if the tab loses focus.
 */
import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { Mic } from './Icons';

// Browsers expose SpeechRecognition under different names. We narrow the
// shape only enough to call start(), stop(), and read the result event.
interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  0: { transcript: string };
}

interface SpeechRecognitionEventLike extends Event {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResult>;
}

function getRecognitionCtor(): { new (): SpeechRecognitionLike } | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as Record<string, unknown>;
  const Ctor =
    (w.SpeechRecognition as { new (): SpeechRecognitionLike } | undefined) ??
    (w.webkitSpeechRecognition as { new (): SpeechRecognitionLike } | undefined);
  return Ctor ?? null;
}

interface Props {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}

export function VoiceInput({ onTranscript, disabled }: Props): React.JSX.Element | null {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  // Track what's been committed so we don't double-send interim chunks.
  const committedLengthRef = useRef(0);

  useEffect(() => {
    setSupported(getRecognitionCtor() !== null);
    return () => {
      try { recognitionRef.current?.abort(); } catch { /* */ }
    };
  }, []);

  if (!supported) return null;

  function start() {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;
    const r = new Ctor();
    r.continuous = true;
    r.interimResults = true;
    r.lang = navigator.language || 'en-GB';
    committedLengthRef.current = 0;

    r.addEventListener('result', (evt) => {
      const event = evt as SpeechRecognitionEventLike;
      let finalText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) finalText += result[0].transcript;
      }
      if (finalText) {
        const cleaned = finalText.trim();
        if (cleaned.length > 0) onTranscript((cleaned.endsWith('.') ? cleaned + ' ' : cleaned + ' '));
      }
    });

    r.addEventListener('end', () => {
      setListening(false);
      recognitionRef.current = null;
    });
    r.addEventListener('error', () => {
      setListening(false);
      recognitionRef.current = null;
    });

    try {
      r.start();
      recognitionRef.current = r;
      setListening(true);
    } catch {
      setListening(false);
    }
  }

  function stop() {
    try { recognitionRef.current?.stop(); } catch { /* */ }
    setListening(false);
  }

  return (
    <button
      type="button"
      className={`atlas-icon-btn${listening ? ' is-listening' : ''}`}
      onClick={() => (listening ? stop() : start())}
      disabled={disabled}
      aria-label={listening ? 'Stop dictation' : 'Start dictation'}
      title={listening ? 'Stop dictation' : 'Click to dictate'}
    >
      <Mic size={18} />
    </button>
  );
}
