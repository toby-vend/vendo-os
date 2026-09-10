# Compound: GTM build with Meta Advanced Matching

**Date:** 2026-09-10
**Container scope:** `lp.compoundapp.co.uk` (the three paid landing pages). The main Webflow site is a separate job.
**Pages:** `/employee/` (B2C), `/payroll-bureau/`, `/accountants/`

---

## 0. What is actually on the pages

I read the live pages and the plugin JavaScript before writing this, because the generic GTM recipe does not work here.

| Finding | Consequence |
|---|---|
| **No `<form>` elements anywhere.** The pages are WordPress running a custom plugin, `compound-landing-pages`. Each page is a JS state machine mounted on `#compound-lp`, driven by `data-action` attributes | GTM's **Form Submission trigger will never fire**. Neither will Meta's Automatic Advanced Matching, which scrapes form fields |
| **No dataLayer.** Zero references across all three pages | Every trigger below depends on adding one |
| **No tracking of any kind** currently. No GTM, no GA4, no pixel | Clean install, nothing to migrate or untangle |
| **No consent banner.** Zero cookie/CMP code | See blocker B below |
| **The conversion never changes the URL.** Success is a state flag (`step: 5`, `booked: true`, `done: true`) | No page-view or thank-you-URL trigger is possible. Must be event-based |
| **All three pages funnel through one function:** `CompoundLPCore.submit(page, data)` in `lp-core.js`, which POSTs to `https://lp.compoundapp.co.uk/wp-json/compound-lp/v1/submit` | This is the gift. **One hook covers all three pages and every conversion** |

### What each page captures

This decides what you can advanced-match on, and it is not the same across pages.

| Page | Fields in state | Usable for Advanced Matching |
|---|---|---|
| `/employee/` | `first_name`, `age`, `email` | `em`, `fn` |
| `/payroll-bureau/` | `name`, `email`, `bureau`, `phone` | `em`, `ph`, `fn`, `ln` — the strongest of the three |
| `/accountants/` | `practice`, `clients`, `software`, `slot` | **Nothing** |

---

## Two blockers to fix before this is worth building

**A. The accountants page captures no contact details at all.**
`confirmBooking` validates practice name, client band, software and slot, then submits. There is no email, no phone, no name. Two consequences: there is nothing to advanced-match on, and more importantly **you cannot contact the person who just booked a call**. That page is the destination for seven approved creatives (B2B-01 to B2B-07). Add an email field, ideally email plus phone, to the booking step. This is a bigger problem than the tracking.

**B. There is no consent mechanism on a UK financial services site.**
You are about to send hashed email addresses to Meta from a page with no cookie banner and no Consent Mode. Under UK GDPR and PECR that needs consent, not legitimate interest, and RiskSave is reviewing these pages right now. Get a CMP in place with Google Consent Mode v2 before the pixel goes live, and set GTM's consent settings on the Meta tags so they hold until `ad_user_data` and `ad_personalization` are granted.

---

## 1. The one code change

Everything below hangs off a single dataLayer push. Because every conversion on all three pages routes through `CompoundLPCore.submit`, you hook it once.

In `wp-content/plugins/compound-landing-pages/assets/js/lp-core.js`, inside `submit()`:

```js
/** Fire-and-forget POST of a form submission to the plugin's REST endpoint. */
function submit(page, data) {
  var cfg = window.CompoundLP || {};

  // One event id, shared by the browser pixel and the server-side CAPI call,
  // so Meta deduplicates the two rather than double-counting the lead.
  var eventId = 'lp-' + Date.now().toString(36) + '-' +
                Math.random().toString(36).slice(2, 10);

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    event: 'lp_lead',
    lp_page: page,
    event_id: eventId,
    lead: data
  });

  if (!cfg.submitUrl || typeof fetch !== 'function') { return; }
  try {
    fetch(cfg.submitUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ page: page, data: data, event_id: eventId }),
      keepalive: true,
      credentials: 'same-origin'
    }).catch(function () { /* the UI never depends on this */ });
  } catch (err) { /* ignore */ }
}
```

Add the GTM container snippet to the plugin's page template, in `<head>` and directly after `<body>`.

### If you cannot deploy the plugin today

Use this instead as a **Custom HTML tag on the Initialisation - All Pages trigger**. It wraps the function without touching WordPress, and the property setter handles GTM loading before `lp-core.js` does.

```html
<script>
(function () {
  window.dataLayer = window.dataLayer || [];
  function wrap(core) {
    if (!core || core.__gtmWrapped) { return core; }
    var original = core.submit;
    core.submit = function (page, data) {
      try {
        window.dataLayer.push({
          event: 'lp_lead',
          lp_page: page,
          event_id: 'lp-' + Date.now().toString(36) + '-' +
                    Math.random().toString(36).slice(2, 10),
          lead: data || {}
        });
      } catch (e) {}
      return original.apply(this, arguments);
    };
    core.__gtmWrapped = true;
    return core;
  }
  if (window.CompoundLPCore) { wrap(window.CompoundLPCore); return; }
  var held;
  Object.defineProperty(window, 'CompoundLPCore', {
    configurable: true,
    get: function () { return held; },
    set: function (v) { held = wrap(v); }
  });
})();
</script>
```

The trade-off: no shared `event_id` with the server, so you lose clean CAPI deduplication. Treat it as a stopgap.

---

## 2. Variables

### Constants
| Name | Value |
|---|---|
| `Const - Meta Pixel ID` | Compound's pixel ID |
| `Const - GA4 Measurement ID` | `G-XXXXXXXXXX` |

### Data Layer Variables
| Name | Data layer key |
|---|---|
| `DLV - lp_page` | `lp_page` |
| `DLV - event_id` | `event_id` |
| `DLV - lead` | `lead` (the whole object, version 2) |

One object variable rather than six scalars. Everything else derives from it.

### Custom JavaScript — normalisation

Meta hashes client-side, but it does **not** normalise for you. Trim and lowercase before you hand anything over or the match silently fails.

`JS - AM email`
```js
function () {
  var d = {{DLV - lead}} || {};
  var e = String(d.email || '').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : undefined;
}
```

`JS - AM first name`
```js
function () {
  var d = {{DLV - lead}} || {};
  var n = String(d.first_name || d.name || '').trim();
  if (!n) { return undefined; }
  return n.split(/\s+/)[0].toLowerCase().replace(/[^a-zà-ÿ-]/g, '') || undefined;
}
```

`JS - AM last name`
```js
function () {
  var d = {{DLV - lead}} || {};
  // The employee page only ever collects a first name, so there is no surname to send.
  if (d.first_name) { return undefined; }
  var parts = String(d.name || '').trim().split(/\s+/);
  if (parts.length < 2) { return undefined; }
  return parts.slice(1).join('').toLowerCase().replace(/[^a-zà-ÿ-]/g, '') || undefined;
}
```

`JS - AM phone` — Meta wants digits only, with country code, no leading zero or plus.
```js
function () {
  var d = {{DLV - lead}} || {};
  var p = String(d.phone || '').replace(/\D/g, '');
  if (!p) { return undefined; }
  if (p.indexOf('00') === 0) { p = p.slice(2); }
  if (p.indexOf('0') === 0) { p = '44' + p.slice(1); }
  else if (p.indexOf('44') !== 0) { p = '44' + p; }
  return p.length >= 11 ? p : undefined;
}
```

`JS - external_id` — a first-party cookie id. This is the quiet win: it is available on **every** page including `/accountants/`, it matches across sessions, and it costs nothing.
```js
function () {
  try {
    var m = document.cookie.match(/(?:^|;\s*)cmp_eid=([^;]+)/);
    if (m) { return m[1]; }
    var id = 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
    document.cookie = 'cmp_eid=' + id + ';path=/;max-age=63072000;SameSite=Lax;Secure';
    return id;
  } catch (e) { return undefined; }
}
```

---

## 3. Triggers

| Name | Type | Configuration |
|---|---|---|
| `Init - All Pages` | Initialisation | Built-in. Consent tag and the fallback wrapper only |
| `PV - All Pages` | Page View | All pages |
| `CE - lp_lead` | Custom Event | Event name `lp_lead` |

**One conversion trigger, not three.** Resist splitting by page. At £66/day the account cannot afford three separately optimised conversion events — you would be dividing an already thin signal. Fire one `Lead`, pass `lp_page` as a parameter, and segment in reporting. Build Meta custom conversions off the parameter later if a page earns its own optimisation.

---

## 4. Tags

### Tag 1 — Meta Pixel base
Custom HTML · trigger `Init - All Pages` · once per page · consent: require `ad_storage`, `ad_user_data`, `ad_personalization`

```html
<script>
!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
document,'script','https://connect.facebook.net/en_US/fbevents.js');

fbq('init', '{{Const - Meta Pixel ID}}', {
  external_id: {{JS - external_id}}
});
fbq('track', 'PageView');
</script>
```

At page load no email exists yet, so the base tag matches on `external_id` alone. That is expected.

### Tag 2 — Meta Pixel Lead, with advanced matching
Custom HTML · trigger `CE - lp_lead` · tag sequencing: fire Tag 1 first if it has not fired

```html
<script>
(function () {
  if (typeof fbq !== 'function') { return; }

  var am = {};
  var eid = {{JS - external_id}},
      em  = {{JS - AM email}},
      fn  = {{JS - AM first name}},
      ln  = {{JS - AM last name}},
      ph  = {{JS - AM phone}};

  if (eid) { am.external_id = eid; }
  if (em)  { am.em = em; }
  if (fn)  { am.fn = fn; }
  if (ln)  { am.ln = ln; }
  if (ph)  { am.ph = ph; }

  // Re-initialising the same pixel id refreshes the advanced matching payload.
  // The details only exist after the visitor has typed them, so this is the
  // only point at which they can be attached.
  fbq('init', '{{Const - Meta Pixel ID}}', am);

  fbq('track', 'Lead', {
    content_name: {{DLV - lp_page}},
    content_category: {{DLV - lp_page}} === 'employee' ? 'b2c' : 'b2b'
  }, { eventID: {{DLV - event_id}} });
})();
</script>
```

The pixel SHA-256 hashes `em`, `fn`, `ln` and `ph` in the browser. Raw values never leave the page. Do not pre-hash them yourself; you will double-hash and match nothing.

### Tag 3 — GA4 configuration
Google Tag · `{{Const - GA4 Measurement ID}}` · trigger `PV - All Pages`. Set `user_id` to `{{JS - external_id}}` for cross-session stitching.

### Tag 4 — GA4 `generate_lead`
GA4 Event · trigger `CE - lp_lead` · event name `generate_lead`

| Parameter | Value |
|---|---|
| `lp_page` | `{{DLV - lp_page}}` |
| `lead_type` | `{{DLV - lp_page}}` |

**Never send email, name or phone to GA4.** It breaches Google's terms and there is no upside. GA4 gets the shape of the lead; Meta gets the match keys.

### Tag 5 — Consent Mode v2 defaults
Custom HTML · trigger `Init - All Pages` · **fire before everything else**. Set all consent types to `denied` by default, then let the CMP update them. Without this, tags fire before the visitor has decided.

---

## 5. Conversions API — the second half of the job

Advanced matching in the browser is roughly half the available match quality. The Conversions API is in the proposal scope and the architecture here makes it unusually cheap to add, because `submit()` already POSTs the full payload plus the shared `event_id` to your own WordPress endpoint.

So the CAPI call belongs in the plugin's REST handler, server-side, where it should:

- Hash `email`, `phone` and name fields with SHA-256 before sending
- Pass `event_id` so Meta deduplicates against the browser `Lead`
- Pass the `_fbp` and `_fbc` cookies from the request, plus client IP and user agent — these do more for match quality than the hashed email does
- Send `action_source: "website"`

Because the browser tag and the server call share `event_id`, Meta counts one lead, not two.

---

## 6. Testing before you publish

1. **GTM Preview** on each of the three pages. Complete a real submission and confirm `lp_lead` appears with a populated `lead` object.
2. **Meta Pixel Helper** — confirm `Lead` fires once, and that the advanced matching parameters are attached and show as hashed.
3. **Events Manager → Test Events** — confirm the event arrives with the AM fields recognised.
4. **Check the accountants page specifically.** It should show `external_id` only. If it shows an email, someone has wired it wrong.
5. **Event Match Quality**, 24 to 48 hours after go-live. Expect `/payroll-bureau/` highest, `/employee/` mid, `/accountants/` poor until blocker A is fixed. Aim for 6.0+.

---

## 7. Order of work

1. Fix blocker A: add email and phone to the accountants booking step
2. Fix blocker B: CMP and Consent Mode v2
3. Add the dataLayer push and the GTM snippet to the plugin
4. Build the container: constants → variables → triggers → tags
5. Preview and test all three pages
6. Publish, then verify in Events Manager
7. Add server-side CAPI in the REST handler
8. Confirm leads land in the CRM with their UTMs — the campaign structure guide covers the naming that makes this readable
