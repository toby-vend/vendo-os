/**
 * Tests for capability derivation in the agent permission gate.
 *
 * Run:
 *   node --env-file=.env.local --test --import tsx/esm web/lib/agents/permissions.test.ts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { hasCapability, capabilitiesForRoutes, CAPABILITIES } from './permissions.js';
import type { SessionUser } from '../auth.js';

function makeUser(overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    id: 'u1',
    email: 'staff@vendodigital.co.uk',
    name: 'Staff User',
    role: 'standard',
    mustChangePassword: false,
    channels: [],
    allowedRoutes: [],
    reportChannels: [],
    googleConnected: false,
    clientId: null,
    clientName: null,
    ...overrides,
  } as SessionUser;
}

describe('capabilitiesForRoutes', () => {
  it('maps the clients route to client read capabilities', () => {
    const caps = capabilitiesForRoutes(['clients']);
    assert.ok(caps.has(CAPABILITIES.CLIENTS_READ));
    assert.ok(caps.has(CAPABILITIES.HEALTH_READ));
    assert.ok(caps.has(CAPABILITIES.KNOWLEDGE_READ));
  });

  it('grants agents:invoke and calendar:read for any chat variant', () => {
    for (const slug of ['chat', 'chat-am', 'chat-paid-social']) {
      const caps = capabilitiesForRoutes([slug]);
      assert.ok(caps.has(CAPABILITIES.AGENTS_INVOKE), slug);
      assert.ok(caps.has(CAPABILITIES.CALENDAR_READ), slug);
    }
  });

  it('never derives write or admin-only capabilities', () => {
    const caps = capabilitiesForRoutes([
      'dashboard', 'clients', 'pipeline', 'dashboards', 'ads', 'action-items',
      'asana-tasks', 'tasks', 'video-production', 'deliverables', 'time-tracking',
      'capacity', 'meetings', 'skills', 'chat', 'chat-am', 'chat-paid-social',
      'chat-paid-search', 'chat-creative', 'chat-seo', 'briefs', 'growth',
      'drive', 'operations', 'reports',
    ]);
    for (const cap of [
      CAPABILITIES.ASANA_WRITE, CAPABILITIES.SLACK_WRITE, CAPABILITIES.PUSH_WRITE,
      CAPABILITIES.EMAIL_WRITE, CAPABILITIES.XERO_READ, CAPABILITIES.DECISIONS_READ,
    ]) {
      assert.ok(!caps.has(cap), `must not derive ${cap}`);
    }
  });
});

describe('hasCapability', () => {
  it('lets a standard user with the clients route search clients', () => {
    const user = makeUser({ allowedRoutes: ['chat', 'clients'] });
    assert.strictEqual(hasCapability(user, CAPABILITIES.CLIENTS_READ), true);
  });

  it('denies capabilities whose route the user does not hold', () => {
    const user = makeUser({ allowedRoutes: ['chat', 'clients'] });
    assert.strictEqual(hasCapability(user, CAPABILITIES.MEETINGS_READ), false);
    assert.strictEqual(hasCapability(user, CAPABILITIES.ASANA_WRITE), false);
  });

  it('still honours explicit capability slugs held via channels', () => {
    const user = makeUser({ channels: ['meetings:read'] });
    assert.strictEqual(hasCapability(user, CAPABILITIES.MEETINGS_READ), true);
  });

  it('admins pass every capability', () => {
    const user = makeUser({ role: 'admin' });
    assert.strictEqual(hasCapability(user, CAPABILITIES.XERO_READ), true);
    assert.strictEqual(hasCapability(user, CAPABILITIES.ASANA_WRITE), true);
  });
});
