# ClientDashboard ↔ VendoOS Schema Delta

**Companion to:** `2026-05-08-clientdashboard-integration.md`
**Phase:** 0.2 — schema reconciliation walk
**Status:** Draft for review

---

## Scope

We only need to bridge entities that **both apps care about**: clients (→ organisations) and portal users (→ user_profiles + auth.users). Everything else stays where it is. VendoOS's financial / meeting / pipeline / Frame.io data does not need a Postgres home.

---

## 1. clients (Turso) → organisations (Postgres)

### VendoOS `clients` (Turso)
```sql
id INTEGER PRIMARY KEY AUTOINCREMENT
name TEXT UNIQUE NOT NULL
display_name TEXT
xero_contact_id TEXT
email TEXT
aliases TEXT                  -- JSON-encoded string array, used for matching
vertical TEXT                 -- free text: 'dental', 'home services', etc.
status TEXT DEFAULT 'active'
source TEXT DEFAULT 'xero'
total_invoiced REAL DEFAULT 0
outstanding REAL DEFAULT 0
first_invoice_date TEXT
last_invoice_date TEXT
first_meeting_date TEXT
last_meeting_date TEXT
meeting_count INTEGER DEFAULT 0
```

### ClientDashboard `organisations` (Postgres, Drizzle)
```ts
id           uuid PK defaultRandom()
name         text NOT NULL
slug         text UNIQUE NOT NULL
verticalId   uuid → verticals.id
archiveReason text
logoUrl      text
brandColour  text
createdAt    timestamptz
updatedAt    timestamptz
archivedAt   timestamptz
```

### Field mapping

| VendoOS column | → | ClientDashboard column | Notes |
|---|---|---|---|
| `id` | → | new `external_vendo_id INTEGER UNIQUE` | bridge key, **needs a Drizzle migration to add** |
| `name` | → | `name` | direct |
| `display_name` | → | `name` (preferred over `name` if non-null) | display_name was added later, take it as the human label |
| `aliases` | — | *not migrated* | VendoOS-only; used for Fathom/Asana matching. Doesn't apply once clients OAuth themselves. |
| `vertical` (text) | → | `verticalId` (uuid lookup) | needs a one-time `verticals` seed + a text→uuid resolver in the sync script |
| `status='active'` | → | `archivedAt = NULL` | |
| `status='archived'` (or anything ≠ active) | → | `archivedAt = now()` | one-way |
| `xero_contact_id` | — | *stays in VendoOS* | financial concern |
| `email` | → | `organisations.contact_email` (**new column**) OR `user_profiles.email` of the primary client_admin | I recommend a new `contact_email TEXT` column for portal-side AM display |
| `total_invoiced`, `outstanding`, invoice dates | — | *stays in VendoOS* | financial concern |
| `first_meeting_date`, `last_meeting_date`, `meeting_count` | — | *stays in VendoOS* | meeting concern |
| `source` | — | *not migrated* | VendoOS-internal provenance |
| — | ← | `slug` | derive from `name` via slugify; collision-suffix on conflict |
| — | ← | `logoUrl`, `brandColour` | null on import; admins fill in later |

### Migrations needed in ClientDashboard

```sql
-- m0016_external_bridge.sql
ALTER TABLE organisations
  ADD COLUMN external_vendo_id INTEGER UNIQUE,
  ADD COLUMN contact_email TEXT;

CREATE INDEX organisations_external_vendo_id_idx
  ON organisations (external_vendo_id);
```

Drizzle equivalent (in `src/lib/db/schema/organisations.ts`):
```ts
externalVendoId: integer('external_vendo_id').unique(),
contactEmail: text('contact_email'),
```

### Verticals seeding

Pull distinct values from VendoOS `clients.vertical`, hand-curate into a clean enum:

```sql
SELECT DISTINCT vertical FROM clients WHERE vertical IS NOT NULL ORDER BY 1;
```

Expected verticals (from current data layer + skills): `dental`, `home-services`, `e-commerce`, `professional-services`, `b2b-saas`, `health-wellness`, `food-beverage`, `other`. Seed these into `verticals` with stable slugs before any client sync runs.

### Out of scope for the bridge

These VendoOS tables stay in Turso, do not move:
- `client_source_mappings` (Meta/Asana/GHL → client_id, used by staff dashboards)
- `client_account_map` (similar, ad accounts)
- `meta_ad_accounts`, `gads_accounts`
- `xero_*`, `harvest_*`, `asana_*`, `ghl_*`, `frameio_*`
- `meetings`, `action_items`, `key_decisions`
- `client_health`, `client_profitability`

ClientDashboard's `platform_connections` is populated **fresh** via per-client OAuth. There's no migration of central account mappings into per-client connections.

---

## 2. portal_users (Turso) → user_profiles + auth.users (Supabase)

VendoOS doesn't actually have a `portal_users` table — portal users are stored in `users` with `role = 'client'` and joined to clients via `client_user_map`.

### VendoOS `users` + `client_user_map` (Turso)
```sql
users (
  id TEXT PRIMARY KEY,                  -- string uuid-ish
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'standard', -- 'admin' | 'standard' | 'client'
  must_change_password INTEGER DEFAULT 1,
  created_at TEXT, updated_at TEXT
)

client_user_map (
  user_id TEXT,
  client_id INTEGER,
  client_name TEXT
)
```

### ClientDashboard `user_profiles` + Supabase `auth.users`

`auth.users` is owned by Supabase Auth — created via the Admin API. `user_profiles` is the app-side extension keyed on `auth.users.id`.

```ts
user_profiles {
  id             uuid PK            -- = auth.users.id
  organisationId uuid NOT NULL
  role           enum               -- super_admin|admin|account_manager|client_admin|client_user
  displayName    text
  avatarUrl, phone, calendlyUrl, defaultSpecialisationTypeId
  deactivatedAt, createdAt, updatedAt
}
```

### Migration strategy (Phase 2 cut-over)

For each VendoOS row with `role = 'client'`:

1. **Resolve org:** lookup `organisations.id WHERE external_vendo_id = client_user_map.client_id`. If null → skip (client wasn't synced yet; surface error).
2. **Create Supabase auth user** via service-role Admin API:
   - email = users.email
   - email_confirm = true
   - send invite via magic link (no password migration — `password_hash` is bcrypt and Supabase uses scrypt; not portable)
3. **Insert user_profiles:**
   - id = new auth.users.id
   - organisation_id = resolved org
   - role = `client_admin` if first user for that org, else `client_user`
   - displayName = users.name
4. **Mark VendoOS row as migrated** by adding a `migrated_to_portal_at TEXT` column. Don't delete — keeps audit trail.

Password hashes are **not** migrated. Users get a "set up your portal account" email from Supabase on cut-over.

### Migration needed in VendoOS

```sql
ALTER TABLE users ADD COLUMN migrated_to_portal_at TEXT;
```

(Add via the existing pattern in `scripts/utils/db.ts` — try/catch ALTER TABLE.)

### Account managers / staff

Per the integration plan, AMs primarily use VendoOS. But ClientDashboard's portal **shows** the AM (name, avatar, calendly) on each client's dashboard. So AMs need user_profile rows too, even if they don't log in.

Approach for Phase 1:
- Manually seed Toby as `super_admin` in Supabase (one row).
- For each VendoOS staff row that owns clients (queried via `am_assignments` or hardcoded list of AM emails), create a Supabase auth user + user_profiles row with role `account_manager` and `deactivatedAt = now()` so they can't actively log in until promoted.
- Populate `am_assignments` rows (org_id × user_id × specialisation_type_id).

This is **not** part of the automated bridge sync — it's a one-time manual seed. AM additions/removals after Phase 1 happen in CD's `/admin/users` UI.

---

## 3. What the bridge sync script actually does

`scripts/sync/push-clients-to-portal.ts` (VendoOS side, Phase 1):

```
For each row in Turso `clients`:
  - Resolve verticalId from CD verticals (text → uuid)
  - Compute slug from name (slugify, suffix on collision)
  - Compute archivedAt from status
  - Upsert into Postgres `organisations` keyed on external_vendo_id:
      INSERT ... ON CONFLICT (external_vendo_id) DO UPDATE SET
        name, slug, vertical_id, contact_email, archived_at, updated_at = now()
```

Idempotent. Runs hourly via Vercel cron. Flags: `--dry-run`, `--client <id>`.

**Conflict resolution:** if two VendoOS clients share a slug (Acme Ltd, Acme Limited → both slugify to "acme"), suffix with `external_vendo_id`. Log to stderr; manual review in `/admin/clients` later.

**Deletes:** if a Turso client gets `status='archived'`, the sync sets `archivedAt = now()`. Hard deletes are not propagated — in CD, archived orgs stay queryable.

---

## 4. Decisions captured

| Decision | Choice |
|---|---|
| Where do aliases live? | Turso only. Per-client OAuth removes need for matching. |
| Where do financials live? | Turso only. CD doesn't need them. |
| Where does meeting data live? | Turso only. Possibly exposed to CD via signed VendoOS API later (Phase 4+). |
| Verticals as text or FK? | FK in CD. Seed up-front from distinct VendoOS values. |
| Status as enum or archivedAt? | `archivedAt` only (CD's existing pattern). Boolean active/inactive collapses cleanly. |
| Migrate password hashes? | No. bcrypt → scrypt is not portable. Magic-link invites at cut-over. |
| Where does AM data live? | CD `am_assignments`. Seeded manually Phase 1; ongoing changes in CD UI. |
| `email` on organisations? | New `contact_email` column on CD organisations. Optional. |

---

## 5. Open items (need confirmation before Phase 1 code)

1. **Vertical taxonomy** — confirm the canonical vertical list before seeding. The skills directory has `dental-content-planning` as a strong signal that "dental" is its own vertical; what else should be first-class?
2. **AM identification** — is there a single source of truth for "which staff member owns which client"? I see `client_user_map` is for portal users only. Where do AMs live? Probably in `users` with role='admin' and a manual mapping in someone's head, which means Phase 1 AM seeding is hand-rolled.
3. **Archived clients** — how many of the 75 are archived/inactive? Should they migrate to CD or be filtered out?
4. **Email collisions** — if the same email exists as both a VendoOS staff user and a portal client user (unusual but possible for testing), Supabase will reject the second create. Need a pre-flight de-dupe check.

---

## 6. Acceptance criteria for Phase 1 done

- [ ] `external_vendo_id` and `contact_email` columns exist on `organisations` (Drizzle migration committed in CD repo).
- [ ] Verticals seeded in CD (one row per vertical, stable slugs).
- [ ] `push-clients-to-portal.ts` runs in `--dry-run` against all 75 clients with zero errors.
- [ ] Live run produces 75 rows in `organisations` with correct `external_vendo_id`.
- [ ] Re-running the script changes 0 rows (idempotency).
- [ ] Status flip in Turso (`active` → `archived`) reflects within one cron tick.
