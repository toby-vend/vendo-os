/**
 * Client header lookup for the v2 dashboard payload.
 *
 * Used by both the Phase 0 shell builder and the Phase 1 orchestrator.
 * Returns a safe default when the client row is missing (deleted-client
 * edge case) so the report still renders.
 */
import { rows } from '../queries/base.js';
import type { ClientHeader } from './dashboard-types.js';

export async function fetchClientHeader(clientId: number): Promise<ClientHeader> {
  const found = await rows<{
    id: number;
    name: string;
    display_name: string | null;
    vertical: string | null;
  }>(
    `SELECT id, name, display_name, vertical
       FROM clients
      WHERE id = ?
      LIMIT 1`,
    [clientId],
  );
  const row = found[0];
  const name = (row?.display_name || row?.name || 'Unknown client').trim();
  return {
    id: clientId,
    name,
    // `clients` doesn't carry a location column today. Phase 4 wires
    // this from a richer source; for now the mockup tolerates empty.
    location: '',
    initials: deriveInitials(name),
    since: '',
    vertical: (row?.vertical || 'other').trim() || 'other',
  };
}

export function deriveInitials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
