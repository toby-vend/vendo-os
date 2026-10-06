"""'Meet the team' carousel section, shared by the Siha landing pages.

Roster and roles follow the Meet the Team ads (siha.dental/our-team, 6 Oct 2026): the nine current team members
with photos in the Drive team folder. Desktop shows four cards with the fifth peeking in to signal scrolling;
mobile shows one card with the next peeking. Photos live in assets/team/ (gitignored, from Drive).
"""
from build import C

TEAM = [("hannan", "Dr Hannan Imran", "Director &amp; Restorative Dentist"),
        ("abeera", "Dr Abeera Imran", "Specialist Orthodontist"),
        ("darshan", "Dr Darshan Boindala", "Special interest in oral surgery"),
        ("asiya", "Dr Asiya Janmohamed", "Special interest in endodontics"),
        ("leen", "Leen El Ghandour", "Hygienist"),
        ("umasha", "Umasha Ukwatte", "Hygiene Therapist"),
        ("francisca", "Francisca Nagam", "Assistant Practice Manager"),
        ("amelia", "Amelia Halmarick", "Patient Concierge"),
        ("sara", "Sara El-Ali", "Patient Concierge")]

ARROW = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="{d}"/></svg>'
LEFT, RIGHT = "M15 18l-6-6 6-6", "M9 18l6-6-6-6"


def team(m):
    card_w, img_h, gap = (250, 320, 16) if m else (270, 360, 24)
    cards = "".join(f'''<div data-name="Team member" style="flex:none;width:{card_w}px">
      <div data-name="Photo" style="height:{img_h}px;border-radius:24px;background:url(assets/team/{pid}.jpg) 50% 18%/cover no-repeat"></div>
      <div class="h3" style="margin-top:16px">{name}</div>
      <div class="label" style="margin-top:6px;font-size:{13 if m else 11}px;color:{C['br']}">{role}</div></div>''' for pid, name, role in TEAM)
    arrows = (f'<div data-name="Carousel arrows" style="display:flex;gap:12px">'
              f'<span style="width:52px;height:52px;border-radius:50%;border:1.5px solid rgba(20,33,26,.25);color:{C["br"]};display:flex;align-items:center;justify-content:center">{ARROW.format(d=LEFT)}</span>'
              f'<span style="width:52px;height:52px;border-radius:50%;background:{C["od"]};color:{C["nu"]};display:flex;align-items:center;justify-content:center">{ARROW.format(d=RIGHT)}</span></div>')
    head = (f'<div style="display:flex;{"flex-direction:column;gap:24px" if m else "justify-content:space-between;align-items:flex-end"}">'
            f'<div style="max-width:780px"><div class="label" style="color:{C["bo"]}">Meet the team</div>'
            f'<h2 class="h1" style="margin-top:14px;font-size:{32 if m else 44}px">The people who’ll look after you</h2>'
            f'<p class="body" style="margin-top:16px;font-size:{16 if m else 18}px;color:{C["ol"]}">Dentists, specialists, hygienists and the faces who greet you at the door.</p></div>'
            f'{"" if m else arrows}</div>')
    track = (f'<div data-name="Carousel" style="margin-top:{32 if m else 48}px;overflow:hidden;margin-right:-{20 if m else 80}px">'
             f'<div data-name="Track" style="display:flex;gap:{gap}px">{cards}</div></div>')
    bar = (f'<div data-name="Progress" style="margin-top:{28 if m else 40}px;height:2px;background:rgba(20,33,26,.12);border-radius:2px">'
           f'<div style="width:{"14%" if m else "44%"};height:2px;background:{C["od"]};border-radius:2px"></div></div>')
    return (f'<section data-name="Meet the team" style="position:relative;background:{C["wh"]};padding:{"64px 20px" if m else "112px 80px"};overflow:hidden">'
            f'{head}{track}{bar}</section>')
