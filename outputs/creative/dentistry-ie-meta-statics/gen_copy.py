"""Primary text + headlines for the general statics, one set per concept per clinic.

Writes copy-c1 … copy-c10 markdown files and copy.json (for the Figma copy cards).
Research and sources: research.md. Clinic facts: build.CLINICS. UK/Irish English, no em dashes, no prices.
"""
import json
from pathlib import Path

from build import CLINICS

HERE = Path(__file__).parent

PROOF = 'Over 500 five-star Google reviews across our eight clinics, and caring for families since 1980.'


def at(addr):
    return 'in' if addr.startswith('Maynooth') else 'at'


def c1(area, addr, coord):
    text = f"""It’s been a few years since your last check-up, and now it feels awkward to even ring.

Maybe you only go when something hurts. Maybe you’ve been putting it off because you’re dreading one question: “When were you last in?”

Nobody at Dentistry.ie {area} is going to give you a lecture. We know life gets busy, and the gap doesn’t matter. What matters is that you’re here now.

Your first visit is a full check-up: teeth, gums and a mouth cancer screening. Then we explain what we found in plain English and talk you through your options. No obligation, and nothing goes ahead until you’re ready.

{PROOF}

Our {area} clinic is {at(addr)} {addr}. Tap Book Now, leave your details, and the team will be in touch to find a time that suits you.

The hardest part is booking. We’ll take care of the rest."""
    heads = ['It’s been years? That’s fine.', f'New patients welcome in {area}', 'No lecture. Just a check-up.']
    return text, heads


def c2(area, addr, coord):
    who = f'In {area}, that’s {coord}, your treatment coordinator.' if coord else f'At our {area} clinic, that’s your treatment coordinator.'
    contact = f'{coord} will be in touch' if coord else 'the team will be in touch'
    text = f"""Switching dentist shouldn’t feel like a gamble.

Maybe it’s the ten-minute appointments. Maybe it’s the extras you weren’t expecting when the bill came. Either way, you’ve started to wonder if you’re being taken for a ride.

At Dentistry.ie, one person looks after you from your first call to your last visit. {who}

{(coord + ' sits') if coord else 'Your coordinator sits'} down with you, explains your options and talks through the costs before anything starts. If you need more than a check-up, you’ll know what’s involved and what it costs, and the decision is yours. No obligation, just honest advice.

Behind {coord if coord else 'them'}, our dentists and specialists plan your care together, so everything fits and nothing is done twice.

{PROOF}

Our {area} clinic is {at(addr)} {addr}, and we’re welcoming new patients. Tap Book Now, leave your details, and {contact} to arrange your first visit.

Good dentistry starts with someone who explains it."""
    h1 = f'{coord}, your coordinator in {area}' if coord else f'Your own coordinator in {area}'
    heads = [h1, 'Options and costs explained first', f'Switching dentist in {area}?']
    return text, heads


def c3(area, addr, coord):
    text = f"""Looking for a dentist in {area}?

Maybe you’ve just moved. Maybe your old dentist retired. Or maybe you’ve rung around and heard “we’re not taking new patients” more than once.

We are. Dentistry.ie {area} is {at(addr)} {addr}, and new patients are welcome.

Your first visit covers:
✔ A full dental exam
✔ A gum health check
✔ Mouth cancer screening
✔ A clear plan, with advice for home

We’re 100% Irish owned, we’ve been looking after families since 1980, and we have over 500 five-star Google reviews across our eight clinics.

Tap Book Now and fill in the short form. The {area} team will get back to you to book you in.

A local dentist you’ll actually want to go back to."""
    heads = [f'A dentist in {area}, taking new patients', f'New patients welcome in {area}', f'Your local dentist in {area}']
    return text, heads


def c4(area, addr, coord):
    text = f"""If you only go to the dentist when something hurts, you’re not alone.

Maybe there’s a twinge you’ve learned to tune out. Maybe you’re waiting to see if it settles. The trouble is, a tooth often only starts to hurt once a problem has been there a while.

A check-up is the easy way to stay ahead of it. Your first visit at our {area} clinic is a full exam that looks for early signs of decay, gum problems and wear, plus a mouth cancer screening. We explain what we find in plain English, and nothing goes ahead until you’re ready.

{PROOF}

Our {area} clinic is {at(addr)} {addr}, and new patients are welcome. Tap Book Now, leave your details, and the team will be in touch to find a time.

Come in before it hurts, not because it does."""
    return text, ['Don’t wait for the toothache', f'New patients welcome in {area}', 'A check-up before it hurts']


def c5(area, addr, coord):
    text = f"""Your dentist retired, and now you have to start again.

You knew where you stood with them. They knew your teeth, your history and how you like things explained. Finding someone new feels like a job you keep putting off.

Dentistry.ie has been looking after families since 1980, and we’re 100% Irish owned. At our {area} clinic, your first visit is a full check-up and a proper conversation. We take the time to listen, explain what we find, and agree a plan with you.

You’ll also have a treatment coordinator, so there’s always one person to ask when you have a question.

Over 500 five-star Google reviews across our eight clinics.

Our {area} clinic is {at(addr)} {addr}, and we’re welcoming new patients. Tap Book Now, leave your details, and the team will be in touch.

A dentist you can stay with for years."""
    return text, ['Old dentist retired?', 'A dentist you can stay with', f'New patients welcome in {area}']


def c6(area, addr, coord):
    text = f"""Yes, we’re taking new patients in {area}.

If you’ve rung around and kept hearing “we’re not taking anyone on”, you can stop ringing.

Our {area} clinic is {at(addr)} {addr}. Leave your details and the team will be in touch to book your first visit: a full check-up, a mouth cancer screening and a plan explained in plain English.

100% Irish owned. Caring for families since 1980. Over 500 five-star Google reviews across our eight clinics.

Tap Book Now to leave your details.

Finding a dentist shouldn’t take ten phone calls."""
    return text, ['Yes, we’re taking new patients', f'New patients welcome in {area}', 'Stop ringing around']


def c7(area, addr, coord):
    text = f"""Don’t just take our word for it.

“I was talked through everything and everyone was so lovely.”

“I am delighted that I changed to this dental practice.”

“As an extremely nervous patient I was so at ease the minute I walked in the door.”

Those are real Google reviews from patients at our clinics, and we have over 500 five-star reviews in total.

If you’re looking for a new dentist in {area}, start with a full check-up at our clinic {at(addr)} {addr}. We explain what we find in plain English, and nothing goes ahead until you’re ready.

Tap Book Now, leave your details, and the team will be in touch.

Join the patients who were glad they switched."""
    return text, ['500+ five-star Google reviews', '“Everyone was so lovely”', f'New patients welcome in {area}']


def c8(area, addr, coord):
    text = f"""Not sure what happens at a first dental visit? Here’s exactly what to expect at our {area} clinic.

1. Book online. Leave your details and the team gets in touch to find a time.
2. A full check-up: teeth, bite, gums and a mouth cancer screening.
3. We explain what we find, in plain English, with time for your questions.
4. You leave with a personalised plan and advice for home. Nothing goes ahead until you’re ready.

That’s it. No surprises and no pressure.

{PROOF}

Our {area} clinic is {at(addr)} {addr}, and new patients are welcome. Tap Book Now to get started.

Knowing what’s coming makes it easier to book."""
    return text, ['Your first visit, step by step', 'No surprises at your first visit', f'New patients welcome in {area}']


def c9(area, addr, coord):
    text = f"""Seeing a dentist, then an orthodontist, then an implant specialist can feel like starting from scratch every time.

Three opinions. Three plans. And you’re left wondering which one to trust.

At Dentistry.ie, our dentists and specialists across eight clinics plan your care together. Your orthodontist talks to your implant specialist. Your cosmetic dentist coordinates with your general dentist. You get one plan where everything fits, and nothing is done twice.

It starts with a new patient visit at our {area} clinic: a full check-up, a mouth cancer screening and a plan explained in plain English.

{PROOF}

Our {area} clinic is {at(addr)} {addr}. Tap Book Now, leave your details, and the team will be in touch.

One team. One plan. You decide."""
    return text, ['Specialists who talk to each other', 'One team, one plan', f'New patients welcome in {area}']


def c10(area, addr, coord):
    text = f"""How long has “ring the dentist” been on your to-do list?

It keeps getting pushed to next week. Then it’s been a year. Then three. And the longer it goes, the more awkward the call feels.

So let us make the call instead. Tap Book Now, leave your details, and the team at our {area} clinic will get in touch to find a time that suits you.

Your first visit is a full check-up and an honest chat about your options. No lectures and no obligation.

{PROOF}

We’re {at(addr)} {addr}, and new patients are welcome.

Consider this your sign."""
    return text, ['Consider this your sign', 'Ring the dentist (finally)', f'New patients welcome in {area}']


HEADER = {
    'c1': ('copy-c1-been-a-while.md', 'C1 | Been a while', """**Persona:** Mark, the lapsed patient (Dental Persona Bank). 35 to 55, five or more years since a check-up, embarrassed by the gap.
**Campaign:** General (Private & PRSI), all eight clinics. **Offer:** new patient check-up (no price on the ad, Toby 22 Oct).
**Awareness:** problem aware. **Sophistication:** 5 (identity and emotion). **Angle:** take away the lecture he's expecting.

**Research:** "I'm not scared of the dentist but I'm embarrassed to go now because it's been so long" (Boards.ie, 2018); "I'd understand if they gave me a lecturing as I've just taken a head in the sand approach" (Boards.ie, Kilkenny, 2016); "I only go when I have bad cavities and toothaches" (Boards.ie, 2017). Client: "A calm, judgment-free environment" and "No obligation, just honest advice" (dentistry.ie). Links in research.md.

**On image:** New patients welcome in [area] / It's been a few years. *We won't make a thing of it.* / Your first visit is a full check-up and an honest chat about your options. No obligation. / Book your check-up. Photo: a smiling clinician in the heart frame (warm, not senior: persona bank casting)."""),
    'c2': ('copy-c2-one-person.md', 'C2 | One person', """**Persona:** Denise, switching (Dental Persona Bank). Wary of being upsold, unsure what things cost.
**Campaign:** General (Private & PRSI), all eight clinics. **Offer:** new patient visit with the treatment coordinator.
**Awareness:** solution aware. **Sophistication:** 3 (mechanism: one named coordinator who explains options and costs first). **Angle:** remove the fear of being "taken for a ride".

**Research:** "I just don't want to be taken for a ride" (Boards.ie, 2020); "Now it seems I'm in and out in less than 10 minutes" (Boards.ie, 2018); "I felt it was gone kind of 'do you want fries with that!'" (Askaboutmoney.ie, 2025). Client: coordinator "explains the options and discusses prices transparently. No obligation, just honest advice", "from start to finish", "No conflicting treatments" (dentistry.ie). Persona bank: "The practice manager is more credible than a clinician here."

**On image:** One person looks after you, *start to finish.* / They explain your options and the costs before anything starts. No pressure, no surprises. / Name badge: [coordinator], Treatment coordinator, [area] / Book a new patient visit. Photo: reception desk. The badge sits beside the photo, never on a person, so nobody pictured is presented as the named coordinator."""),
    'c3': ('copy-c3-new-to-the-area.md', 'C3 | New to the area', """**Persona:** Sophie, new to the area / choosing a local dentist (Dental Persona Bank).
**Campaign:** General (Private & PRSI), all eight clinics. **Offer:** new patient visit, inclusions listed.
**Awareness:** product aware. **Sophistication:** 2 (specifics and proof: address, what's included, review volume). **Angle:** a local practice that is taking new patients.

**Research:** "My dentist of many decades is retired. I need a new one." (Boards.ie, asking about Maynooth, 2024); "I'm now living in the city and want a 'local' dentist" (Boards.ie, Kilkenny, 2016); "An enormous amount of Dentists are not taking on new patients or if they are, long waiting list to get seen." (Boards.ie, 2021). Client: inclusions from each clinic's new-patients-meta landing page; "100% Irish owned", "since 1980", "500+ 5-star reviews" (dentistry.ie).

**On image:** Looking for a dentist *in [area]?* / pin + address / Your first visit: full dental exam, gum health check, mouth cancer screening, a clear plan explained / 5 stars, 500+ five-star Google reviews / Caring for families since 1980 / Book an appointment. Photo: dentist explaining with a model (from dentistry.ie)."""),
    'c4': ('copy-c4-before-it-hurts.md', 'C4 | Before it hurts', """**Persona:** Mark / Ray (Dental Persona Bank): only goes when something hurts. **Awareness:** problem aware. **Sophistication:** 4 (catch it early: the exam looks for early decay and wear). **Angle:** come in before the pain decides for you.

**Research:** "I only go when I have bad cavities and toothaches" (Boards.ie, 2017); "I have a constant dull pain that I think I've just got my brain to be able to tune out" (Boards.ie, 2020). Client: the exam checks "to assess your bite, identify any signs of decay, and spot early wear and tear" (clinic landing pages).

**On image:** New patients welcome in [area] / Only go when something hurts? *Come in before it does.* / A full check-up looks for early signs of decay and wear, while they're still small. / Book your check-up. Sky ground, smiling clinician."""),
    'c5': ('copy-c5-dentist-retired.md', 'C5 | Dentist retired', """**Persona:** Denise / Sophie: the moment their old dentist retired. **Awareness:** problem aware. **Sophistication:** 5 (continuity and trust). **Angle:** a practice that's been here since 1980.

**Research:** "My dentist of many decades is retired. I need a new one." (Boards.ie, asking about Lucan, Celbridge or Maynooth, 2024). Client: "Caring for families since 1980", "100% Irish owned" (dentistry.ie); "We take the time to listen to your needs" (landing pages); dedicated point of contact (dentistry.ie).

**On image:** Your old dentist retired? *We've been here since 1980.* / New patients welcome in [area] / A full check-up and a proper conversation. We take the time to listen, and explain everything in plain English. / Book a new patient visit. Navy ground, team with patient."""),
    'c6': ('copy-c6-taking-new-patients.md', 'C6 | Taking new patients', """**Persona:** anyone who has rung around and been turned away. **Awareness:** most aware. **Sophistication:** 2 (the plain claim, proven by the sign). **Angle:** the answer they haven't been getting.

**Research:** "rang Village Dental and they're not taking on any new patients and no ETA as to when they might." (Boards.ie, 2021); "An enormous amount of Dentists are not taking on new patients or if they are, long waiting list to get seen." (Boards.ie, 2021).

**On image:** Hanging sign: *Yes,* we're taking new patients / Dentistry.ie [area]. USP bar: 100% Irish owned, Since 1980, 500+ five-star reviews. Blurred reception behind."""),
    'c7': ('copy-c7-reviews.md', 'C7 | Reviews', """**Persona:** switching or new to the area, comparing practices. **Awareness:** product aware. **Sophistication:** 2 (proof: volume plus specific words). **Angle:** let patients say it.

**Research:** three Google reviews quoted on dentistry.ie, used verbatim and unnamed: Pauline K. (Artane), Gavin S. (McEvoy, Dublin 2), Claire K. (Balbriggan). "500+ 5-star reviews on Google" (dentistry.ie).

**On image:** Over 500 five-star reviews. *Here's what patients say.* / three review cards / Google reviews of Dentistry.ie clinics. New patients welcome in [area]. / Book a new patient visit."""),
    'c8': ('copy-c8-first-visit.md', 'C8 | First visit, step by step', """**Persona:** Mark: "does not know what happens at a first appointment" (Dental Persona Bank). **Awareness:** solution aware. **Sophistication:** 3 (the process is the reassurance). **Angle:** remove the unknown.

**Research:** "I'm not scared of the dentist but I'm embarrassed to go now because it's been so long" (Boards.ie, 2018). Client: what's included in a new patient appointment and "We'll clearly explain our findings" (clinic landing pages).

**On image:** Your first visit, *step by step.* / At our [area] clinic. New patients welcome. / 1 Book online, 2 Full check-up, 3 Findings explained, 4 Your plan. / Book your first visit. Photo is stock from dentistry.ie."""),
    'c9': ('copy-c9-specialists.md', 'C9 | Specialists together', """**Persona:** Denise, switching and wary of mixed advice. **Awareness:** solution aware. **Sophistication:** 4 (bigger mechanism: coordinated specialists). **Angle:** one plan instead of three opinions.

**Research:** "I just don't want to be taken for a ride" (Boards.ie, 2020). Client: "Your orthodontist talks to your implant specialist. Your cosmetic dentist coordinates with your general dentist." and "No conflicting treatments - everything works together" (dentistry.ie, Meet the team section).

**On image:** Your dentist and specialists *plan your care together.* / General dentist, Orthodontist, Implant specialist linked to One plan / Specialists across our eight clinics. New patients welcome in [area]. / Book a new patient visit."""),
    'c10': ('copy-c10-note-to-self.md', 'C10 | Note to self', """**Persona:** Mark: keeps putting it off. **Awareness:** problem aware. **Sophistication:** 5 (identity: the person who finally books). **Angle:** native, lo-fi note-to-self (Pile B), not an ad layout.

**Research:** "I've kept putting it off cause I might not able to afford it and I also get very anxious about the whole situation." (Boards.ie, 2020); "kept putting it off", "head in the sand" (their words).

**On image:** Post-it: Ring the dentist. (It's been 3 years.) / Consider this your sign. *New patients welcome in [area].* / Book your check-up."""),
}

NOTES = """## Checks for the client (all ten concepts)

- **New patients at every clinic:** the ads say each clinic is welcoming new patients. Please confirm that's true for all eight right now.
- **Review count:** dentistry.ie says 500+ five-star Google reviews; the landing pages say 600+. The ads use 500+ until the right number is confirmed.
- **Coordinators (C2):** names come from each clinic's landing page (Amy, Tracy, Gosia, Natalie, Alina, AnnMarie, and Gosia again at Maynooth). Please confirm they're current, happy to be named, and that Gosia covers both Castleknock and Maynooth. Kilkenny has no coordinator listed, so that version stays unnamed.
- **Maynooth address:** the landing page only gives "Unit 7, Maynooth", so the ad says "Maynooth, Co. Kildare". Send the street name to use.
- **What happens after the form:** copy says the team gets in touch to book a time. Confirm that matches how Boxly leads are handled.
- **Review quote (C2 option):** not used in the primary text. If the client wants "I am delighted that I changed to this dental practice." (a Google review on dentistry.ie) in an ad, it stays unnamed unless the reviewer agrees.
- **Prices and hours:** left off on purpose. The €85 exam (landing pages) conflicts with €65 for Balbriggan in the July workbook, and Loren is sending updated opening hours.
- **Review quotes (C7):** three Google reviews quoted on dentistry.ie (Artane, McEvoy and Balbriggan patients) appear word for word, without names, in every clinic's version. Confirm the client is happy to use them in ads.
- **Specialists (C9):** says specialists across the eight clinics plan care together, as the website does. Confirm patients at every clinic can be referred across the group.
- **Before it hurts (C4):** "a tooth often only starts to hurt once a problem has been there a while" is a general dental point, not a client claim. Have a clinician sanity-check the wording.
- **Photos:** all from dentistry.ie. The C3 dentist wears McEvoy scrubs, so the image is from the Dublin 2 team. Swap in each clinic's own team photos when available.
"""


def main():
    out = {}
    for key, fn in (('c1', c1), ('c2', c2), ('c3', c3), ('c4', c4), ('c5', c5), ('c6', c6), ('c7', c7), ('c8', c8), ('c9', c9), ('c10', c10)):
        fname, title, head = HEADER[key]
        md = [f'# {title} | Dentistry.ie general statics | Meta copy\n', head, '\n---\n']
        out[key] = {}
        for k, area, addr, coord in CLINICS:
            text, heads = fn(area, addr, coord)
            out[key][k] = {'area': area, 'primary': text, 'headlines': heads}
            md.append(f'## {area}\n\n**Headlines:**\n' + '\n'.join(f'- {h}' for h in heads) + f'\n\n**Primary text:**\n\n{text}\n\n---\n')
        md.append(NOTES)
        (HERE / fname).write_text('\n'.join(md))
    (HERE / 'copy.json').write_text(json.dumps(out, ensure_ascii=False, indent=1))
    longest = max(len(h) for c in out.values() for v in c.values() for h in v['headlines'])
    print('written; longest headline', longest)


if __name__ == '__main__':
    main()
