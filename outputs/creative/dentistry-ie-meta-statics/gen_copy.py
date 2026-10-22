"""Primary text + headlines for the general statics, one set per concept per clinic.

Writes copy-c1-been-a-while.md, copy-c2-one-person.md, copy-c3-new-to-the-area.md and copy.json (for the Figma copy cards).
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
}

NOTES = """## Checks for the client (all three concepts)

- **New patients at every clinic:** the ads say each clinic is welcoming new patients. Please confirm that's true for all eight right now.
- **Review count:** dentistry.ie says 500+ five-star Google reviews; the landing pages say 600+. The ads use 500+ until the right number is confirmed.
- **Coordinators (C2):** names come from each clinic's landing page (Amy, Tracy, Gosia, Natalie, Alina, AnnMarie, and Gosia again at Maynooth). Please confirm they're current, happy to be named, and that Gosia covers both Castleknock and Maynooth. Kilkenny has no coordinator listed, so that version stays unnamed.
- **Maynooth address:** the landing page only gives "Unit 7, Maynooth", so the ad says "Maynooth, Co. Kildare". Send the street name to use.
- **What happens after the form:** copy says the team gets in touch to book a time. Confirm that matches how Boxly leads are handled.
- **Review quote (C2 option):** not used in the primary text. If the client wants "I am delighted that I changed to this dental practice." (a Google review on dentistry.ie) in an ad, it stays unnamed unless the reviewer agrees.
- **Prices and hours:** left off on purpose. The €85 exam (landing pages) conflicts with €65 for Balbriggan in the July workbook, and Loren is sending updated opening hours.
- **Photos:** all from dentistry.ie. The C3 dentist wears McEvoy scrubs, so the image is from the Dublin 2 team. Swap in each clinic's own team photos when available.
"""


def main():
    out = {}
    for key, fn in (('c1', c1), ('c2', c2), ('c3', c3)):
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
