"""Primary text + headlines for the treatment campaign statics (build_campaigns.py), one set per concept per clinic.

Writes copy-implants.md, copy-smo.md, copy-medical.md and copy-campaigns.json (for the Figma copy cards).
Sources: research-campaigns.md. UK/Irish English, no em dashes, no prices, no review counts, no sedation, no staff names.
"""
import json
from pathlib import Path

from build_campaigns import ALL, CAMPAIGNS

HERE = Path(__file__).parent
PROOF = '100% Irish owned, and caring for families since 1980.'
FIN = '0% finance is available, subject to status and terms and conditions.'


def where(area, addr):
    return f'Our {area} clinic is {"in" if addr.startswith("Maynooth") else "at"} {addr}.'


# ------------------------------------------------------------ IMPLANTS
def implants(area, addr):
    close = f'{where(area, addr)} Tap Book Now, leave your details, and the team will be in touch to arrange your implant consultation.'
    return [
        (f"""Remember biting into an apple without a second thought?

When a tooth is missing, you start eating around it. Chewing on one side. Cutting everything small. Passing on the crusty bread. It becomes so normal you barely notice you’re doing it.

Dental implants replace the root of the tooth as well as the tooth itself. They’re fixed in place, so they don’t slip, click or come out, and each one is finished with a crown made to match your own teeth.

At your consultation in {area}, you’ll talk through your goals and your options, from a single tooth to a full arch, and get a clear breakdown of what’s involved. {FIN}

{PROOF}

{close}

Eat what you like again.""",
         ['Eat what you like again', f'Dental implants in {area}', 'Fixed teeth that don’t slip']),

        (f"""You’ve got used to the gap. Most people do.

You smile with your mouth closed. You chew on the other side. You tell yourself it’s fine because nobody really notices. But you do, every time you see a photo.

A single implant replaces one missing tooth on its own, without needing to touch the healthy teeth either side. Once it’s healed, it looks and works like the tooth you lost.

Your consultation in {area} is a chance to ask everything: whether you’re suitable, how long it takes, and what it costs. No obligation, and nothing goes ahead until you’re ready. {FIN}

{PROOF}

{close}

Smile without thinking about it.""",
         ['You don’t have to live with the gap', f'Replace a missing tooth in {area}', 'One tooth, replaced properly']),

        (f"""Not knowing what happens is half the worry with implants.

So here it is, step by step.

1. Consultation. You meet the team, talk about your goals and find out if implants suit you.
2. 3D scan and plan. X-rays and a CBCT scan show exactly where the implant should go, before anything is placed.
3. Placing the implant. A minor procedure, with full aftercare advice while it heals.
4. Your new tooth. Once it’s settled, your custom crown, bridge or denture is fitted.

From placement to the final tooth usually takes three to six months, and we explain every stage before it starts. {FIN}

{PROOF}

{close}

No surprises. Just a clear plan.""",
         ['Implants, explained step by step', f'Dental implants in {area}', 'Know every step before you start']),

        (f"""Thinking about going abroad for implants? Ask one question first.

Who looks after them afterwards?

An implant isn’t a one-off. It needs checking, cleaning and the odd adjustment for years. If something goes wrong, you want the team that placed it to be down the road, not a flight away.

At Dentistry.ie {area}, your implant is planned with a 3D CBCT scan, placed by our implant team and followed up at the same clinic, for every check-up after.

Your consultation covers your options, your timeline and a clear breakdown of the cost, so you can compare properly. {FIN}

{PROOF}

{close}

Implants you can keep an eye on, close to home.""",
         ['Aftercare close to home', f'Implants in {area}, not abroad', 'Who looks after your implant?']),

        (f"""Dentures slipping when you laugh?

Maybe you’ve tried every adhesive going. Maybe you skip the steak, or hold back a laugh at dinner in case something moves. It’s tiring, and it shouldn’t be part of your day.

Implants give you teeth that are fixed in place. From a single tooth to a full arch on four implants, there’s no adhesive, no clicking and no worrying about them coming loose. Because implants replace the root, they also help protect the jawbone.

At your consultation in {area}, we’ll look at your options honestly, including whether implant-supported teeth suit you. {FIN}

{PROOF}

{close}

Laugh like you mean it.""",
         ['Teeth that stay put', f'Implant-supported teeth in {area}', 'No more denture adhesive']),
    ]


# ------------------------------------------------------------ SMILE MAKEOVER & ORTHO
def smo(area, addr):
    close = f'{where(area, addr)} Tap Book Now, leave your details, and the team will be in touch to arrange your smile consultation.'
    return [
        (f"""Do you smile with your mouth closed in photos?

Maybe it’s a crooked tooth, a gap, a chip or the shade. You’ve learned the angle that hides it, and you’ve stopped laughing properly when the camera’s out.

A smile makeover is a plan built around what bothers you. That might be Invisalign to straighten, whitening to brighten, bonding or veneers to fix chips and gaps, or a mix of all three, all under one roof in {area}.

Your consultation starts with a relaxed chat and a digital scan, so you see what’s possible before you commit to anything. {FIN}

{PROOF}

{close}

The next photo, smile properly.""",
         ['Smile properly in photos', f'Smile makeovers in {area}', 'Straighten, brighten, repair']),

        (f"""Always wanted straighter teeth, but not the train tracks?

Plenty of adults put it off for years because of the thought of metal braces at work, in photos, everywhere.

Invisalign clear aligners are custom-made from a scan of your teeth. They’re barely noticeable, you take them out to eat, and every treatment comes with a bespoke retainer to protect your result.

At your consultation in {area}, we check whether aligners suit your teeth and talk you through the timeline and cost. If braces would work better, we’ll tell you that too. {FIN}

{PROOF}

{close}

Straighter teeth, on your terms.""",
         ['Straighter teeth, no train tracks', f'Invisalign in {area}', 'Clear aligners, explained']),

        (f"""Fixing your smile one tooth at a time rarely looks right.

Whitening on its own won’t fix a crooked tooth. Bonding on crowded teeth won’t sit evenly. The best results usually come from doing things in the right order.

That’s why we plan your whole smile together. A typical plan might be Invisalign to straighten first, then whitening, then bonding to refine the edges. Every step builds on the last, and the finish looks natural.

Your consultation in {area} includes a digital scan and photos, and you get a clear, written plan with every cost set out before anything starts. {FIN}

{PROOF}

{close}

One plan, one result you’ll love.""",
         ['One plan for your whole smile', f'Smile makeovers in {area}', 'Straighten, whiten, then refine']),

        (f"""That chip you always notice in the mirror?

Most people would never spot it. But you do, every time you smile, and you’ve probably caught yourself covering it.

Composite bonding is a tooth-coloured material, matched to your shade and shaped by hand onto the tooth. It can fix chips, worn edges and small gaps, often in a single appointment, without covering the whole tooth.

Book a consultation in {area} and we’ll tell you honestly whether bonding is the right fix, or whether something else would last better. {FIN}

{PROOF}

{close}

A small fix that changes how you smile.""",
         ['Fix a chipped tooth in one visit', f'Composite bonding in {area}', 'Chips and gaps, repaired']),

        (f"""Not sure what you want done? That’s what the consultation is for.

You might know something bothers you about your smile without knowing what would fix it. Straightening? Whitening? Veneers? It’s hard to choose when you can’t picture the result.

At your smile consultation in {area}, we take a digital scan and photos of your teeth, talk through your options honestly, and give you a clear, written plan with the cost of each step. No pressure, and nothing goes ahead until you’re ready. {FIN}

{PROOF}

{close}

See what’s possible first. Decide after.""",
         ['See what’s possible first', f'Smile consultation in {area}', 'Your options, explained honestly']),
    ]


# ------------------------------------------------------------ MEDICAL CARDS (instant form)
def medical(area, addr):
    close = f'{where(area, addr)} Tap Book Now, fill in the short form, and the team will call you to arrange your appointment.'
    cover = 'a dental examination, fillings and extractions'
    return [
        (f"""Have a medical card? We’ll see you.

Lots of people with a medical card don’t realise it covers dental treatment, or they’ve been told “we don’t take medical cards” and given up asking.

At Dentistry.ie {area}, we welcome medical card patients. Your card covers essential treatment, including {cover}.

{PROOF}

{close}

Your entitlements, used properly.""",
         ['Medical card patients welcome', f'Medical card dentist in {area}', 'Your dental care is covered']),

        (f"""Did you know your medical card covers your dental care?

If you hold a medical card, you’re entitled to essential dental treatment, including:
✔ A dental examination
✔ Fillings
✔ Extractions

Dentistry.ie {area} welcomes medical card patients, so you can get your teeth checked and anything that needs doing sorted, in a friendly clinic close to home.

{PROOF}

{close}

Don’t wait for a toothache to use it.""",
         ['What your medical card covers', f'Medical card dentist in {area}', 'Exams, fillings and extractions']),

        (f"""Rang around and kept hearing “we don’t take medical cards”?

You’re not the only one. Plenty of practices have stopped seeing medical card patients, and it can feel like there’s nowhere left to try.

Dentistry.ie {area} welcomes medical card patients. Your card covers essential treatment, including {cover}.

{PROOF}

{close}

You can stop ringing around.""",
         ['We do take medical cards', f'Medical card patients in {area}', 'Stop ringing around']),

        (f"""Your dental care is covered. Don’t let it go unused.

If you have a medical card, you’re entitled to essential dental treatment, including {cover}. It’s there for you, and your teeth are worth looking after.

At Dentistry.ie {area}, we welcome medical card patients in a friendly, professional clinic.

{PROOF}

{close}

Look after your teeth. It’s covered.""",
         ['Don’t let your entitlement go unused', f'Medical card dentist in {area}', 'Your dental care is covered']),

        (f"""Looking for a medical card dentist in {area}?

Dentistry.ie {area} welcomes medical card patients. We’re {"in" if addr.startswith("Maynooth") else "at"} {addr}, so there’s no long trip into town for a check-up.

Your medical card covers essential treatment, including {cover}.

{PROOF}

{close}

A local dentist that takes your medical card.""",
         [f'A medical card dentist in {area}', 'Medical card patients welcome', 'Your local dentist']),
    ]


GEN = {'implants': implants, 'smo': smo, 'medical': medical}


def main():
    out = {}
    for key, camp in CAMPAIGNS.items():
        md = [f'# Dentistry.ie | {camp["title"]} | Meta copy (5 concepts)', '', 'Research and rules: research-campaigns.md.', '']
        out[key] = {}
        for k in camp['clinics']:
            area, addr = ALL[k]
            sets = GEN[key](area, addr)
            out[key][k] = [{'c': c[0], 'h': h, 'p': p} for c, (p, h) in zip(camp['concepts'], sets)]
            md.append(f'## {area}\n')
            for c, (p, h) in zip(camp['concepts'], sets):
                md += [f'### {c[0]}', '', '**Headlines:**', *[f'- {x}' for x in h], '', '**Primary text:**', '', p, '', '---', '']
        (HERE / f'copy-{key}.md').write_text('\n'.join(md))
    (HERE / 'copy-campaigns.json').write_text(json.dumps(out, ensure_ascii=False, indent=1))
    txt = json.dumps(out, ensure_ascii=False)
    assert '—' not in txt, 'em dash in copy'
    print('wrote copy for', sum(len(v) for v in out.values()), 'clinic pages')


if __name__ == '__main__':
    main()
