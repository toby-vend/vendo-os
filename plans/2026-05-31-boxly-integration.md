# Boxly → Reporting Hub Integration — Research & Plan

**Date:** 2026-05-31
**Goal:** Connect a client's Boxly to the Vendo-OS reporting hub so we can measure how effective their leads are, and ensure leads come through correctly.
**Status:** Research complete. **Phase 1 (ingestion pipeline) built + verified.** Phase 2 (report wiring + live client reconciliation) awaiting pilot client.
**Verdict on feasibility:** Doable. The blocker is Boxly itself, not us — it has no API and no native webhook. The only reliable export route is **Zapier → Webhooks by Zapier → our own webhook endpoint**. ~1 day of build.

---

## 1. What Boxly is (and why this matters)

- **Boxly** (`boxly.ai`) is an AI lead-management CRM, a rebrand of **EnquiryBox**. It is primarily used by dental practices. It is *not* a landing-page builder — it is a lead **inbox**: leads arrive from Facebook/Instagram lead ads, website forms (via email forwarding), WhatsApp, SMS, etc., land in "Boxes" (pipelines), and move through stages.
- Critically, **Boxly is a CRM in the same slot as GoHighLevel (GHL)**. Today the reporting hub measures leads from `ghl_opportunities`. A client on Boxly has *no lead data in Vendo-OS at all* — their reports can show ad spend but not leads, CPL, or conversion. Connecting Boxly fills that gap.

## 2. The hard constraint — how data can leave Boxly

Two independent research passes confirmed:

| Route | Available? | Notes |
|-------|-----------|-------|
| Public REST API | ❌ No | GetApp/Capterra/SoftwareAdvice all state "API: Not available". No developer portal, no API key system. |
| Native outbound webhook | ❌ No | No UI to POST leads to an external URL. ("Webform forwarding" is *email-based inbound*, not a webhook.) |
| **Zapier "New Lead" trigger** | ✅ Yes | The only reliable export. App is listed under the legacy name **EnquiryBox**. Polling trigger (~15 min on free Zapier, 1–2 min on paid). |
| Make / Integromat | ❌ No native module | Only via a Zapier relay — fragile, don't. |
| Undocumented "Lead Creation API" | ⚠️ Maybe | Help centre references a "Boxly Lead Creation API Integration Guide", but it's gated and appears to be *inbound-only* (push leads **into** Boxly). Worth a support email, but do not depend on it for v1. |

**Conclusion:** the integration is **Boxly → Zapier ("New Lead") → "Webhooks by Zapier" POST → `/api/boxly/webhook` in Vendo-OS**. This is a pseudo-webhook, but it's robust and matches a pattern we already run.

## 3. What a Boxly lead contains (the payload we'll receive)

Mapped from the Zapier trigger schema:

| Field | Use in reporting |
|-------|-----------------|
| First / Last / Full name | Identity, dedup display |
| Email | **Primary dedup key** |
| Phone | Secondary dedup key |
| Message | Enquiry body (context) |
| **Entry Point URL** | The page the form was submitted on — **source attribution lives here** |
| `gclid` / `fbclid` / UTM | Parsed by Boxly from the Entry Point URL; tells us Google vs Meta vs organic |
| Lead Source / channel label | Boxly's own auto-categorisation (e.g. "Facebook Ads") |
| Box / Stage | Which pipeline + stage |
| Labels | AI/manual tags (treatment type, location) |
| Custom fields | Per-account — dental examples: DOB, Gender, NHS/Private |

⚠️ **No discrete UTM fields** — Boxly only reliably exposes the Entry Point URL. We parse UTMs/gclid/fbclid from that URL ourselves.

## 4. How this measures "lead effectiveness"

The reporting hub already holds **ad spend** (Google Ads `gads_campaign_spend`, Meta `meta_insights`) per client. Once Boxly leads land with a source/Entry-Point URL we can compute, per channel:

- **Lead volume** (count of Boxly leads in period)
- **CPL** = channel spend ÷ channel leads
- **Source mix** (Meta vs Google vs organic vs direct)

This plugs straight into the existing `overview.ts` aggregator, which today counts leads from `ghl_opportunities` and buckets them by `classifyBookingSource()`. Boxly becomes an alternative lead source feeding the same KPIs.

⚠️ **Effectiveness limit:** Zapier's only Boxly trigger is **New Lead**. There is **no native "stage changed" / "booked" / "converted" trigger**. So out of the box we get *lead volume + CPL + source*, but **not conversion-to-booked** unless:
   - (a) the client also runs GHL for booking (then bookings come from GHL as today), or
   - (b) we add a second Zap that fires when a lead is moved into a "Booked"/"Won" stage *if* Boxly exposes a stage-filtered "New Lead" trigger per stage (the trigger does let you filter by Box **and Stage** — so a Zap watching the "Booked" stage can act as a conversion signal). **Recommended: set up two Zaps per client — one on the intake stage, one on the booked/won stage.**

---

## 5. Architecture (mirrors the Frame.io + Leadsie webhook pattern)

```
1. In the client's Boxly account → Zapier: "New Lead" trigger (Box = their main box, Stage = New)
2. Zapier action: "Webhooks by Zapier" → POST to
     https://<vendoos-host>/api/boxly/webhook?token=SECRET&client=<client_id>
3. /api/boxly/webhook validates token, archives raw payload to boxly_events
4. Normalises → upserts into boxly_leads (dedup on client_id + email/phone)
5. Parses Entry Point URL → channel (gclid→google, fbclid→meta, utm_*, else label)
6. overview.ts aggregator counts boxly_leads in range → KPIs + per-channel CPL
7. (Optional) second Zap on the "Booked" stage → boxly_leads.booked_at set → conversion rate
```

### Client identification

Each client's Boxly is a separate account with its own Zap, so the **client id is hardcoded into the webhook URL** per client (`?client=<id>`), exactly like Leadsie's `customUserId`. We also write a `client_source_mappings` row (`source='boxly'`, `external_id`=Boxly box id) for consistency and admin visibility.

### Auth

No HMAC from Zapier by default. Use the **Frame.io pattern verbatim**: a long random `BOXLY_WEBHOOK_TOKEN`, checked with `crypto.timingSafeEqual`, accepted via `?token=` or `Authorization: Bearer`. (Optionally add a per-client shared secret later.)

### Files to create

| File | Purpose |
|------|---------|
| `web/routes/boxly-webhook.ts` | Inbound handler — direct copy of `frameio-webhook.ts` structure: token check, `ensureSchema`, archive to `boxly_events`, normalise to `boxly_leads`. |
| `web/lib/boxly/normalise.ts` | Map raw Zapier payload → typed lead; parse Entry Point URL → channel; dedup key. |
| `web/lib/boxly/payload.ts` | TS types for the Zapier payload + validator. |
| `scripts/migrations/2026-05-31-boxly.ts` | Create `boxly_events` + `boxly_leads` (mirror migration boilerplate). |
| `reference/integrations/boxly.md` | Onboarding runbook for the team (how to build the Zap per client). |

### Files to edit

| File | Change |
|------|--------|
| `web/server.ts` | `app.register(boxlyWebhookRoutes, { prefix: '/api/boxly' })` + add `/api/boxly/webhook` to the auth-exemption list (line ~150). |
| `web/lib/reports/aggregators/overview.ts` | When a client has a `boxly` source mapping, count leads from `boxly_leads` (instead of / in addition to GHL) and bucket by channel for CPL. |
| `.env.example` + Vercel env | Add `BOXLY_WEBHOOK_TOKEN`. (Add via `vercel env add` only — never remove.) |
| `vercel.json` | No new build entry needed — webhooks are served by the catch-all `/api/index.ts` route, same as Frame.io. |

### New tables

```sql
CREATE TABLE IF NOT EXISTS boxly_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id TEXT UNIQUE,              -- Zapier zap_id / lead id if present
  client_id INTEGER,                 -- parsed from ?client=
  box TEXT,
  stage TEXT,
  payload TEXT NOT NULL,             -- full JSON for replay/debug
  headers TEXT NOT NULL,
  received_at TEXT NOT NULL,
  processing_status TEXT NOT NULL DEFAULT 'received',
  processing_error TEXT
);

CREATE TABLE IF NOT EXISTS boxly_leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id),
  boxly_lead_id TEXT,                -- if Boxly supplies a stable id
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  message TEXT,
  entry_point_url TEXT,
  channel TEXT,                      -- google | meta | organic | direct | other
  source_label TEXT,                 -- Boxly's own label, verbatim
  utm_source TEXT, utm_medium TEXT, utm_campaign TEXT,
  gclid TEXT, fbclid TEXT,
  box TEXT, stage TEXT,
  booked_at TEXT,                    -- set by the optional "booked stage" Zap
  created_at TEXT NOT NULL,          -- lead creation time
  received_at TEXT NOT NULL,         -- when we got it
  UNIQUE(client_id, contact_email, created_at)   -- dedup
);
CREATE INDEX IF NOT EXISTS idx_boxly_leads_client ON boxly_leads(client_id, created_at);
```

---

## 6. Ensuring leads come through correctly (verification plan)

This is the second half of the goal — getting it wired isn't enough; we must prove fidelity.

1. **Token-gated 200s only.** Reject bad tokens with 403; never silently accept. Log IP on failure (Frame.io pattern).
2. **Archive-first.** Every POST writes the raw payload to `boxly_events` *before* normalisation, so a parsing bug never loses a lead — we can replay from the archive.
3. **End-to-end test with a real lead:** submit a test enquiry through the client's actual Boxly intake (or move a dummy lead into the watched stage), confirm a `boxly_events` row appears within the Zapier polling window, and a normalised `boxly_leads` row with the right channel.
4. **Field-mapping validation:** assert email/phone/entry-point URL are populated; verify gclid→`channel='google'`, fbclid→`channel='meta'`, and a known UTM resolves correctly. Capture one real payload first and pin the field names (Zapier/EnquiryBox field labels vary by account custom-field config).
5. **Dedup check:** re-send the same payload (Zapier retries happen) and confirm only one `boxly_leads` row (UNIQUE constraint + INSERT OR IGNORE).
6. **Reconciliation:** for the first month, compare the Boxly in-app lead count (their reporting view) for the period against our `boxly_leads` count for that client. They should match within the Zapier polling lag. Flag drift in the report `flags` block (same mechanism as `bookingPipelineMissing`).
7. **Per-client confirmation before go-live:** ask the client to confirm their Boxly custom-field names and which Box/Stage represents a "real" new lead vs a booked one — don't assume.

---

## 7. Build steps (in order)

1. Capture one **real sample payload** — build the Zap on a test/dev Boxly box, point "Webhooks by Zapier" at a request-bin, submit a test lead, record the exact field names. *(Do this first; it de-risks everything.)*
2. Run migration → `boxly_events` + `boxly_leads`.
3. Build `web/routes/boxly-webhook.ts` (copy Frame.io handler, swap table + add normalise step).
4. Build `web/lib/boxly/normalise.ts` + `payload.ts` against the captured sample.
5. Register route + auth exemption in `web/server.ts`. Add `BOXLY_WEBHOOK_TOKEN` to Vercel env + `.env.local`.
6. Point the real Zap's webhook action at the deployed `/api/boxly/webhook?token=…&client=…`.
7. Wire `overview.ts` to read `boxly_leads` for Boxly-sourced clients; show lead volume + CPL by channel.
8. Run the verification plan (§6) end-to-end with the pilot client.
9. (Optional) add the "booked stage" Zap → conversion rate.
10. Document the per-client onboarding in `reference/integrations/boxly.md`.

**Estimate:** ~6–8 hours of build once the sample payload is in hand.

---

## 7a. Build status (2026-05-31)

**Phase 1 — ingestion pipeline: SHIPPED & VERIFIED.** Additive and isolated; touches no existing report path.

| Item | Status |
|------|--------|
| `scripts/migrations/2026-05-31-boxly.ts` (`boxly_events` + `boxly_leads`) | ✅ created, run on local DB |
| `web/lib/boxly/payload.ts` — tolerant normaliser + channel classifier | ✅ |
| `web/routes/boxly-webhook.ts` — token auth, archive, normalise, dedup | ✅ |
| `web/server.ts` — route registered + auth-exemption for `/api/boxly/webhook` | ✅ |
| `.env.example` — `BOXLY_WEBHOOK_TOKEN` documented | ✅ |
| `reference/integrations/boxly.md` — per-client onboarding runbook | ✅ |
| Unit tests (`payload.test.ts`, 13) + integration tests (`boxly-webhook.test.ts`, 6) | ✅ all pass |
| `tsc --noEmit` | ✅ 0 errors |

**Verified:** token auth (403), client-id validation (400), valid lead → 200 + archived + normalised with correct channel (gclid→google, fbclid→meta, UTM parsed), Zapier-retry dedup → 1 row.

**Phase 2 — remaining (needs pilot client):**
1. Run migration against **Turso** (prod): `npx tsx scripts/migrations/2026-05-31-boxly.ts` with Turso env, or `npm run db:push`.
2. Add `BOXLY_WEBHOOK_TOKEN` to Vercel prod env (`vercel env add`, never `rm`).
3. Capture one **real** Boxly payload from the pilot's Zap → extend `payload.ts` candidate key lists if any field is missed.
4. Wire `web/lib/reports/aggregators/overview.ts` to read `boxly_leads` for Boxly-sourced clients (lead volume + CPL by channel). **Deferred deliberately** — it edits the shared report path, so it should land with a live client to test against.
5. Live end-to-end + month-one reconciliation against Boxly's in-app count.

---

## 8. Open questions for Toby

1. **Which client is the pilot?** I need their Boxly account access (or their team to build the Zap) to capture the sample payload. Do they also use GHL, or is Boxly their *only* CRM?
2. **Zapier ownership** — do we run one central Vendo Zapier account with a Zap per client, or does each client run the Zap in their own Zapier? (Central = we control it, but needs access to each Boxly account. Paid Zapier needed for sub-15-min latency.)
3. **Conversion tracking** — is lead volume + CPL + source enough for v1, or do we want the booked-stage Zap from day one to show conversion rate?
4. **Custom fields** — does the pilot client capture treatment type / location as Boxly labels or custom fields? That decides whether we can do treatment-level CPL like we do for GHL clients.
5. Worth me sending Boxly support a quick email about that gated "Lead Creation API" in case a cleaner pull-based route exists? (Won't block v1.)
</content>
</invoke>
