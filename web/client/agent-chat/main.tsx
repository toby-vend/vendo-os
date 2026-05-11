/**
 * Mount entry for the /chat React island.
 *
 * Looks for #agent-chat-root on the page and renders <App /> into it.
 * Reads any data-* attributes for per-user defaults (display name) and
 * passes them as props.
 */
import { createRoot } from 'react-dom/client';
import { App } from './App';

const ROOT_ID = 'agent-chat-root';

function boot(): void {
  const root = document.getElementById(ROOT_ID);
  if (!root) {
    console.warn(`[agent-chat] no #${ROOT_ID} on page`);
    return;
  }
  const userName = root.dataset.userName ?? 'there';
  const userTier = (root.dataset.userTier as 'admin' | 'staff') ?? 'staff';
  const initialAgent = root.dataset.initialAgent ?? 'atlas';
  const initialConversationId = root.dataset.initialConversationId || null;
  createRoot(root).render(
    <App
      userName={userName}
      userTier={userTier}
      initialAgent={initialAgent}
      initialConversationId={initialConversationId}
    />,
  );
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
