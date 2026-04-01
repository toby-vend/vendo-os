# Testing Patterns

**Analysis Date:** 2026-04-01

## Test Framework

**Status:** No test framework detected

- No Jest, Vitest, Mocha, or testing library dependencies in `package.json`
- No test files (`.test.ts`, `.spec.ts`) in the codebase
- No test config files detected
- `tsconfig.json` does not exclude test directories

**Testing approach:** Currently manual testing only. Automated test suite not implemented.

## Test File Organization

**Not yet implemented.**

When tests are added, recommended structure:
- **Location:** Co-locate with source: `web/lib/__tests__/` or `web/lib/auth.test.ts` adjacent to `auth.ts`
- **Naming:** `{source}.test.ts` pattern (e.g., `queries.test.ts`, `auth.test.ts`)
- **Structure:**
```
web/
├── lib/
│   ├── auth.ts
│   ├── auth.test.ts
│   ├── queries.ts
│   └── queries.test.ts
└── routes/
    ├── dashboard.ts
    └── dashboard.test.ts
```

## Test Types

**Unit Tests (should add coverage for):**
- `web/lib/auth.ts`: Password hashing (`hashPassword`, `verifyPassword`), session token creation/verification (`createSessionToken`, `verifySessionToken`), cookie parsing
- `web/lib/crypto.ts`: Token encryption/decryption (`encryptToken`, `decryptToken`)
- `web/lib/queries.ts`: Database query helpers, filtering logic, pagination calculations
- `web/routes/auth.ts`: Login validation, password change flow, session cookie handling

**Integration Tests (should add coverage for):**
- Route handlers with database: meeting search, action item filtering, client details
- Auth flow: session token validation, permission checks, redirect logic
- External API integration: Google OAuth callback handling, Xero token refresh

**E2E Tests:**
- Not yet used — consider adding for critical flows (login, user creation, form submissions)

## Mocking

**What to Mock (when tests are added):**
- Database queries: Create fixtures for `getDb()` responses
- External APIs: Fathom, Meta, Xero, Google OAuth
- Environment variables: Use test `.env` file or setup
- File system: Mock `readFileSync`, `writeFileSync` for briefing files

**What NOT to Mock:**
- Core authentication functions: `hashPassword`, `verifyPassword` should use real bcrypt
- Session token signing/verification: Test with real HMAC operations
- Local database in dev: Use test database file, don't mock SQL execution

## Fixtures and Test Data

**Not yet implemented.**

When added, create fixtures in:
- Location: `scripts/test-fixtures/` or `web/__fixtures__/`
- Naming: `{domain}-fixtures.ts` (e.g., `users-fixtures.ts`, `meetings-fixtures.ts`)

**Examples to create:**
```typescript
// web/__fixtures__/users-fixtures.ts
export const testUser = {
  id: 'test-user-1',
  email: 'test@example.com',
  name: 'Test User',
  role: 'standard' as const,
};

// web/__fixtures__/meetings-fixtures.ts
export const testMeeting = {
  id: '12345',
  title: 'Test Meeting',
  date: '2026-04-01T10:00:00Z',
  category: null,
  client_name: 'Acme Corp',
  duration_seconds: 3600,
};
```

## Coverage

**Current requirement:** None enforced

**Recommendation when tests are added:**
- Target: 70%+ coverage for critical paths (auth, queries, crypto)
- Critical paths not to skip:
  - Password hashing and verification
  - Session token creation and validation
  - Permission checks in auth hook
  - Database query builders (FTS, filtering, pagination)
  - Token encryption/decryption

## Common Patterns (When Tests Are Added)

**Setup/Teardown:**
```typescript
// Before each test: set up fresh database or mocks
beforeEach(async () => {
  // Initialize test database or reset mocks
});

// After each test: clean up
afterEach(async () => {
  // Close database connection or reset mocks
});
```

**Async Testing Pattern:**
```typescript
// Fastify async route handler testing
it('should render dashboard with stats', async () => {
  const reply = { render: jest.fn() };
  await dashboardRoutes(app);
  // Assert reply.render called with correct data
});
```

**Error Testing Pattern:**
```typescript
// Session token verification with invalid data
it('should return null for invalid token', () => {
  const result = verifySessionToken('invalid.token');
  expect(result).toBeNull();
});

// Database error handling
it('should handle missing meeting gracefully', async () => {
  const result = await getMeetingById('nonexistent');
  expect(result).toBeNull();
});
```

## Code Areas With No Tests (Risk Assessment)

**High priority — critical auth/security:**
- `web/lib/auth.ts`: Session token lifecycle, permission checking
- `web/lib/crypto.ts`: Token encryption/decryption
- `web/routes/auth.ts`: Login flow, password change flow

**Medium priority — data access:**
- `web/lib/queries.ts`: All database queries (730+ lines)
- `web/routes/meetings.ts`: Search filtering logic
- `web/routes/action-items.ts`: Status filtering

**Medium priority — external integrations:**
- `web/routes/google-oauth.ts`: OAuth callback handling
- `web/lib/notifications.ts`: Slack and Gmail sending
- `scripts/sync/*.ts`: All data sync operations

**Lower priority — UI routes:**
- Dashboard, clients, pipeline, ads, briefs routes (render-only, no complex logic)

## Recommended First Test Suite

Start with `web/lib/auth.ts` (core security):

```typescript
// web/lib/auth.test.ts
describe('Password hashing', () => {
  it('should hash and verify passwords', () => {
    const password = 'test-password-123';
    const hash = hashPassword(password);
    expect(verifyPassword(password, hash)).toBe(true);
    expect(verifyPassword('wrong-password', hash)).toBe(false);
  });
});

describe('Session tokens', () => {
  it('should create and verify valid tokens', () => {
    const payload = { userId: 'user-1', role: 'admin', iat: Date.now() };
    const token = createSessionToken(payload);
    const verified = verifySessionToken(token);
    expect(verified?.userId).toBe('user-1');
  });

  it('should return null for invalid tokens', () => {
    expect(verifySessionToken('invalid')).toBeNull();
    expect(verifySessionToken('bad.token.format')).toBeNull();
  });

  it('should reject expired tokens', () => {
    const oldTime = Date.now() - (8 * 24 * 60 * 60 * 1000); // 8 days ago
    const payload = { userId: 'user-1', role: 'admin', iat: oldTime };
    const token = createSessionToken(payload);
    expect(verifySessionToken(token)).toBeNull();
  });
});

describe('Cookie parsing', () => {
  it('should parse cookie strings correctly', () => {
    const cookies = parseCookies('vendo_session=abc123; Path=/');
    expect(cookies.vendo_session).toBe('abc123');
  });
});
```

---

*Testing analysis: 2026-04-01*
