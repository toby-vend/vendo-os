"""Simple thin-line icons for per-item grids (Hannan, 10 Oct 2026: a simple graphic per item instead of the Siha logo).

24px viewBox, round caps; stroke width is scaled so the rendered line stays ~1.5px at any size.
"""
TOOTH = ("M7 3C4.8 3 3 4.8 3 7.2c0 2.4.9 3.8 1.6 5.8.6 1.8.8 4.2 1.3 6.3.3 1.3 1 2.2 1.9 2.2 1.4 0 1.6-2 2-4 "
         ".3-1.4.9-2.5 2.2-2.5s1.9 1.1 2.2 2.5c.4 2 .6 4 2 4 .9 0 1.6-.9 1.9-2.2.5-2.1.7-4.5 1.3-6.3.7-2 1.6-3.4 1.6-5.8 "
         "C21 4.8 19.2 3 17 3c-1.9 0-3 1-5 1S8.9 3 7 3z")
SPARK = ("M9.94 15.5a2 2 0 0 0-1.44-1.44l-6.13-1.58a.5.5 0 0 1 0-.96L8.5 9.94A2 2 0 0 0 9.94 8.5l1.58-6.13a.5.5 0 0 1 .96 0"
         "l1.58 6.13a2 2 0 0 0 1.44 1.44l6.13 1.58a.5.5 0 0 1 0 .96l-6.13 1.58a2 2 0 0 0-1.44 1.44l-1.58 6.13a.5.5 0 0 1-.96 0z")

ICONS = {
    "plan": ['<rect x="5" y="4" width="14" height="17" rx="2"/>', '<path d="M9 2.5h6v3H9z"/>', '<path d="M8.5 10.5h7M8.5 14h7M8.5 17.5h4"/>'],
    "award": ['<circle cx="12" cy="9" r="6"/>', '<path d="M8.5 14 7 22l5-3 5 3-1.5-8"/>'],
    "card": ['<rect x="2.5" y="5" width="19" height="14" rx="2"/>', '<path d="M2.5 10h19M6 15h4"/>'],
    "clock": ['<circle cx="12" cy="12" r="9.5"/>', '<path d="M12 7v5l3.5 2"/>'],
    "heart": ['<path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7z"/>'],
    "bonding": [f'<path d="{TOOTH}"/>', '<path d="M8 7.2c1.1.6 2.5.9 4 .9s2.9-.3 4-.9"/>'],
    "veneers": ['<path d="M12.8 2.2a2 2 0 0 0-1.6 0L2.6 6.1a1 1 0 0 0 0 1.8l8.6 3.9a2 2 0 0 0 1.6 0l8.6-3.9a1 1 0 0 0 0-1.8z"/>',
                '<path d="m2.5 12 8.7 3.9a2 2 0 0 0 1.6 0l8.7-3.9"/>', '<path d="m2.5 17 8.7 3.9a2 2 0 0 0 1.6 0l8.7-3.9"/>'],
    "whitening": [f'<path d="{SPARK}"/>', '<path d="M20 2.5v4M22 4.5h-4"/>'],
    "aligners": ['<path d="M3.5 7c0 7 3.8 12 8.5 12s8.5-5 8.5-12"/>', '<path d="M7.5 7c0 4.7 2 8 4.5 8s4.5-3.3 4.5-8"/>', '<path d="M3.5 7h4M16.5 7h4"/>'],
    "droplet": ['<path d="M12 2.7S6 9.1 6 14a6 6 0 0 0 12 0c0-4.9-6-11.3-6-11.3z"/>', '<path d="M9.5 14.5a2.5 2.5 0 0 0 2.5 2.5"/>'],
    "air": ['<path d="M12.8 19.6A2 2 0 1 0 14 16H2"/>', '<path d="M17.5 8a2.5 2.5 0 1 1 2 4H2"/>', '<path d="M9.8 4.4A2 2 0 1 1 11 8H2"/>'],
    "smile": ['<circle cx="12" cy="12" r="9.5"/>', '<path d="M8 14s1.5 2 4 2 4-2 4-2"/>', '<path d="M9 9.5h.01M15 9.5h.01"/>'],
    "doctor": ['<circle cx="12" cy="7.5" r="4"/>', '<path d="M4.5 21c0-4.1 3.4-7.5 7.5-7.5s7.5 3.4 7.5 7.5"/>', '<path d="M12 16.5v3M10.5 18h3"/>'],
    "pin": ['<path d="M20 10c0 5-5.5 10.2-7.4 11.8a1 1 0 0 1-1.2 0C9.5 20.2 4 15 4 10a8 8 0 0 1 16 0"/>', '<circle cx="12" cy="10" r="3"/>'],
    "star": ['<path d="M11.5 2.3a.5.5 0 0 1 1 0l2.3 4.7a2.1 2.1 0 0 0 1.6 1.2l5.2.7a.5.5 0 0 1 .3.9l-3.8 3.7a2.1 2.1 0 0 0-.6 1.9l.9 5.1a.5.5 0 0 1-.8.6l-4.6-2.4a2.1 2.1 0 0 0-2 0L6.4 21a.5.5 0 0 1-.8-.6l.9-5.1a2.1 2.1 0 0 0-.6-1.9L2.2 9.8a.5.5 0 0 1 .3-.9l5.2-.7a2.1 2.1 0 0 0 1.6-1.2z"/>'],
    "calendar": ['<rect x="3" y="4.5" width="18" height="17" rx="2"/>', '<path d="M16 2.5v4M8 2.5v4M3 10h18"/>', '<path d="m9 15.5 2 2 4-4"/>'],
    "target": ['<circle cx="12" cy="12" r="9.5"/>', '<circle cx="12" cy="12" r="5.5"/>', '<circle cx="12" cy="12" r="1.5"/>'],
    "shield": ['<path d="M20 13c0 5-3.5 7.5-7.7 9a1 1 0 0 1-.6 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.2-2.7a1.2 1.2 0 0 1 1.6 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1z"/>',
               '<path d="m9 12 2 2 4-4"/>'],
    "timer": ['<path d="M10 2h4M12 14l3-3"/>', '<circle cx="12" cy="14" r="8"/>'],
}


def icon(name, color, size=40, stroke=1.5):
    sw = stroke * 24 / size
    return (f'<svg data-name="Icon / {name}" width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" stroke="{color}" '
            f'stroke-width="{sw:.2f}" stroke-linecap="round" stroke-linejoin="round" style="flex:none;display:block">{"".join(ICONS[name])}</svg>')
