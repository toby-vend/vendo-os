# Vendo Digital — brand guideline + Meta statics

Source design: Figma "Vendo Digital Website" (UC5LLsY9HizrKO4iWAManC), v5 "brand sheet" frames (Toby picked v5 on 2026-10-03).
Brand guideline (Figma): https://www.figma.com/design/0QzU2TgMyBsrKIT1B5LNSQ — Vendo team, "Vendo Digital" folder (420335580).

## Tokens taken from v5
- Canvas #051412, Sage #09221F, Card #0B231F, Green #8EFEBB, White, Charcoal #2C2C2C, Grey #ABABAB
- Body #C9D2CE; on mint: ink #0B231F, body #36514A, muted #566D64
- Manrope SemiBold display 88/-4%/114, heading 56/-3%/114, index 32 Medium, lead 30 Medium/-1.5%/130, body 17/-0.5%/150, small 15/145, eyebrow + button 13–15 caps +6%
- Instrument Serif Italic flourish: one word per headline, mint on dark, black on mint
- Radii: 999 pills, 20 cards/photos, 14 inputs, 12 tiles; 1px white borders at 8–12%

## Proposed rules that need sign-off (not in any source file)
- Clear space = x-height of the wordmark; minimum size 80px / 20mm, icon 24px
- Colour balance 70/15/10/5
- Vendo Dental uses the master Vendo. logo (no separate dental logo)

## Photos
assets/photos/site/ (gitignored) — raw images pulled from the website Figma file. Excluded: stock and Higgsfield/AI images.

## Measuring ROI statics — v5 brand refresh (2026-10-03)
- Source: "Vendo – Dental Practice Static Ads" (rXwHXr7UQ6ldReKxDSZtBv), page "Measuring ROI ads (v3)" 37:7. Read-only for our account, so the refresh lives in a new file:
  https://www.figma.com/design/kluNBf7ZYkvdpet56Oqsiu (Vendo Digital folder)
- 12 concepts × 1x1 / 4x5 / 9x16. Copy and photo crops unchanged from v3; 9x16 photo extended to 1040px so the logo ends above y=1580.
- Restyle: Manrope SemiBold sentence-case headline with one Instrument Serif Italic mint phrase, mint-dot eyebrow, tick + offer, mint pill CTA, official SVG logo, hairline rule.
- Names follow "<Concept> | Static | <Talent> | Brand refresh | <size> | 261003". Talent is a placeholder (Stage/Team/Client/Event/Podcast) until Toby confirms who is in each photo.
- Photos: assets/photos/roi/ (gitignored). Figma image hash = SHA-1 of the file bytes, useful for mapping downloads back to frames.

## Practice-style statics — v5 brand refresh (2026-10-03)
- Source page "Practice-style ads (v2)" 6:2 in rXwHXr7UQ6ldReKxDSZtBv. Rebuilt on page "Practice-style (v5 · brand refresh)" (6:2) in kluNBf7ZYkvdpet56Oqsiu.
- 6 concepts × 3 sizes; copy unchanged, v2's per-size photos used with FILL. Photos in assets/photos/practice/ (gitignored, named by Figma hash).
- Open: three eyebrows don't match their headline (Scale Practice = "Full-arch implants", Gappy Diary = "Composite bonding", Losing To Competitors = "Second opinions"); Cosmetic 9x16 photo has a blurred foreground blob at the top (from v2's crop).

## Replacement image options (2026-10-03)
- Page "Image options (pick replacements)" in kluNBf7ZYkvdpet56Oqsiu: 17 numbered candidates.
- 01–13: stills from Vendo's public case-study videos (Sherwood Park 2rSZqfRMO9A, Avenue Dental 6O052zS9EG0, One Dental GtrdCsbmP6g, St Clears SygaKyeb8DI). yt-dlp 2026.07.04 gets 403 after ~10MB, so only the first ~minute of each was usable; Kana (61sDxTd4MuI) has burned-in subtitles, skipped.
- 14–18: vendodigital.co.uk media library + website Figma. Instagram is all captioned reels, skipped.
- Drive (e.g. "Vendo phots" 1iPvHMlMkX8J-6_Z4gf_o9eojFAnPI9rx, sonemarketing shoot folders) not searched visually: token and Chrome routes were blocked by the permission classifier.
- Next: 1.91:1 (1200x628) version of both refreshed sets once images are picked.

## Image options round 2 (2026-10-03)
- Toby approved only 01, 04, 05, 11 from round 1; no One Dental imagery ever (memory: feedback_vendo_ad_imagery_approved).
- Page "Image options v2" (13:2): approved 4 + new 20–42 (32 removed: dentist looked like One Dental's owner).
- New sources: Frame.io raws via read-only ffmpeg seeking (scratch script fio-stills.mts → assets/photos/candidates/fio): Vendo/Website Banners/RAWS, Vendo/25th Feb Content Day/Raws/B-roll, Zen House/13TH AUGUST/RAWS/B roll; full YouTube downloads via newer yt-dlp in a scratch venv (Zen House AhgnKmhxHZY, Avenue, St Clears).
- Skipped: Vendo Testimonial Compilation (vertical, includes One Dental), St Clears/Avenue patient testimonials (patients + captions), Kana shorts (burned captions).
- A handful of Frame.io grabs failed on a Turso timeout; rerun was blocked, so those clips weren't reviewed.

## Final images + 1.91:1 (2026-10-03)
- Practice-style: Check Up 31, Consistent Flow 27, Scale 21, Cosmetic 05, Gappy 28, Competitors 30 (focus-point CROP fills per size).
- ROI: Which Ads Pay → 22, CRM Connected → 01 (row was mislabelled "Which Ads Pay"; renamed), PMS Integration → 33. 42 tried for Which Ads Pay but reads as backs of heads at ad crops.
- New size: 1200x628 "1.91x1" frame per concept at x=3540 on both pages (photo left 560px, text right). Serif phrase forced onto one line where it split (Scale Practice, Patient Outcomes).

## Canvas ads brought into Figma (2026-10-03)
- Source: Claude Design canvas "Vendo Paid Social Statics" (https://claude.ai/artifact/GkFDNPvUgLk32Wqw5B8D29).
- Brought in 29 artboards as editable layers (A3, A4, B1, B4, C2, W1–W4, tweet carousels T1–T3) to page "Vendo Paid Social Statics (from canvas)" (21:2) in kluNBf7ZYkvdpet56Oqsiu. Skipped at Toby's request: A1, A2, B2, B3, C1, C3, C4.
- Pipeline: artboard .dc.html read via Artifact tool → canvas-harness/{statics,carousels}.html (x-dc/helmet stripped, /_blob ids → local assets) → generate_figma_design capture → auto layout stripped, artboards lifted and named, grain/overlay layers locked.

## Native notes, logo wall, canvas statics rebrand (2026-10-03)
- 8 organic note ads (Magnific Nano Banana Pro, 4:5 2k, 3 variants each; picks finished with ffmpeg crop 1080x1350, sat 0.92, grain) on page 21:2 row "Native notes". Raws/finals: outputs/creative/vendo-paid-social-statics/2026-10-03-sign-notes/. Rejected: N6 variant 1 ("YOECK" typo). Toby: no AI people in scrubs — objects only.
- B4 logo wall: 9 dental client logos (Kana, Dentistry.ie, Bright Orthodontics, Avenue, Rothley Lodge, Zen House, Lakewood, Thornley Park, Smile for Life) cut from the website Figma client strip (782:9009 main component exports blank; used instance 810:51623 export + luminance→alpha). Non-dental logos excluded; One Dental not in the strip.
- A3, B1, B4, W1–W4 rebuilt natively in the v5 refresh style (flat #051412, Manrope SemiBold + one serif word, eyebrow, tick offer, uppercase pill CTA, logo footer). A4, C2 and the T1–T3 carousels untouched (Toby: don't edit carousels).
