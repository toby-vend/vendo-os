# Email / CRM Copy Writer

Generates email sequences for dental and healthcare clients. Covers patient reactivation, promotional campaigns, nurture sequences, and appointment reminders.

## Inputs Required

- **Client name** — which dental practice?
- **Campaign goal** — reactivation, promotion, nurture, post-treatment, referral
- **Patient segment** — e.g. lapsed patients (6+ months), new enquiries, existing patients, specific treatment interest
- **Offer** (optional) — e.g. free consultation, 10% off whitening, complimentary check-up
- **Number of emails** — default 3 (range: 1-5)
- **Send frequency** — e.g. every 3 days, weekly, custom schedule
- **Compliance region** — UK (GDC) or Australia (AHPRA)

## Process

1. Read the client record for practice name, branding, and services.
2. Select the appropriate sequence template based on campaign goal.
3. Generate the email sequence with subject lines, preview text, and body copy.
4. Apply compliance filters for the selected region.
5. Save to `outputs/emails/[client-name]-[campaign-type]-[date].md`.

## Email Specifications

| Element | Best Practice |
|---------|--------------|
| Subject line | 30-50 characters, personalised where possible |
| Preview text | 40-90 characters, complements subject line |
| Body copy | 150-300 words per email |
| CTA | One primary CTA per email, clear and specific |
| From name | Practice name or dentist name for trust |

## Output Format

```markdown
# Email Sequence: [Client Name]
**Campaign:** [goal]
**Segment:** [audience]
**Emails:** [count]
**Schedule:** [frequency]
**Date:** [today]

---

## Email 1 of [X]
**Send:** Day 0 (immediate)
**Goal:** [what this email achieves in the sequence]

**Subject Line Options:**
1. [option 1] ([char count])
2. [option 2] ([char count])
3. [option 3] ([char count])

**Preview Text:** [40-90 chars]

**Body:**

Hi {{first_name}},

[Opening — personal, warm, relevant to the segment. 1-2 sentences.]

[Middle — value proposition, reason to act. 2-3 sentences. Address a specific pain point or desire.]

[Social proof or trust element — e.g. "Join 500+ patients who..." 1 sentence.]

[CTA paragraph — clear next step. 1-2 sentences.]

**CTA Button:** [Button text]
**CTA Link:** [destination — booking page, offer page, etc.]

**P.S.** [Optional urgency or additional hook]

---

## Email 2 of [X]
**Send:** Day [X]
**Goal:** [purpose in sequence — e.g. address objections, add urgency]

[Same structure as Email 1]

---

## Email 3 of [X]
**Send:** Day [X]
**Goal:** [final push — urgency, social proof, or alternative offer]

[Same structure]

---

## Sequence Strategy Notes
- **Objective:** [what success looks like — bookings, replies, clicks]
- **Key metric:** [open rate target >25%, CTR target >3%]
- **Segmentation logic:** [who gets this sequence and when]
- **Exit conditions:** [when to remove someone — e.g. they book, they reply, they unsubscribe]
- **Follow-up:** [what happens after the sequence ends — e.g. move to nurture list]

## Compliance Notes
[Region-specific requirements applied throughout]
```

## Sequence Templates by Goal

### Reactivation (lapsed patients)
- Email 1: "We miss you" — warm re-engagement, mention time since last visit
- Email 2: Value reminder — what they're missing, health implications
- Email 3: Incentive — offer or urgency to book

### Promotional
- Email 1: Announce the offer — headline benefit, clear CTA
- Email 2: Social proof — patient results, reviews
- Email 3: Last chance — urgency, scarcity, deadline

### Nurture (new enquiries)
- Email 1: Welcome — introduce the practice, set expectations
- Email 2: Education — helpful content related to their interest
- Email 3: Soft CTA — invite to book a consultation
- Email 4: Social proof — reviews, case studies
- Email 5: Direct CTA — book now, limited availability

### Post-Treatment
- Email 1 (Day 1): Care instructions, what to expect
- Email 2 (Day 7): Check-in, review request
- Email 3 (Day 30): Maintenance reminder, next steps

## Compliance Guidance

### UK (GDC)
- Must include practice name and address
- Unsubscribe link mandatory
- No guaranteed outcomes
- No before/after imagery in emails
- Privacy policy link required

### Australia (AHPRA)
- No testimonials in marketing emails
- No before/after images
- Cannot create unreasonable expectations
- Must include practice details
- Opt-out mechanism required

## Quality Checks
- Subject lines ≤ 50 characters with personalisation tokens
- Preview text complements (not repeats) the subject line
- One clear CTA per email — not competing actions
- Sequence has logical progression (not repetitive)
- Compliance requirements met for selected region
- Merge tags formatted correctly: {{first_name}}, {{practice_name}}
- UK English throughout
- Warm, professional tone — not salesy or pushy
