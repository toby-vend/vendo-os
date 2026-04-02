# API Integration Research — Client CRM Performance System

> Researched 2026-04-02. Audited existing Vendo OS codebase for integration status.

## Status of the 6 Data Sources

**3 are fully integrated, 3 need building.**

| Source | Status | Key Files |
|--------|--------|-----------|
| Google Ads | Done | `scripts/sync/sync-google-ads.ts`, `scripts/auth/google-ads-auth.ts` |
| Meta Ads | Done | `scripts/sync/sync-meta-ads.ts`, `scripts/utils/meta-client.ts` |
| GoHighLevel | Done | `scripts/sync/sync-ghl.ts` |
| Google Analytics (GA4) | Not started | Nothing exists |
| Google Search Console | Not started | Nothing exists |
| Ahrefs | Not started | Nothing exists |

---

## Detailed Findings

### Google Ads — Complete (minor gap)

Missing conversion/ROAS metrics. The GAQL query at line 142-156 of `sync-google-ads.ts` only pulls `metrics.cost_micros`, `metrics.impressions`, `metrics.clicks`. Needs `metrics.conversions` and `metrics.conversions_value` added. ~30 min fix.

### Meta Ads — Complete

The most complete integration. Already pulls conversions, conversion_values, actions, and cost_per_action as JSON blobs. No sync changes needed.

**Gotcha:** `META_ACCESS_TOKEN` expires every ~60 days with no automated refresh.

### GoHighLevel (Client CRM) — Complete

Syncs all pipelines, stages, and opportunities. Lead status is implicit (determined by stage name). The reporting layer needs a stage-to-outcome mapping. No sync changes needed.

### Google Analytics (GA4) — Needs Building

Use the GA4 Data API (`analyticsdata.googleapis.com/v1beta`). Can reuse existing `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` credentials and the `.secrets/` token storage pattern. Needs `analytics.readonly` scope added to Google OAuth.

**Gotcha:** Data has ~48 hour latency.

### Google Search Console — Needs Building

Use the Search Console API (`searchconsole.googleapis.com/v1`). Same Google OAuth credentials apply, needs `webmasters.readonly` scope.

**Gotchas:**
- Data has a 3-day delay
- 16-month retention limit
- Max 25,000 rows per request (pagination needed)

### Ahrefs — Needs Building

Has a v3 REST API but requires Enterprise plan. Bearer token auth (simple). API is unit-based pricing, so needs budget management.

**If no API access:** alternatives are DataForSEO, manual CSV export, or Moz API.

---

## Recommended Build Order

1. **Phase 1 — Quick wins:** Add conversions to Google Ads sync, parse Meta conversion JSON in the UI
2. **Phase 2 — New Google integrations:** Build unified Google auth (combine GA4 + GSC + Ads scopes), then build `sync-ga4.ts` and `sync-gsc.ts`
3. **Phase 3 — SEO data:** Confirm Ahrefs API access, build `sync-ahrefs.ts` or evaluate alternatives
4. **Phase 4 — Reporting layer:** Build client-to-property mapping table and aggregation queries

---

## Reusable Infrastructure

The codebase has a well-established pattern that all new sync scripts should follow:

| Component | Path | Purpose |
|-----------|------|---------|
| DB helpers | `scripts/utils/db.ts` | `getDb`, `initSchema`, `saveDb`, `closeDb` |
| OAuth tokens | `.secrets/` | Token storage |
| Token refresh | `sync-google-ads.ts` | Refresh pattern to copy |
| Rate limiter | `scripts/utils/meta-client.ts` | Rate limit class |
| Orchestrator | `scripts/sync/run-all.ts` | Add new steps to `SYNC_STEPS` array |
| Remote replication | Push to Turso | After local sync |
