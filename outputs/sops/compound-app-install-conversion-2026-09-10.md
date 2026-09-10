# Compound: measuring app downloads from the employee landing page

**Date:** 2026-09-10
**Page:** `https://lp.compoundapp.co.uk/employee/`
**App:** Compound, Compound Digital Ltd. Same bundle id on both platforms, `com.compounddigital.investorapp`
**Store links on the page:** [App Store `id6743077429`](https://apps.apple.com/gb/app/compound/id6743077429) · [Google Play](https://play.google.com/store/apps/details?id=com.compounddigital.investorapp)

---

## Start here: GTM cannot see an app install

This is the one thing to be clear on before building anything. Once someone taps through to the App Store, they have left the browser. The web container has no visibility into whether they installed, opened, or abandoned at the store listing. No amount of GTM configuration changes that. It is the boundary between web and app, not a gap in the setup.

So "a conversion for anyone who downloads the app" splits into three separate jobs, with very different costs:

| What you measure | Where it lives | Effort | What it actually tells you |
|---|---|---|---|
| **Store click** | GTM, today | ~20 minutes | Someone tapped App Store or Google Play. A proxy for intent, not an install |
| **Real install count, attributed to campaign** | Store consoles, via link tokens | ~1 hour | How many people actually installed off the back of a campaign. No app dev work |
| **Install plus in-app events, optimisable in Meta** | Meta SDK or an MMP, inside the app | App release cycle | Real attribution, and the ability to run App Promotion campaigns and optimise to activation |

Do the first two now. The third is a decision about whether app installs become a primary channel goal, not a tracking task.

---

## One thing worth knowing about this page first

The store links only exist inside the `isDone` state. They appear **after** someone has submitted name, age and email to see their estimate. So every store click is already an emailed lead.

That is good design, and it has two consequences:

- The store-click event sits deep in the funnel and will be **low volume**. At the £20/day B2C budget in the campaign structure, expect a handful a week, not a signal you can optimise a campaign towards.
- You are not choosing between a lead and an install. You get the email either way, and the store click is a quality signal on top.

---

## 1. Store click conversion, in GTM

This one is genuinely easy, because unlike the booking forms the store links are ordinary `<a href>` elements. The built-in click trigger works, no code change needed.

### Where the two buttons actually are

Both buttons live **only on `lp.compoundapp.co.uk/employee/`**, inside the `isDone` state. I checked `compoundapp.co.uk` and there are no store links on the main site at all, so nothing to track there yet. If they get added to the main site later, the same trigger works as long as both properties run the same container.

```
App Store    https://apps.apple.com/gb/app/compound/id6743077429
Google Play  https://play.google.com/store/apps/details?id=com.compounddigital.investorapp
```

Neither has `target="_blank"`, so both navigate the current tab away. That is why Wait for Tags is not optional below.

### Build it, click by click

Use the existing container, `GTM-PHVS5RLL`, not a new one.

**Step 1. Turn on the click variables.**
Variables → Configure → tick **Click URL**, **Click Element**, **Click Text**. Without Click URL the trigger has nothing to match on, which is the usual reason a first attempt silently never fires.

**Step 2. Create the platform variable.**
Variables → New → Custom JavaScript, name it `JS - store platform`:

```js
function () {
  var u = String({{Click URL}} || '');
  if (u.indexOf('apps.apple.com') > -1) { return 'ios'; }
  if (u.indexOf('play.google.com') > -1) { return 'android'; }
  return undefined;
}
```

One trigger and one tag covers both buttons, with this variable telling them apart. Two of everything would be twice the maintenance for the same data.

**Step 3. Create the trigger.**
Triggers → New → Click → **Just Links**.

| Setting | Value |
|---|---|
| Wait for Tags | ticked, 2000 |
| Check Validation | ticked |
| Enable this trigger when | `Page URL` contains `lp.compoundapp.co.uk/employee` |
| This trigger fires on | Some Link Clicks |
| Condition | `Click URL` matches RegEx `apps\.apple\.com\|play\.google\.com` |

Name it `Click - App Store`.

**Step 4. Add the two tags** (Meta and GA4, below), both on that trigger.

**Step 5. Preview and test.**
The gotcha: **the buttons are hidden until the estimate is submitted.** In Preview you have to fill in name, age and a valid email and click "Show my estimate" before the buttons exist. Then click each one and confirm `Click - App Store` fires with `JS - store platform` reading `ios` then `android`.

**Step 6. Make it usable in Meta.**
Events Manager → Custom Conversions → New, built on the `AppStoreClick` event. If you want the two buttons as separate conversions, create two and filter each on the `platform` parameter.

### Variable

`JS - store platform`
```js
function () {
  var u = String({{Click URL}} || '');
  if (u.indexOf('apps.apple.com') > -1) { return 'ios'; }
  if (u.indexOf('play.google.com') > -1) { return 'android'; }
  return undefined;
}
```

### Trigger

`Click - App Store` — type **Just Links**

| Setting | Value |
|---|---|
| Wait for Tags | On, 2000ms |
| Check Validation | On |
| Enable when | Page URL contains `lp.compoundapp.co.uk/employee` |
| Fire on | Click URL matches RegEx `apps\.apple\.com\|play\.google\.com` |

Wait for Tags matters here. The click navigates the browser away to the store, and without it you will lose a share of events on slower connections.

### Tag: Meta store click

Custom HTML · trigger `Click - App Store` · consent: same as the other Meta tags

```html
<script>
(function () {
  if (typeof fbq !== 'function') { return; }

  // The visitor has already submitted the estimate form to reach these links,
  // so the advanced matching values are still sitting in the data layer.
  var am = {};
  var eid = {{JS - external_id}},
      em  = {{JS - AM email}},
      fn  = {{JS - AM first name}};
  if (eid) { am.external_id = eid; }
  if (em)  { am.em = em; }
  if (fn)  { am.fn = fn; }
  fbq('init', '{{Const - Meta Pixel ID}}', am);

  fbq('trackCustom', 'AppStoreClick', {
    platform: {{JS - store platform}},
    content_name: 'employee'
  });
})();
</script>
```

There is no Meta standard event for a web-to-store handoff, so a custom event is correct. Then in **Events Manager → Custom Conversions**, create one from `AppStoreClick` so it becomes selectable for reporting.

### Tag: GA4 store click

GA4 Event · trigger `Click - App Store` · event name `app_store_click`

| Parameter | Value |
|---|---|
| `platform` | `{{JS - store platform}}` |
| `lp_page` | `employee` |

### Name it honestly

Call the custom conversion **App Store Click**, not "App Install". Six months from now nobody will remember the distinction, and a metric called "installs" that is really clicks will quietly mislead a board slide.

---

## 2. Real install counts, without touching the app

Both stores will tell you how many people actually installed from a campaign, if you tag the outbound links. This is the cheapest route to a genuine download number and it needs no SDK.

**Google Play** reads a `referrer` parameter and exposes it to the app via the Play Install Referrer API. It also surfaces in Play Console acquisition reports.

**Apple** reads `pt` (provider token, from App Store Connect) and `ct` (campaign token) and reports installs per campaign token in App Store Connect → App Analytics. You need the provider token from App Store Connect before this works.

A single GTM Custom HTML tag on **Initialisation - All Pages** decorates both links with the campaign that brought the visitor. The links are in the DOM from page load even while hidden, so this runs safely on load.

```html
<script>
(function () {
  var APPLE_PROVIDER_TOKEN = '';   // from App Store Connect. Leave blank to skip Apple tagging.
  try {
    var q = new URLSearchParams(location.search);
    var source   = q.get('utm_source')   || 'direct';
    var campaign = q.get('utm_campaign') || 'direct';
    var content  = q.get('utm_content')  || '';

    var play = document.querySelectorAll('a[href*="play.google.com"]');
    for (var i = 0; i < play.length; i++) {
      var ref = 'utm_source=' + source + '&utm_medium=paid_social' +
                '&utm_campaign=' + campaign + (content ? '&utm_content=' + content : '');
      play[i].href += (play[i].href.indexOf('?') > -1 ? '&' : '?') +
                      'referrer=' + encodeURIComponent(ref);
    }

    if (APPLE_PROVIDER_TOKEN) {
      var apple = document.querySelectorAll('a[href*="apps.apple.com"]');
      for (var j = 0; j < apple.length; j++) {
        apple[j].href += (apple[j].href.indexOf('?') > -1 ? '&' : '?') +
                         'pt=' + encodeURIComponent(APPLE_PROVIDER_TOKEN) +
                         '&ct=' + encodeURIComponent(campaign) + '&mt=8';
      }
    }
  } catch (e) { /* never block the link */ }
})();
</script>
```

Because the campaign structure sets `utm_campaign={{campaign.name}}` and `utm_content={{ad.name}}`, and every ad name carries its copy Ref, a Play Console install report will trace back to the exact approved creative. That is a genuinely useful loop for a fraction of the cost of an MMP.

---

## 3. Proper install attribution, if downloads become the goal

Only worth doing if app installs are going to be a primary KPI rather than a secondary read. It is app development work, not tracking configuration.

**What is required**

1. **Register the app in Meta.** Business settings → Apps. Both platforms, bundle id `com.compounddigital.investorapp`.
2. **Instrument the app.** Either the Meta SDK, or an MMP such as AppsFlyer, Adjust or Branch. Choose the MMP if Compound will ever run more than one paid channel, or Google and Apple Search Ads alongside Meta. One SDK reporting to all networks beats three network SDKs arguing about who gets the credit.
3. **iOS specifics.** SKAdNetwork, Aggregated Event Measurement configured in Events Manager, and an ATT prompt in the app. Expect aggregated, delayed and capped reporting. iOS install attribution is not comparable to web conversion reporting and should not be presented as if it were.
4. **Android.** Play Install Referrer. Comparatively simple.
5. **Switch objective.** Installs are bought with the **App Promotion** objective, which sends people straight to the store rather than through a landing page.
6. **Decide the in-app event that matters.** Optimising to install alone buys installs that never open. The event worth optimising to is the completed pension search, the moment the product delivers. Define that event in the SDK from the start.

**Two things to weigh before committing**

- **This changes the funnel shape.** An App Promotion campaign skips the landing page, which is also where the email is captured. Today an abandoned install still leaves you a lead. Going direct to the store trades that lead capture for a shorter path to install. At a £20/day B2C budget I would keep the landing page and the email.
- **Ask RiskSave first.** Sending traffic straight to the App Store bypasses the landing page they are approving. The ad still carries its risk warning and the store listing is Compound's own, but that is a question to put to them before building, not after.

---

## Recommendation

1. Build the store-click conversion now. It is twenty minutes and it tells you which creatives produce people who reach for the app.
2. Add the store link tokens. Get the Apple provider token from App Store Connect. This gives real install numbers per campaign with no app work.
3. **Do not optimise the B2C campaign towards store clicks.** The event sits behind an email gate on a £20/day budget, so the volume will not support it. Keep optimising to the estimate submission, which has volume and captures a first-party email, and read store clicks as the quality signal underneath.
4. Revisit the SDK or MMP question only if B2C budget grows enough for installs to be a channel goal in their own right.
