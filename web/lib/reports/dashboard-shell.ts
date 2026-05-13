/**
 * Inline-script JSON helper for the dashboard Eta shell.
 *
 * The Phase 0 buildPhase0Payload helper moved to build-dashboard-data.ts
 * (full orchestrator). This module now only owns the script-tag-safe
 * stringifier used by both the admin and portal routes when injecting
 * the payload into window.VENDO_REPORT.
 */

// JS line separators (U+2028 / U+2029) are valid in JSON but fatal inside
// a <script> tag body. Built via String.fromCharCode so the source file
// never contains the literal codepoints (some tooling silently strips them).
const LINE_SEPARATOR = new RegExp(String.fromCharCode(0x2028), 'g');
const PARAGRAPH_SEPARATOR = new RegExp(String.fromCharCode(0x2029), 'g');

/**
 * JSON-stringify for inline injection into an Eta template. Escapes the
 * sequences that could break out of a <script> tag (per OWASP guidance).
 */
export function safeStringify(value: unknown): string {
  return JSON.stringify(value ?? null)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(LINE_SEPARATOR, '\\u2028')
    .replace(PARAGRAPH_SEPARATOR, '\\u2029');
}
