# Vendo Dental static template library

Source: Figma "Vendo Dental | New Static Templates", page "Streamlined Templates"
https://www.figma.com/design/mV5pncqr8T74vO3e3L9Bdn/Vendo-Dental-%7C-New-Static-Templates?node-id=3003-2

32 templates (VT-01 to VT-32) in Vendo placeholder branding. Each comes in 1080x1080, 1080x1920 and 1200x628 (VT-32 is a five-card 1080x1080 carousel). Slots are named layers: `[Price]`, `[USP 1]`, `[Location]`, `Photo`, `Logo`, `Button`.

`previews/<code>.jpg` shows all three sizes side by side. Read the preview here rather than calling the Figma MCP (it has a monthly cap). Only go back to Figma for exact positions, and use the node id below.

## Rules

- These are layouts, not finished ads. Rebuild them in the client's brand (palette, font, logo, photography, graphic shapes) in the HTML harness. Never ship the Vendo placeholder look.
- A gate in the name (consented cases only, sourced stats only, real practice photos only, consent + verbatim quote) is a hard rule. If it is not met, the template is out.
- "Based on Over 100+ Reviews" and other proof lines are placeholders. Use the client's real rating and count, or drop the line.
- Worth values, was-prices, spaces left and dates only when the client has confirmed them.
- Client-specific rejections in memory (e.g. no boxed tick cards for Signature Smiles, no "● LABEL" pills) still apply to that client.

## Index

| Code | Group | Template | Use | Figma node |
|---|---|---|---|---|
| [VT-01](previews/VT-01.jpg) | Invisalign & clear aligners | Offer band | Price-led offer: band over a lifestyle photo, price plus three USPs. | `3003:3` |
| [VT-05](previews/VT-05.jpg) | Invisalign & clear aligners | Product hero | Product hero: aligner render with callout, monthly price, reviews footer. | `3004:470` |
| [VT-17](previews/VT-17.jpg) | Invisalign & clear aligners | Centre band split | Lifestyle photo over a brand band and product panel; monthly price. | `3019:1551` |
| [VT-20](previews/VT-20.jpg) | Invisalign & clear aligners | Editorial price split | Editorial split: large monthly price (optional was-price) beside a portrait. | `3025:1594` |
| [VT-22](previews/VT-22.jpg) | Invisalign & clear aligners | Us vs them comparison (no named competitors) | Us vs them cards, ticks vs crosses. Never name a competitor. | `3032:1930` |
| [VT-23](previews/VT-23.jpg) | Invisalign & clear aligners | Annotated product callouts | Product photo with callout boxes pointing at features. | `3031:1904` |
| [VT-24](previews/VT-24.jpg) | Invisalign & clear aligners | Stat headline (sourced stats only) | One big stat as the headline. Sourced, citable stats only. | `3033:1930` |
| [VT-25](previews/VT-25.jpg) | Invisalign & clear aligners | UGC captions (creator or patient footage) | Native creator/patient footage still with caption boxes. | `3033:2027` |
| [VT-26](previews/VT-26.jpg) | Invisalign & clear aligners | Progress split (consented cases only) | "How it started / how it's going" progress split. Consented cases only. | `3033:2049` |
| [VT-02](previews/VT-02.jpg) | Dental implants | Lifestyle lower third | Full lifestyle photo, scrim and lower-third headline with price. | `3003:96` |
| [VT-15](previews/VT-15.jpg) | Dental implants | Portrait transformation (consented cases only) | Before/after portrait with problem headline. Consented cases only. | `3018:1402` |
| [VT-21](previews/VT-21.jpg) | Dental implants | Question and diagram | Question headline over a gap → treated diagram (renders, not real cases). | `3025:1742` |
| [VT-04](previews/VT-04.jpg) | Composite bonding & smile makeovers | Side column | Photo with a side column: price per tooth and a soft question. | `3004:373` |
| [VT-12](previews/VT-12.jpg) | Composite bonding & smile makeovers | Proof frame (consented cases only) | Before/after proof frame with price. Consented cases only. | `3007:1199` |
| [VT-14](previews/VT-14.jpg) | Composite bonding & smile makeovers | Proof over offer (consented cases only) | Before/after over an offer panel. Consented cases only. | `3018:1240` |
| [VT-16](previews/VT-16.jpg) | Composite bonding & smile makeovers | Annotated transformation (consented cases only) | Before/after with three problems vs three results. Consented cases only. | `3019:1414` |
| [VT-27](previews/VT-27.jpg) | Composite bonding & smile makeovers | Phone notification | Lock-screen notification over a photo carrying the offer. | `3059:2157` |
| [VT-30](previews/VT-30.jpg) | Composite bonding & smile makeovers | Problem and solution | Three problems → one solution over a photo; price per tooth. | `3059:2158` |
| [VT-03](previews/VT-03.jpg) | General dentistry & new patients | Brand card | Brand card over a practice photo: "your new dentist in [Location]". | `3003:251` |
| [VT-06](previews/VT-06.jpg) | General dentistry & new patients | Offer footer | New patient offer panel with address footer. | `3004:612` |
| [VT-07](previews/VT-07.jpg) | General dentistry & new patients | Three reasons | Three reasons to choose the practice, ticks plus review bar. | `3006:1027` |
| [VT-31](previews/VT-31.jpg) | General dentistry & new patients | Handwritten sign | Handwritten sign / note held in a real setting (organic, native). | `3059:2159` |
| [VT-10](previews/VT-10.jpg) | Membership | Membership | Membership plan: monthly price and what is included. | `3007:912` |
| [VT-09](previews/VT-09.jpg) | Open days & practice launches | Event poster | Open day poster: date, spaces left, freebies with worth values. | `3006:1233` |
| [VT-11](previews/VT-11.jpg) | Open days & practice launches | Statement | Now open / opening statement with launch freebies. | `3007:1108` |
| [VT-28](previews/VT-28.jpg) | Open days & practice launches | Invitation card | Open day invitation card in an envelope. | `3059:2160` |
| [VT-08](previews/VT-08.jpg) | Brand & trust (any treatment) | Clinician spotlight | Clinician spotlight: cut-out PNG with name tag. | `3006:1166` |
| [VT-13](previews/VT-13.jpg) | Brand & trust (any treatment) | Team mosaic | Team mosaic of six photos with USPs. | `3016:1186` |
| [VT-18](previews/VT-18.jpg) | Brand & trust (any treatment) | Native practice photo (real practice photos only) | Plain native practice photo with a small logo bug. Real practice photos only. | `3021:1516` |
| [VT-19](previews/VT-19.jpg) | Brand & trust (any treatment) | Patient selfie testimonial (consent + verbatim quote) | Patient selfie with verbatim review quote card. Consent + verbatim quote. | `3021:1565` |
| [VT-29](previews/VT-29.jpg) | Brand & trust (any treatment) | Search bar | Search bar "best dentist in [Location]" with the practice result card. | `3059:2161` |
| [VT-32](previews/VT-32.jpg) | Brand & trust (any treatment) | Meet the team carousel (5 cards) | Five-card meet-the-team carousel (1080x1080 cards only). | `3059:2162` |

## Slots per template

Layer names inside each frame, for matching copy to slots.

- **VT-01:** Band, Button, Location, Logo, Photo, Straighten your smile, [Price], [USP 1], [USP 2], [USP 3], from
- **VT-05:** Aligner render, Button, Callout, Callout point, Footer, From, Google reviews, Leader, Logo, Panel, The smarter way to, [USP 1], [£Price], a month, straighten your smile
- **VT-17:** Brand band, Button, Logo, Photo, Product panel, Product photo, Straighten your smile, [£Price], a month, from
- **VT-20:** / month., Button, Google reviews, Logo, Photo, Small print, Was price (optional), [Invisalign] from, [One or two lines on why it is affordabl, [£Price]
- **VT-22:** Button, Cross, Logo, Our card, Our photo, Our point, Our title, Slot note, Their card, Their photo, Their point, Their title, Tick, VS, VS badge, Why patients choose [Invisalign]
- **VT-23:** Button, Callout box, Callout point, From [£Price] a month, Get your smile ready for summer., Leader line, Logo, Product photo, [USP 1], [USP 2]
- **VT-24:** Button, Google reviews, Photo, [One line that turns the stat into a rea, [Stat headline from a real, citable sour
- **VT-25:** Caption box, Caption text, Photo
- **VT-26:** After photo, Before photo, Button, Google reviews, Headline, Headline accent, How it started, How it started tag, How it’s going, How it’s going tag, Logo
- **VT-02:** Button, Google reviews, Logo, Photo, Scrim, Smile, eat and laugh with confidence again, [Price], a month, from
- **VT-15:** AFTER, AFTER tag, After photo, BEFORE, BEFORE tag, Before photo, Button, Dental implants in, Divider, Google reviews, Logo, Missing teeth holding you back?, Slot note, Tick, [Location], [USP]
- **VT-21:** Arrow, Arrow circle, Button, Diagram after, Diagram before, Google reviews, Logo, Question line 1, Question line 2, Slot note, Small print, [One line on finance or price, e.g. impl
- **VT-04:** Bonding from, Button, Column, Location, Logo, Photo, Rule, Still thinking about your, [£Price], per tooth, smile?
- **VT-12:** AFTER, AFTER tag, After photo, BEFORE, BEFORE tag, Before photo, Composite bonding in, Google reviews, Logo, [Location], [£Price], a month, from
- **VT-14:** AFTER, AFTER tag, After photo, BEFORE, BEFORE tag, Before photo, Button, Composite bonding in, Divider, Google reviews, Logo, Logo tab, Offer panel, Tick, [Location], [USP], [£Price], from, per tooth
- **VT-16:** AFTER, AFTER tag, After heading, BEFORE, BEFORE tag, Before heading, Button, Case photo, Composite bonding in, Cross, Logo, Rule, Tick, [Location], [Problem 1], [Problem 2], [Problem 3], [Result 1], [Result 2], [Result 3], [£Price], a month, from
- **VT-27:** App icon, App icon mark, Button, Date, Google reviews, Logo, Message, Notification, Offer line, Photo, Scrim, Time, Title, [£Price]
- **VT-30:** Arrow, Arrow chip, Button, Divider, Divider line, Label, Logo, Photo, Scrim, Solution, Tooth icon, [Problem 1], [Problem 2], [Problem 3], [£Price], from, per tooth
- **VT-03:** Button, Card, Card tab, Check-ups from, Google reviews, Logo, Photo, USP pill, Your new dentist in, [Location], [Price]
- **VT-06:** Address footer, Button, Check-ups from, Divider, Exam, X-rays and treatment plan, Google reviews, Logo, NEW PATIENT OFFER, Offer panel, Photo, [Price]
- **VT-07:** 3 reasons to choose, Button, Google reviews, Photo, Review bar, Review pill, Tick, Tick circle, [Practice Name], [USP 1], [USP 2], [USP 3]
- **VT-31:** Button, Google reviews, Hand tick, Headline, Logo, Photo, Scrim, Shade, Sign, Tape, Underline, Vector, [USP 1], [USP 2], [USP 3]
- **VT-10:** Badge, Button, Google reviews, Join our dental membership, Logo, Photo, Tick, [From Price], [Item 1], [Item 2], [Item 3], [Item 4], a month, from just
- **VT-09:** Button, Date pill, Divider, Free Retainers (Worth £x), Free Whitening Kit (Worth £x), Free iTero Scan (Worth £x), Google reviews, Icon, Invisalign, Logo, Offer roundel, Only, Open Day, Price chip, [#], [Date], [Offer Details], spaces left
- **VT-11:** Button, Free Retainers (Worth £x), Free Whitening Kit (Worth £x), Free iTero Scan (Worth £x), Logo, Now open in, Opening, Photo, Rule, Wash, [Location], [Season Year]
- **VT-28:** Border, Button, Date pill, Envelope back, Envelope front, Glow, Headline, Invitation card, Label, Logo, Only, Open Day, Seal, Seal mark, Subhead, Treatment, Vector, [Date], [USP 1], [USP 2], [USP 3], [£Price]
- **VT-08:** Button, Clinician cut-out (replace with PNG), Clinician cut-out (transparent PNG), Frame line, Logo, MEET THE TEAM, Name tag, [Dental Nurse], [Dr. Jane Doe]
- **VT-13:** Button, Location, Logo, Meet the team behind your, Photo 1, Photo 2, Photo 3, Photo 4, Photo 5, Photo 6, Tick, [USP], new smile
- **VT-18:** Logo bug, Photo
- **VT-19:** Logo, Name, Photo, Quote, Quote card, Star
- **VT-29:** Button, Category, Favicon, Favicon mark, Logo, Mic icon, Photo, Query, Result card, Scrim, Search bar, Search icon, Star, [Address], [Location], [Practice Name], [Rating], [Review count]
- **VT-32:** Arrow, Avatar, Button, Counter, Google reviews, Headline, Headline italic, Location, Logo, Photo, Progress, Progress rail, Role chip, Scrim, Swipe, Swipe pill, Tick, [Bio line], [Name], [Practice Name], [Role], [USP 1], [USP 2], [USP 3]
