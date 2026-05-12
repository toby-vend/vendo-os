/**
 * Mount entry for the client report dashboard.
 *
 * Reads window.VENDO_REPORT (injected by the Eta shell) and renders the
 * App into #report-root. Mirrors web/client/agent-chat/main.tsx.
 */
import { createRoot } from 'react-dom/client';
import { App } from './App';
import type { DashboardPayload } from './types';

const ROOT_ID = 'report-root';

function boot(): void {
  const root = document.getElementById(ROOT_ID);
  if (!root) {
    console.warn(`[client-report] no #${ROOT_ID} on page`);
    return;
  }
  const payload: DashboardPayload | undefined = window.VENDO_REPORT;
  if (!payload) {
    root.textContent = 'No report payload found on window.';
    return;
  }
  createRoot(root).render(<App payload={payload} />);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
