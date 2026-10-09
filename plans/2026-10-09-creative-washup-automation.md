# Creative wash-up pack: concepts, Sheet, fortnightly refresh

Date: 2026-10-09
Live page: https://claude.ai/artifact/1cdw4Cd1WbEP41cGHDVeah

## Goal
Before every Creative Wash Up call (fortnightly Fridays, 10:30 and 11:15) the
wash-up page refreshes itself with the last 14 days of Meta creatives, adds a
concept comparison, and writes a Vendo-only Google Sheet copy for the team.

## 1. Concept comparison (new section on the page)
Tag every creative on four dimensions, read from the creative itself (image,
copy, script, ad name), with a fixed list of values so fortnights compare:

- Format: talking head / UGC, patient testimonial, practice walkthrough,
  before & after, lifestyle photo static, typographic / infographic static,
  carousel, organic post, motion graphic.
- Angle: anxiety / nervous, confidence / appearance, function (eating,
  speaking), price / value, convenience / speed, expertise / trust,
  local / community, life event, gifting, craft / quality.
- Offer: free consultation, priced exam / check-up, from-price, monthly
  finance, bonus extras (free whitening etc.), open day / event, limited-time
  discount, no offer.
- Persona: the person the ad speaks to (nervous patient, busy professional,
  parent, denture wearer, cosmetic-conscious, new to area, gift buyer,
  tradesperson, DIY homeowner, and so on).

Section shows, per dimension, a table for dental lead gen and one for
ecommerce: creatives, spend, results, cost per result (or ROAS), median
thumbstop and CTR, with the top three example thumbnails per row. Plus 3 to
5 written takeaways. Non-GBP spend converted at a stated approximate rate
for the comparison only.

## 2. Google Sheet (Vendo-only)
New Sheet per fortnight in a "Creative Wash-Up" Drive folder, shared with the
vendodigital.co.uk domain only. Tabs: Fixes, Talking points, Concepts,
Creatives (one row per creative: preview image, client, ad, tags, metrics,
copy, script, play link). Built with the existing Sheets v4 helper.

## 3. Scheduled refresh
launchd job on Toby's Mac, Fridays at the agreed time. A shell check skips
non-wash-up weeks; Claude also confirms the calendar event exists. The run:
pull Motion (all accounts, 14 days), transcribe only new videos (cached),
tag concepts, read the latest wash-up Fathom calls, write fixes and talking
points, rebuild and republish the page to the same link, write the Sheet,
log to data/creative-washup/run.log. Missed runs (lid closed) fire on wake.

## Sharing
Page: Toby turns on "anyone with the link" in its Share menu (one-off).
Sheet: domain-restricted automatically.
