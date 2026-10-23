"""iMessage-style chat statics for Studio Glide Oxted (Toby, 23 Oct 2026): the original 4a plus four variations.

Each variant: contact name, thread ('in' = friend, grey; 'out' = viewer, blue; 'link' = rich link preview, 9:16 only),
and its own primary text + headline. Offer: First Time Pass, up to 6 classes for £60 in 2 weeks, new clients
(Oxted LP). Facts used in the chats are from the LP: all levels, arrive 10 minutes early to have your reformer set up,
grippy socks, 6 to 8 per class, 50 minutes, Station Road East. No class times are named (timetable not checked).
"""
import importlib.util
from pathlib import Path

_spec = importlib.util.spec_from_file_location('mig', Path(__file__).parent / 'build_migration.py')
_mig = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mig)
A4 = _mig.ADS['4a']

VARIANTS = [
    dict(code='4a iMessage', title='Chat, Discovery', col=5, name='Emma', time='17:56', read='17:58',
         thread=[('in', 'Have you seen the new pilates studio on Station Road East?'),
                 ('out', 'Studio Glide? The reformer place?'),
                 ('in', "That's the one. They do a First Time Pass, 6 classes for £60"),
                 ('link', None),
                 ('out', '6 for £60?? Book us in for Saturday')],
         tall_extra=[('in', 'Already have x')],
         primary=A4['primary'], headline=A4['headline']),

    dict(code='IM2 iMessage', title='Coffee after drop-off (mum)', col=6, name='Sophie', time='08:41', read='08:44',
         thread=[('in', 'Coffee after drop-off tomorrow?'),
                 ('out', "Can't, I've got a reformer class"),
                 ('in', 'Since when do you do pilates??'),
                 ('out', 'Since the new studio opened on Station Road East'),
                 ('out', 'First Time Pass is 6 classes for £60'),
                 ('link', None),
                 ('in', "Ok I'm in. Coffee after class instead?")],
         primary=("Coffee after drop-off, or 50 minutes that are actually yours?\n\n"
                  "Studio Glide is now open on Station Road East, Oxted. Reformer, Mat and Barre, coached for all levels, "
                  "with 6 to 8 people in every class. Classes run from early mornings to evenings, so there's one that fits round the school day.\n\n"
                  "New clients start with the First Time Pass: up to 6 classes for £60, used within 2 weeks.\n\n"
                  "Tap Sign Up and pick your first class on the Oxted timetable. Coffee can wait an hour."),
         headline='6 classes for £60 in Oxted'),

    dict(code='IM3 iMessage', title='Will I be the only beginner (first-timer)', col=7, name='Jess', time='19:12', read='19:20',
         thread=[('out', "Be honest. Will I be the only one who's never done reformer?"),
                 ('in', 'No! Every class is all levels'),
                 ('in', 'Get there 10 mins early and they set your reformer up with you'),
                 ('out', 'And the First Time Pass is really 6 classes for £60?'),
                 ('in', 'Yep. Grippy socks and you’re sorted'),
                 ('link', None),
                 ('out', 'Ok. Booking it now before I talk myself out of it')],
         primary=("Never been on a reformer? Good. Every class here starts you from zero.\n\n"
                  "Arrive 10 minutes early and an instructor sets up your reformer with you. Classes are 6 to 8 people, "
                  "coached for all levels, so you get corrections, not a shout from the front.\n\n"
                  "First Time Pass: up to 6 classes for £60, used within 2 weeks. Reformer, Mat and Barre. New clients only.\n\n"
                  "Tap Sign Up and book your first class on the Oxted timetable, before you talk yourself out of it."),
         headline='Your first class, set up with you'),

    dict(code='IM4 iMessage', title='How are you so calm after work (desk)', col=8, name='Hannah', time='20:03', read='20:05',
         thread=[('in', 'How are you so calm after work lately'),
                 ('out', 'After-work reformer on Station Road East'),
                 ('out', '50 mins, phone in the bag, head finally quiet'),
                 ('in', 'I need that. Is it expensive?'),
                 ('out', 'First Time Pass is 6 classes for £60. So £10 a class'),
                 ('link', None),
                 ('in', 'Booking one this week')],
         primary=("Finish work. Log off. 50 minutes on the reformer.\n\n"
                  "Studio Glide Oxted runs classes from early mornings to evenings, two minutes from the station. One instruction at a time, "
                  "6 to 8 people, an instructor watching your form, and no inbox.\n\n"
                  "First Time Pass: up to 6 classes for £60, which is £10 a class, used within 2 weeks. Reformer, Mat and Barre. New clients only.\n\n"
                  "Tap Sign Up and book an after-work class on the Oxted timetable. They go first."),
         headline='Your after-work reset, £10 a class'),

    dict(code='IM5 iMessage', title='Miss our London class (ex-London)', col=9, name='Mia', time='18:27', read='18:31',
         thread=[('in', 'Do you miss our London reformer class?'),
                 ('out', 'Not anymore. There’s a proper boutique studio in Oxted now'),
                 ('in', 'Like actually London standard?'),
                 ('out', '6 to 8 people, instructors who actually correct you'),
                 ('out', 'And the First Time Pass is 6 classes for £60'),
                 ('link', None),
                 ('in', "Ok I'm jealous. Saving the link")],
         primary=("You used to get the train for a class like this.\n\n"
                  "Studio Glide brings boutique Reformer to Station Road East, two minutes from Oxted station: "
                  "6 to 8 people, 50 minutes, instructors who correct your form as you go. Reformer, Mat and Barre.\n\n"
                  "First Time Pass: up to 6 classes for £60, used within 2 weeks. New clients only.\n\n"
                  "Tap Sign Up and pick your first class on the Oxted timetable. Same standard, shorter commute."),
         headline='Boutique Reformer, now in Oxted'),
]
