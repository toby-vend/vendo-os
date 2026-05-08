# ClientDashboard Deploy Runbook

**Companion to:** `2026-05-08-clientdashboard-integration.md`
**Phase:** 0.1 — first deploy
**Repo:** `github.com/toby-vend/vendo-client-portal` (local at `/Users/Toby_1/ClientDashboard`)

This is the human checklist for getting ClientDashboard live before the bridge sync runs. Most steps require browser/account access I don't have — work through it on your end. Tick as you go.

---

## 0 · Prerequisites (10 min)

- [ ] Vercel account access
- [ ] Supabase account access (org for Vendo Digital, or personal account)
- [ ] Resend account (already in use for VendoOS — reuse the API key, fine)
- [ ] Google Cloud Console access (for OAuth client creds, Ads developer token)
- [ ] Meta for Developers access (for Meta App ID/Secret)
- [ ] Inngest account (free tier OK for now)
- [ ] DNS access for `vendodigital.co.uk`

---

## 1 · Provision Supabase project (15 min)

1. Create a new project. Name: `vendo-client-portal`. Region: `eu-west-2` (London) for latency.
2. Capture from Project Settings → API:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon (public) key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role (secret) key** → `SUPABASE_SERVICE_ROLE_KEY` (and `PORTAL_SUPABASE_SERVICE_ROLE_KEY` on VendoOS side)
3. From Project Settings → Database:
   - **Connection string (transaction pooler, port 6543)** → `DATABASE_URL` (used at migration time only)
4. Apply migrations. From `/Users/Toby_1/ClientDashboard`:
   ```bash
   npx supabase link --project-ref <project-ref>
   npx supabase db push
   ```
   Or apply each `supabase/migrations/*.sql` in order via the SQL editor (slower but visible). After Phase 1 commit lands, `00016_external_bridge.sql` will be the latest.
5. Storage: create a public bucket `lesson-files` (referenced by `00014_lesson_files_bucket.sql`).
6. Auth → Email Templates: tweak the "Magic Link" and "Invite User" subject lines to mention "Vendo Digital portal".
7. Auth → URL Configuration:
   - Site URL: `https://portal.vendodigital.co.uk`
   - Additional redirect URLs: `https://portal.vendodigital.co.uk/auth/callback`, `http://localhost:3000/auth/callback`

---

## 2 · OAuth credentials (30 min)

### Google (Ads + GA4 + Search Console — single client, multiple scopes)

1. Google Cloud Console → APIs & Services → Credentials.
2. Create OAuth client ID (Web application). Name: `Vendo Client Portal`.
3. Authorised redirect URIs:
   - `https://portal.vendodigital.co.uk/api/integrations/google/oauth/callback`
   - `http://localhost:3000/api/integrations/google/oauth/callback`
4. Capture client ID + secret → `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
5. Enable APIs: Google Ads API, Analytics Data API, Search Console API.
6. Google Ads API Center → request developer token (basic access first, apply for standard later) → `GOOGLE_ADS_DEVELOPER_TOKEN`.
7. OAuth consent screen → Scopes: add `adwords`, `analytics.readonly`, `webmasters.readonly`. Set app name + support email.

### Meta (Facebook)

1. developers.facebook.com → Create App → Type: Business.
2. Add product: Marketing API. Add product: Facebook Login for Business.
3. Settings → Basic: capture App ID + App Secret → `META_APP_ID`, `META_APP_SECRET`.
4. Facebook Login for Business → Settings → Valid OAuth Redirect URIs:
   - `https://portal.vendodigital.co.uk/api/integrations/meta/oauth/callback`
   - `http://localhost:3000/api/integrations/meta/oauth/callback`
5. App Review: request `ads_read`, `ads_management`, `business_management`. (Reviewers can take 1-2 weeks; start now.)

### GoHighLevel

API key-based, not OAuth. Each client supplies their own Location API key via the portal UI (no app-level credentials needed).

---

## 3 · Generate the token encryption key (1 min)

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

The output is `TOKEN_ENCRYPTION_KEY`. **Store securely — losing it bricks every encrypted token in `platform_connections`.**

---

## 4 · Inngest (5 min)

1. Sign in at app.inngest.com. Create environment `production`.
2. Capture **Event Key** + **Signing Key** → `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`.
3. After first Vercel deploy, point Inngest at `https://portal.vendodigital.co.uk/api/inngest`.

---

## 5 · Deploy to Vercel (10 min)

1. Vercel → New Project → Import `toby-vend/vendo-client-portal`.
2. Framework preset: Next.js (auto-detected). Root directory: `.` (default). Build command: default. Install: default.
3. Set all env vars (Production scope) — see `.env.example`. Don't forget `NEXT_PUBLIC_SITE_URL=https://portal.vendodigital.co.uk`.
4. Deploy. First build will likely take ~2 min.
5. Verify the deploy URL loads `/login`.

---

## 6 · Domain (5 min)

1. Vercel project → Settings → Domains → Add `portal.vendodigital.co.uk`.
2. Add the CNAME Vercel shows you to your DNS provider. Wait for SSL to provision (~5 min).
3. Re-verify env: `NEXT_PUBLIC_SITE_URL` = `https://portal.vendodigital.co.uk`. Redeploy if you had to change it.
4. Update Google + Meta OAuth redirect URIs to use the real domain (already done in §2 if you put both in).

---

## 7 · First user (5 min)

1. Supabase → Authentication → Users → Invite user → your email. Set a temp password or use magic link.
2. SQL editor:
   ```sql
   -- replace UUIDs with the real values
   INSERT INTO organisations (id, name, slug, vertical_id) VALUES
     ('00000000-0000-0000-0000-000000000001', 'Vendo Digital (internal)', 'vendo-internal',
      (SELECT id FROM verticals WHERE slug = 'other'));
   INSERT INTO user_profiles (id, organisation_id, role, display_name) VALUES
     ('<your-auth-user-uuid>', '00000000-0000-0000-0000-000000000001', 'super_admin', 'Toby');
   ```
3. Log in at `https://portal.vendodigital.co.uk/login`. You should land on the admin shell.

---

## 8 · Wire VendoOS to push clients (Phase 1)

Once §1–§7 are green, on the VendoOS side:

```bash
# in /Users/Toby_1/Vendo-OS
echo 'PORTAL_SUPABASE_URL=...' >> .env.local
echo 'PORTAL_SUPABASE_SERVICE_ROLE_KEY=...' >> .env.local

npm run sync:portal -- --dry-run    # confirm the 75 clients map cleanly
npm run sync:portal                  # live run: writes to organisations
```

Verify in Supabase: `SELECT count(*) FROM organisations;` should show 75 (or fewer if archived clients are filtered).

---

## Risks / things that go wrong

| Symptom | Cause | Fix |
|---|---|---|
| `supabase db push` fails on `00003_custom_access_token_hook.sql` | Auth hook needs project-level enable | Project Settings → Auth → enable Custom Access Token hook → point at the function |
| OAuth callback 400 with redirect mismatch | Redirect URI typo in console | Match exactly, including trailing slash absence |
| Inngest functions not firing | Production endpoint not registered | After deploy, hit `https://portal.vendodigital.co.uk/api/inngest` once; Inngest auto-syncs |
| Slug collision on bridge sync | Two clients with similar names | Sync script suffixes with `external_vendo_id`; review afterwards in `/admin/clients` |
| `lesson-files` storage bucket missing | Skipped step §1.5 | Create bucket; education uploads will 403 until then |

---

## What I cannot do for you

Everything in §1–§7. All of it needs you in front of the consoles. Once the deploy URL responds, ping me and I'll run the bridge sync.
