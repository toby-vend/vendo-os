# Coding Conventions

**Analysis Date:** 2026-04-01

## Naming Patterns

**Files:**
- Routes: PascalCase with route name: `dashboardRoutes`, `meetingsRoutes` in `web/routes/`
- Utilities: camelCase with function name: `auth.ts`, `crypto.ts`, `queries.ts` in `web/lib/`
- Sync scripts: kebab-case: `sync-meetings.ts`, `process-meetings.ts` in `scripts/`
- Views: kebab-case with `.eta` extension: `dashboard.eta`, `login.eta` in `web/views/`

**Functions:**
- Named exports with camelCase: `hashPassword`, `createSessionToken`, `getDashboardStats`
- Route handlers wrapped in `FastifyPluginAsync` plugins: `export const dashboardRoutes: FastifyPluginAsync = async (app) => { }`
- Async functions explicitly marked: `async function syncMeetings()`, `export async function getDb()`
- Query helpers: verb-first pattern: `getDashboardStats`, `searchMeetings`, `getMeetingById`

**Variables:**
- Constants: UPPER_SNAKE_CASE: `SESSION_DURATION`, `BCRYPT_ROUNDS`, `ALGORITHM`, `MAX_RETRIES`
- Local variables: camelCase: `email`, `password`, `currentUser`, `meetingId`
- Private module variables: camelCase with leading underscore: `_db`, `_key`

**Types:**
- Interfaces: PascalCase ending in specific name: `SessionUser`, `SessionPayload`, `MeetingRow`, `ActionItemRow`
- Type imports: `type { FastifyPluginAsync }`, `type Client`
- Generic types: `Promise<T>`, `Record<string, string>`

## Code Style

**Formatting:**
- Language: TypeScript 5.6.0 with ES2022 target
- Module system: ES modules (import/export, `.js` file extensions in imports)
- No linter detected in project config — follow observed patterns
- No formatter detected — code is clean and consistently formatted

**Linting:**
- No `.eslintrc` or `.prettierrc` in project root
- TSConfig: `strict: true`, `esModuleInterop: true`, full type safety enabled
- Follow TypeScript strict mode throughout

## Import Organization

**Order:**
1. Built-in Node modules: `import crypto from 'crypto'`, `import { config } from 'dotenv'`
2. Third-party packages: `import Fastify from 'fastify'`, `import bcrypt from 'bcryptjs'`
3. Local project imports: `import { getDashboardStats } from '../lib/queries.js'`
4. Type imports: `import type { FastifyPluginAsync } from 'fastify'`

**Path Aliases:**
- No path aliases configured — use relative paths: `../lib/`, `../../lib/`
- Always include `.js` extension in ES module imports

**Pattern observed in web/routes:**
```typescript
import type { FastifyPluginAsync } from 'fastify';
import { getActionItems, getAssignees } from '../lib/queries.js';

export const actionItemsRoutes: FastifyPluginAsync = async (app) => {
  // route handlers
};
```

## Error Handling

**Patterns:**
- `try/catch` with early returns on error: `web/lib/auth.ts` uses `try { const json = JSON.parse(...) } catch { return null }`
- Error messages with context: `'Invalid OAuth state — please try connecting again'`, `'Password must be at least 8 characters'`
- HTTP responses: `reply.code(404).send('Meeting not found')`, `reply.code(403).send('Access denied')`
- Non-blocking async errors: `.catch(e => console.error('[notify] Invite notification error:', e))`
- Cryptography: throws explicit errors for missing env vars: `throw new Error('TOKEN_ENCRYPTION_KEY environment variable is required...')`

## Logging

**Framework:** Native `console.error()` and custom `log()`, `logError()` functions from `scripts/utils/db.ts`

**Patterns:**
- CLI logging: `log(category, message)` where category is `'SYNC'`, `'XERO'`, etc.
- Error logging: `logError(category, message)`
- Request logging: Fastify logger enabled (disabled on Vercel: `process.env.VERCEL ? false : true`)

**When to Log:**
- Sync operations: Log start, status, and error conditions
- Auth flow: Log failed authentication attempts and token operations
- External API calls: Log API errors and rate limit events
- Database operations: Log schema initialisation and sync completion

## Comments

**When to Comment:**
- Section dividers using format: `// --- Section Name ---` (see `web/lib/auth.ts`)
- Complex logic explanation: Comments before crypto operations, FTS query construction
- Inline clarifications: `// Check expiry`, `// Non-FTS path`, `// Flatten single-value arrays for backwards compat`

**JSDoc/TSDoc:**
- Used sparingly for public functions with side effects
- Example from `web/lib/google-tokens.ts`:
```typescript
/**
 * Get a valid Google access token for a user.
 * Returns null if the user hasn't connected their Google account.
 * Automatically refreshes expired tokens.
 */
export async function getGoogleAccessToken(userId: string): Promise<string | null>
```
- Function signatures with type annotations sufficient for most code
- No JSDoc required for query helpers or route handlers

## Function Design

**Size:** Functions are concise, typically 10–50 lines. Complex logic extracted to helpers.

**Parameters:**
- Named objects for multiple related params: `searchMeetings(opts: MeetingSearchOpts)`
- Limit optional params to 2–3; use object for more: `getPipelineOverview(pipelineId?: string)`

**Return Values:**
- Explicit null for missing data: `return result[0] ?? null`
- Tuple returns for parallel loads: `[stats, meetings, assignees, status]`
- Database helpers return typed rows: `Promise<MeetingRow[]>`, `Promise<DashboardStats>`

## Module Design

**Exports:**
- Named exports for functions and types: `export function hashPassword()`, `export interface SessionUser`
- Module-level exports for instances: `export { client as db }`
- Route plugins as default-like named export: `export const dashboardRoutes: FastifyPluginAsync`

**Barrel Files:**
- Not used — import directly from source files
- Example: `import { getDashboardStats } from '../lib/queries.js'` not from a `lib/index.ts`

**Module Structure in web/lib/queries.ts:**
- Section comments organise code: `// --- Dashboard ---`, `// --- Meetings ---`, `// --- Auth: Users ---`
- Interfaces grouped at section top
- Query functions grouped by domain
- Auth schema initialisation at end

---

*Convention analysis: 2026-04-01*
