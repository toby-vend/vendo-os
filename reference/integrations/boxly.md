# Boxly → Reporting Hub — Onboarding Runbook

How to connect a client's **Boxly** (boxly.ai, formerly EnquiryBox) so their leads
flow into the Vendo-OS reporting hub. Design rationale: `plans/2026-05-31-boxly-integration.md`.

## Why it works this way

Boxly has **no public API and no native outbound webhook**. The only reliable way
to get leads out is **Zapier's "New Lead" trigger** → **"Webhooks by Zapier"** POST
to our endpoint. The endpoint archives the raw event and normalises it into
`boxly_leads`, which the reporting hub reads.

## What's already built (live)

- `POST /api/boxly/webhook?token=…&client=<id>` — ingestion endpoint (`web/routes/boxly-webhook.ts`)
- `boxly_events` (raw archive) + `boxly_leads` (normalised) tables
- Channel attribution: parses `gclid`→google, `fbclid`→meta, UTMs, else the Boxly source label
- Dedup on Zapier retries via `UNIQUE(client_id, dedup_key)`

## Per-client setup (≈10 min)

1. **Pick the client's numeric `id`** from the `clients` table (the same id used elsewhere in Vendo-OS).
2. **Confirm `BOXLY_WEBHOOK_TOKEN` is set** in Vercel env (one shared token for all clients). If not:
   ```bash
   openssl rand -hex 32          # generate
   vercel env add BOXLY_WEBHOOK_TOKEN production   # paste value (never use `vercel env rm`)
   ```
3. **In the client's Zapier** (or our central Zapier with access to their Boxly):
   - **Trigger:** app **EnquiryBox** → **New Lead**. Select the Box and the intake Stage.
   - **Action:** **Webhooks by Zapier** → **POST** to:
     ```
     https://<vendo-os-host>/api/boxly/webhook?token=<BOXLY_WEBHOOK_TOKEN>&client=<client_id>
     ```
   - Payload type: **JSON**. Map every available lead field (name, email, phone, message,
     **Entry Point URL**, source label, box, stage, lead id, created time, custom fields).
     The Entry Point URL is essential — channel attribution depends on it.
4. **(Optional) conversion signal:** add a second Zap with the **New Lead** trigger filtered to
   the **Booked/Won stage** → same webhook. (Booked handling is a Phase-2 enhancement — see plan §4.)

## Verify leads come through correctly

1. Submit a **test enquiry** through the client's real Boxly intake (or move a dummy lead into the watched stage).
2. Within the Zapier polling window (≤15 min free / 1–2 min paid), check ingestion:
   ```bash
   npx tsx -e "import('./web/lib/queries/base.js').then(async m=>{const r=await m.db.execute('SELECT received_at,channel,contact_email,stage FROM boxly_leads WHERE client_id=<id> ORDER BY received_at DESC LIMIT 5');console.table(r.rows)})"
   ```
3. **Field check:** email/phone populated, `entry_point_url` present, channel sensible (gclid→google, fbclid→meta).
4. **Dedup check:** Zapier may retry — confirm one row per lead.
5. **Reconcile (first month):** compare Boxly's own in-app lead count for the period against
   `SELECT COUNT(*) FROM boxly_leads WHERE client_id=<id> AND created_at BETWEEN …`. They should match within polling lag.

## Known limits

- **No conversion tracking out of the box** — Zapier's only Boxly trigger is *New Lead*. Use the optional booked-stage Zap (above) as a workaround.
- **Field names vary per Boxly account.** The normaliser (`web/lib/boxly/payload.ts`) matches many key variants, but capture one real payload first and extend the candidate lists if a field is missing.
- **No raw UTM fields from Boxly** — only the Entry Point URL, which we parse ourselves.

## Troubleshooting

- **403** → token mismatch (`?token=` vs `BOXLY_WEBHOOK_TOKEN`).
- **400** → `?client=` missing or not a positive integer.
- **200 but no `boxly_leads` row** → check `boxly_events` (raw archive) for the payload and `processing_error`; the lead is never lost, replay from there.
