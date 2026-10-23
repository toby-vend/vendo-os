"""Rewrite the old Oxted intro offer on the migrated ads (sets 2 to 8) to the current First Time Pass.

Toby, 23 Oct 2026: the main offer on every ad is the 6 class pack. Oxted LP: First Time Pass, up to 6 classes for
£60 within 2 weeks, new clients, 6 to 8 per class. Old ads said 3 classes for £29, intro pack, capped at 10, and some
set 2 ads still had pre-launch lines (priority list, coming August 2026).

Rules run in order on visible text only (never inside tags), on both the artboards and the copy sheet text.
"""
import re

RULES = [
    # specific phrases first
    (r'3[- ]for[- ]£29 intro pack', '6-for-£60 First Time Pass'),
    (r'3[- ]for[- ]£29 intro', '6-for-£60 First Time Pass'),
    (r'intro credit 1 of 3', 'pass credit 1 of 6'),
    (r'Use your 3 intro classes', 'Use your 6 First Time Pass classes'),
    (r'Use three intro classes', 'Use six First Time Pass classes'),
    (r'one payment of £29 for three classes', 'one payment of £60 for six classes'),
    (r'three 50-minute classes for £29', 'six 50-minute classes for £60'),
    (r'Three classes, twenty-nine pounds', 'Six classes, sixty pounds'),
    (r'3 CLASSES @ £9\.67', '6 CLASSES @ £10.00'),
    (r'£9\.67', '£10.00'),
    (r'£29\.00', '£60.00'),
    (r'under a tenner each', '£10 each'),
    (r'under £10 each', '£10 each'),
    (r'Less than £10 a class', '£10 a class'),
    (r'Under £10 a class', '£10 a class'),
    (r'one of each, or three of your favourite', 'two of each, or six of your favourite'),
    (r'three of the one you fall for', 'six of the one you fall for'),
    (r'Or three of one', 'Or six of one'),
    (r'Start with three', 'Start with six'),
    (r'\bThree classes\b', 'Six classes'),
    (r'\bthree classes\b', 'six classes'),
    (r'One payment, 3 classes', 'One payment, 6 classes'),
    (r'Split 3 classes', 'Split 6 classes'),
    # any "3 ... £29" within a short span
    (r'\b3\b(?=[^.\n<]{0,40}£29)', '6'),
    (r'£29\b', '£60'),
    (r'\b3 (classes|Classes|CLASSES)\b', r'6 \1'),
    # founding-membership leftovers and stale counts (23 Oct 2026: Toby confirmed 200+ Google reviews)
    (r'100 classes · £1,200 · first pick of the timetable', '6 classes for £60 · First Time Pass'),
    (r'only 100 places — claim mine TODAY', 'new clients only — booking mine TODAY'),
    (r'\*\*\* ONLY 100 PLACES \*\*\*', '*** NEW CLIENTS ONLY ***'),
    (r'FIRST PICK OF THE TIMETABLE', 'BOOK ON THE OXTED TIMETABLE'),
    (r'first pick of the timetable', 'book up to 3 weeks ahead'),
    (r'DROP-IN EQUIVALENT', 'REFORMER · MAT · BARRE'),
    (r'£66\.00', 'INCLUDED'),
    (r'YOU SAVE', 'USE WITHIN'),
    (r'£1,000\.00', '2 WEEKS'),
    (r'£1,200\.00', '£60.00'),
    (r'\(114\)', '(200+)'),
    (r'\b114 reviews', '200+ reviews'),
    (r'Under a tenner', 'Just a tenner'),
    (r'first month needs\.', 'first two weeks need.'),
    (r'Join the list', 'Get the First Time Pass'),
    # pack naming
    (r'\ban intro pack\b', 'a First Time Pass'),
    (r'\bAn intro pack\b', 'A First Time Pass'),
    (r'INTRO PACK', 'FIRST TIME PASS'),
    (r'\b[Ii]ntro [Pp]ack\b', 'First Time Pass'),
    (r'\b[Ii]ntro offer\b', 'First Time Pass'),
    # class size
    (r'£10 A Classes Capped At Ten\.', '£10 A Class. 6 To 8 Per Class.'),
    (r'Classes Capped At 10\.', 'Classes Of 6 To 8.'),
    (r'keep every class to 10 people', 'keep every class to 6 to 8 people'),
    (r'\b(small class|small group|[Cc]lasses) of 10\b', r'\1 of 6 to 8'),
    (r'\bcapped at (10|ten)\b', 'kept to 6 to 8 people'),
    (r'\bCapped at (10|ten)\b', 'Kept to 6 to 8 people'),
    # pre-launch lines
    (r'Join the priority list', 'Get the First Time Pass'),
    (r'Coming to Oxted, August 2026\.', 'Now open in Oxted.'),
    (r'Coming August 2026\.', 'Now open.'),
    (r"we're coming\.", "we're open."),
    (r'is finally coming to Oxted', 'is finally in Oxted'),
]


def rewrite_text(t):
    for a, b in RULES:
        t = re.sub(a, b, t)
    return t


def rewrite_html(h):
    """Apply the rules to text nodes only. A price-hero numeral "3" that sits as its own text node next to a
    standalone "£29" becomes "6"."""
    standalone_price = re.search(r'>\s*£29\s*<', h) is not None
    def node(m):
        t = m.group(1)
        if standalone_price and t.strip() == '3':
            return '>' + t.replace('3', '6') + '<'
        return '>' + rewrite_text(t) + '<'
    return re.sub(r'>([^<]+)<', node, h)
