# Accountants landing page: add work email and phone

**Date:** 2026-09-10
**Page:** `https://lp.compoundapp.co.uk/accountants/`
**Files touched:** `wp-content/plugins/compound-landing-pages/assets/js/accountants.js` and the accountants page template

## Why

The booking flow currently collects practice name, client-count band, payroll software and a slot, then submits. It captures no way of contacting the person who just booked. That is a lead-handling problem first and a tracking problem second: it also leaves the page with nothing to advanced-match on, while it is the destination for seven approved creatives (B2B-01 to B2B-07).

## Read this before deploying

**The landing pages are with RiskSave awaiting sign-off right now** (Dan, 09/09/2026). Deploying this changes the page they are reviewing, including a line of promotional small print. Two sane options:

1. **Hold** until sign-off lands, then submit this as a small follow-up change.
2. **Tell Dan today** so RiskSave reviews the version that will actually go live, rather than approving one that is about to change.

Option 2 is usually faster overall, because the alternative is being approved twice. Either way this should not go out silently mid-review.

## What changes

### 1. `assets/js/accountants.js`

Replace the file with `accountants.js` from this folder. The changes, all additive:

- `state` gains `email: ''` and `phone: ''`
- `vals` gains `email`, `onEmail`, `phone`, `onPhone`, matching the existing `practice` / `onPractice` pattern
- `confirmBooking` validates the new fields before the existing band, software and slot checks
- The `L.submit` payload gains `email` and `phone`

Validation follows the sibling payroll bureau page: **email required**, using the same regex and the same error string, **phone optional** and only checked when something has been typed. That keeps the two B2B forms consistent and avoids adding friction to a form that already asks for four answers.

### 2. Page template markup

Insert the two field blocks from `booking-fields.html` immediately after the Practice name field, inside `<div data-if="notBooked">`. Styling is copied verbatim from the existing input, so they will look identical.

Then replace the small print under the Confirm the call button, also in `booking-fields.html`. The current line says "These three answers", which stops being true, and it does not say that Compound will contact you. The replacement mirrors wording already approved on the payroll bureau page.

## Tracking follow-on

Once this is live the accountants page moves from `external_id` only to `em`, and `ph` where given, which is the difference between a poor and a decent Event Match Quality score. No GTM change is needed: `CompoundLPCore.submit` already carries the whole payload, so the variables in the GTM guide pick the new fields up automatically.

## Not done, worth deciding

The page still collects no **contact name**. Adding one would give Meta `fn` and `ln` as well, and would let the sales follow-up open with a name rather than a practice. It is a third field on a form that will now have three inputs plus three choices, so it is a conversion trade rather than an obvious win. Say the word and I will add it the same way.

Also left alone deliberately: the risk warning on this page. RiskSave asked for a specific addition next to the fund manager mentions, which is a separate change, and editing compliance wording that has not been asked for is how approvals get reset.
