/**
 * Squat Success — Meta ad copy for The Dental Freedom Blueprint (free + postage book funnel).
 *
 *   node --env-file=.env.local --import tsx/esm \
 *     scripts/reports/squat-success-ad-copy.ts
 *
 * Emits the sheet payload (data/squat-success-meta-ad-copy.json) and the markdown
 * record (outputs/ad-copy/squat-success-meta-<date>.md). The sheet itself is built
 * by squat-ad-copy-sheet.ts from that payload.
 *
 * House rules applied here:
 *   - Long-form direct response structure: hook, proof stack, offer reveal, pain list,
 *     desire run, repeated CTA, origin story, "why free" handler, specifics, P.S. block.
 *   - No em dashes in client-facing copy.
 *   - No invented numbers. Every figure traces to book.squatsuccess.co.uk or the
 *     Br Dent J 2025 stat printed on creative 2e. Anything we would like but do not
 *     have sits on the To Confirm tab instead of being guessed.
 *   - Pain lists use "if you are sick of" framing, never "you are", to stay the right
 *     side of Meta's personal attributes policy.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';

const DATE = '2026-09-17';
const LP = 'book.squatsuccess.co.uk';
const DEST = 'https://book.squatsuccess.co.uk/';
// Drive manifest written by squat-upload-creatives.ts. Absent on a first run,
// in which case the Creative Map falls back to file stems and no preview column.
interface Assets {
  folderId: string;
  folderUrl: string;
  files: Record<string, string>;
}
const ASSETS_PATH = 'data/squat-success-creative-assets.json';
const ASSETS: Assets | null = existsSync(ASSETS_PATH)
  ? (JSON.parse(readFileSync(ASSETS_PATH, 'utf-8')) as Assets)
  : null;

/** The feed export for a creative, whichever ratio that set was cut at. */
function feedFileId(stem: string): string | null {
  if (!ASSETS) return null;
  const name = Object.keys(ASSETS.files).find((f) => f.startsWith(`${stem}_feed-`));
  return name ? ASSETS.files[name] : null;
}

/** The true 1:1 export. */
function squareFileId(stem: string): string | null {
  if (!ASSETS) return null;
  const name = Object.keys(ASSETS.files).find((f) => f === `${stem}_feed-1080x1080.png`);
  return name ? ASSETS.files[name] : null;
}

const RATIO_LABELS: Record<string, string> = {
  '1080x1080': 'Square 1x1',
  '1080x1350': 'Portrait 4x5',
  '1080x1920': 'Story 9x16',
  '1200x628': 'Landscape 1.91x1',
};

/**
 * Read the formats off the manifest rather than hardcoding them, so a re-export
 * that adds or drops a ratio is reflected without anyone having to remember.
 */
function formatsFor(stem: string): string {
  if (!ASSETS) return '';
  const ratios = Object.keys(ASSETS.files)
    .filter((f) => f.startsWith(`${stem}_`))
    .map((f) => f.match(/(\d+x\d+)\.png$/)?.[1])
    .filter((r): r is string => Boolean(r));
  const order = ['1080x1080', '1080x1350', '1080x1920', '1200x628'];
  return order
    .filter((r) => ratios.includes(r))
    .map((r) => RATIO_LABELS[r])
    .join(', ');
}

const SHEET =
  'https://docs.google.com/spreadsheets/d/1yI9SYYsnwUmYbH9XWVcPqj5Y9cnfBhEVkk8DstRROhM/edit';

// --- Copy blocks -------------------------------------------------------------

interface Block {
  ref: string;
  angle: string;
  stage: string;
  hookType: string;
  primary: string;
  headline: string;
  altHeadlines: string[];
  description: string;
  cta: string;
  pairWith: string;
}

const BLOCKS: Block[] = [
  {
    ref: 'SS-01',
    angle: 'Curiosity led: why is he giving it away?',
    stage: 'Cold / prospecting',
    hookType: 'Curiosity gap',
    primary: `There is a reason this book is free, and it is not a generous one.

📖 The Dental Freedom Blueprint. Nine chapters on opening your own dental practice.
🏗️ Written by Dr Bobby Bhandal, who built Avenue Dental from an empty unit as a squat.
🩺 Ten years an associate across NHS and private before he did it.
📦 Printed to order in the UK, with you in 5 to 7 working days.
💷 The book is free. You cover £4.95 postage and nothing else.

👉 ${LP}

So if you are sick of:
🚫 Researching locations on the train home and then doing nothing about it
🚫 Business plan templates downloaded and never finished
🚫 Talking yourself into it and back out of it, again
🚫 Watching a diary someone else built fill with work someone else priced

And you want more.
More say over the week.
More clinical range than a corporate target allows.
More at the end of ten years than another payslip.

Then hit the link and claim your copy.
👉 ${LP}

Here is the honest answer to "why free".

Bobby runs a programme called Squat Success, where he works with dentists through the whole build. The ones who get the most out of it had already decided before they arrived. They were not looking to be convinced, they were looking for a route.

This book is how people decide.

Some will read it and realise ownership is not for them, and save themselves years of "one day". Some will read it and do the entire thing on their own, which is exactly what it was written for. A few will get to the end and want help with the build.

In his words: "I'd rather this book was in a thousand hands than sold to two hundred."

That is the whole thing. You cover the postage because Royal Mail don't work for free.

👉 ${LP}

P.S. Printed to order rather than sat in a warehouse, posted from the UK, UK addresses only for now.
P.P.S. Read it and it isn't useful? Email hello@squatsuccess.co.uk and we refund your postage, no questions.`,
    headline: 'Why is the book free?',
    altHeadlines: [
      'A thousand hands, not two hundred',
      'He posts it for a stamp',
      'Free book. The catch is £4.95.',
    ],
    description: 'Free book, £4.95 postage',
    cta: 'Learn More',
    pairWith: '1a The Offer, 1b The Catch, 1c Printed And Posted, 2f Why Free',
  },
  {
    ref: 'SS-02',
    angle: 'Proof led: borrowed authority (Br Dent J)',
    stage: 'Cold / prospecting',
    hookType: 'Quoted statistic',
    primary: `61% of the UK dental workforce scored high for emotional exhaustion.

That is the British Dental Journal, 2025. Not a LinkedIn post.

Six in ten, in a profession people spend five years and a great deal of money getting into.

Most of the advice aimed at that number is about resilience. Breathing. Boundaries. Saying no to the odd emergency slot.

Very little of it is about the structure of the job itself: that the diary is built by someone else, the targets are set by someone who is not in the room, and at the end of ten years the practice belongs to somebody else.

There is another way to practise, and it has a process.

📖 The Dental Freedom Blueprint. Nine chapters on opening your own practice.
🏗️ By Dr Bobby Bhandal, who built Avenue Dental from an empty unit in Leamington Spa.
🩺 Ten years an associate across NHS and private first, and close to leaving dentistry altogether.
📦 Printed to order in the UK, posted to your door in 5 to 7 working days.
💷 Free. You cover £4.95 postage and nothing else.

👉 ${LP}

So if you are sick of:
🚫 A Sunday evening that starts at four o'clock
🚫 Clinical range narrowing to whatever the target rewards
🚫 Being confident about the dentistry and uncertain about the business
🚫 Saying "one day" and hearing how long you have been saying it

And you want more.
More control.
More range.
More to show for the next ten years than the last ten.

Then hit the link and claim your copy.
👉 ${LP}

Why free? Bobby runs a programme for dentists building squats, and the people who get the most from it had already decided. The book is how people decide. Some readers rule ownership out and save themselves years. Some build the entire thing alone. A few want help at the end.

"I'd rather this book was in a thousand hands than sold to two hundred."

About four hours of reading. Nine chapters. No filler and no textbook theory.
👉 ${LP}

P.S. UK addresses only, printed to order, 5 to 7 working days.
P.P.S. If it isn't useful to you, email hello@squatsuccess.co.uk and the postage comes back, no questions.

Source: Br Dent J, 2025.`,
    headline: 'Six in ten. Br Dent J, 2025.',
    altHeadlines: [
      '61% scored high for exhaustion',
      'There is another way to practise',
      'Not a resilience problem',
    ],
    description: 'Free book, £4.95 postage',
    cta: 'Learn More',
    pairWith: '2e The Stat 61%, 6a Associate Ceiling',
  },
  {
    ref: 'SS-03',
    angle: 'Testimonial led',
    stage: 'Cold / prospecting',
    hookType: 'Quoted result',
    primary: `"Squat Success has been a really valuable asset to me in regard to setting up my squat and helping me along the journey." Dr Aisha, Squat Success member.

Dr Matt put it another way: "Bobby has been absolutely brilliant with helping me through the set up, how to start a practice."

Those are paying members of a programme. This is not that.

This is the book, and the book is free.

📖 The Dental Freedom Blueprint. Nine chapters, from "should I?" to the end of your first twelve months.
🏗️ Written by Dr Bobby Bhandal, who built Avenue Dental from an empty unit in Leamington Spa.
🩺 Ten years an associate across NHS and private before that.
📦 Printed to order in the UK, with you in 5 to 7 working days.
💷 You cover £4.95 postage. Nothing else.

👉 ${LP}

So if you are sick of:
🚫 Business advice from people whose actual job is selling you chairs
🚫 Vague steps that stop right where the money starts
🚫 Wondering what CQC registration really involves, and when it starts
🚫 Not knowing how long a squat takes before it washes its face

And you want more.
More detail.
More order.
More of the numbers nobody puts in the conference talk.

Then hit the link and claim your copy.
👉 ${LP}

Why is it free? Bobby would rather have it in a thousand hands than sold to two hundred. Some readers will decide ownership is not for them. Some will do the whole build alone. A few will want help at the end. All three outcomes are fine by him.

👉 ${LP}

P.S. Printed to order, posted from the UK, 5 to 7 working days. UK addresses only for now.
P.P.S. If it isn't useful, email hello@squatsuccess.co.uk and we refund the postage, no questions.`,
    headline: 'Dr Aisha built hers. Free book.',
    altHeadlines: [
      'From dentists who already did it',
      'The programme costs. This doesn\'t.',
      'Real squats, real numbers',
    ],
    description: 'Free book, £4.95 postage',
    cta: 'Learn More',
    pairWith: '2a Someone Else\'s Dream, 5a Ceiling Hitter',
  },
  {
    ref: 'SS-04',
    angle: 'Anti-ad: name the catch',
    stage: 'Cold / prospecting',
    hookType: 'Pattern interrupt',
    primary: `Yes, this is an ad. Here is the entire catch in one line.

The book is free. The stamp isn't.

You cover £4.95 postage, because Royal Mail don't work for free. No trial, no subscription, nothing that quietly starts billing you in thirty days.

📖 The Dental Freedom Blueprint. Nine chapters on opening your own dental practice.
🏗️ By Dr Bobby Bhandal, who built Avenue Dental from an empty unit in Leamington Spa.
📮 Not a PDF. A parcel.
📦 Printed to order in the UK. With you in 5 to 7 working days.
💷 £4.95, and that is the end of the money.

👉 ${LP}

So if you are sick of:
🚫 "Free" downloads that turn into a fourteen day trial
🚫 Webinars that run ninety minutes and end on a price
🚫 Business advice from suppliers who are really selling equipment
🚫 Being sold to by people who have never opened anything

And you want more.
More plain English.
More actual numbers.
More of the bits that go wrong, written down by someone they went wrong for.

Then hit the link and claim your copy.
👉 ${LP}

The honest reason it is free: Bobby runs a programme for dentists building squats. The ones who get the most from it had already decided before they got there. This book is how people decide. Some read it and rule ownership out. Some do the entire build alone. A few want help.

"I'd rather this book was in a thousand hands than sold to two hundred."

👉 ${LP}

P.S. UK addresses only for now, and each address line needs to stay under 30 characters. That is a printing constraint, not a trick.
P.P.S. Read it and don't rate it? Email hello@squatsuccess.co.uk and the £4.95 comes back, no questions.`,
    headline: '£4.95. That is the whole catch.',
    altHeadlines: [
      'The book is free. The stamp isn\'t.',
      'Not a PDF. A parcel.',
      'No trial, no subscription, ever',
    ],
    description: 'Printed to order in the UK',
    cta: 'Learn More',
    pairWith: '1b The Catch, 1c Printed And Posted, 2b No Catch',
  },
  {
    ref: 'SS-05',
    angle: 'Pain led: the associate ceiling',
    stage: 'Cold / prospecting',
    hookType: 'Bold declaration',
    primary: `Ten years of building an asset you will never own.

That is the associate deal, stated plainly. It is a fair deal and plenty of people are happy in it. This is not for them.

This is for the ones who keep doing the sum.

The diary is built by someone else. The targets are set by someone who is not in the room. The clinical range narrows to whatever the target rewards. And the list you built, the patients who ask for you by name, the goodwill on the phone, none of it is yours. It walks out of the building with the practice when it sells.

The strange part is that the thing stopping you was never ambition.

📖 The Dental Freedom Blueprint. Nine chapters on opening your own practice, in order, with real numbers.
🏗️ Dr Bobby Bhandal built Avenue Dental from an empty unit in Leamington Spa.
🩺 Ten years an associate across NHS and private first, and close to leaving dentistry altogether.
📦 Printed to order in the UK, posted in 5 to 7 working days.
💷 Free. You cover £4.95 postage.

👉 ${LP}

So if you are sick of:
🚫 Researching sites on the train home and then doing nothing
🚫 Half finished business plan templates
🚫 Talking yourself into it and back out of it
🚫 Hearing yourself say "one day" for the ninth year running

And you want more.
More say over the week.
More range than a target allows.
More at the end of ten years than another payslip.

Then hit the link and claim your copy.
👉 ${LP}

Why free: he would rather it was in a thousand hands than sold to two hundred. Some readers decide ownership is not for them and stop spending energy on it, which he counts as a win. Some build the whole thing alone. A few want help.

Four hours of reading. Nine chapters. Costs you a stamp.
👉 ${LP}

P.S. It covers the squat versus buy decision properly, so you can rule one out and stop circling.
P.P.S. If it isn't useful, email hello@squatsuccess.co.uk and we refund the postage, no questions.`,
    headline: 'Ten years. No equity.',
    altHeadlines: [
      'An asset you will never own',
      'Someone else\'s diary, someone else\'s practice',
      'The associate lifestyle has a ceiling',
    ],
    description: 'Free book, £4.95 postage',
    cta: 'Learn More',
    pairWith: '6a Associate Ceiling, 6b Someone Else\'s Diary, 6c Never Own The Asset, 6d Tired Of The Associate Lifestyle',
  },
  {
    ref: 'SS-06',
    angle: 'Content led: the nine chapters',
    stage: 'Cold / prospecting',
    hookType: 'Curiosity gap',
    primary: `Nine chapters on opening your own dental practice. Chapter three is the one that stops people, and it should.

01 Breaking Free
02 A Tale Of Two Dentists
03 The Reality Check
04 Confronting The Fear Factor
05 Decisions That Don't Backfire
06 The Certainty Compass
07 The A-Team Algorithm
08 The Invisible Waiting List
09 The First Twelve Months

Chapter three is the honest financial picture. What you need, what you can borrow, what lenders actually look for, and a self-assessment that tells you whether you are ready now or need twelve more months.

Chapter five names the three infections that keep capable dentists stuck: the Prestige Virus, Quick Fix Fever and Analysis Paralysis Syndrome. Then the Triple-Check Treatment for pressure-testing any big call.

Chapter eight is the Trust Timeline: how to have a queue of patients waiting before the doors open, without paid ads doing the heavy lifting.

Chapter nine is the year nobody warns you about.

👉 ${LP}

So if you are sick of:
🚫 Vague steps that stop right before the hard part
🚫 Advice from suppliers who are really selling kit
🚫 Not knowing when CQC registration actually starts
🚫 Guessing how long it takes before the place washes its face

And you want more.
More order.
More detail.
More of the parts that don't make the conference talk.

Then hit the link and claim your copy.
👉 ${LP}

📖 Written by Dr Bobby Bhandal, who built Avenue Dental from an empty unit in Leamington Spa
🩺 Ten years an associate across NHS and private before that
📦 Printed to order in the UK, with you in 5 to 7 working days
💷 Free. You cover £4.95 postage and nothing else.

Why free: he would rather it was in a thousand hands than sold to two hundred.
👉 ${LP}

P.S. About four hours of reading, start to finish.
P.P.S. If it isn't useful, email hello@squatsuccess.co.uk and the postage comes back, no questions.`,
    headline: 'Nine chapters. No filler.',
    altHeadlines: [
      'Chapter three stops most people',
      'From "should I?" to month twelve',
      'What it actually costs to open',
    ],
    description: 'Free book, £4.95 postage',
    cta: 'Learn More',
    pairWith: '1d What\'s Inside, 2c Table Of Contents, 4a Three Infections, 4b Certainty Compass',
  },
  {
    ref: 'SS-07',
    angle: 'Us versus them: advice without the sales pitch',
    stage: 'Cold / prospecting',
    hookType: 'Pattern interrupt',
    primary: `Most squat advice comes from people who want to sell you the chairs.

The rep is helpful. The rep is also paid on what goes into the surgery. The webinar is free because there is a price at the end of it. The conference talk is the polished version, with the builder walking off site edited out.

This is the other kind.

A dentist wrote down what actually happened, in order, including the parts that went wrong.

Typical squat advice → from suppliers selling kit
The Dental Freedom Blueprint → from a dentist who built one

Typical squat advice → paid course
The Dental Freedom Blueprint → free book

Typical squat advice → vague steps
The Dental Freedom Blueprint → nine chapters, in order

👉 ${LP}

So if you are sick of:
🚫 Being marketed to by people who have never signed a lease
🚫 "It depends" as the answer to every financial question
🚫 Case studies with the hard year taken out
🚫 Paying for a course just to find out whether you want to do this at all

And you want more.
More honesty.
More sequence.
More of the bits nobody puts on a slide.

Then hit the link and claim your copy.
👉 ${LP}

Dr Bobby Bhandal nearly got thrown out of dental school and will happily tell you about it. He worked as an associate for ten years across NHS and private, found the routine demoralising enough to consider leaving dentistry, then built the practice he had wanted to work in and could not find. Avenue Dental opened as a squat, through a builder walking off site, a CQC process he would rather forget, and a stretch of months where he was not at all sure it would work.

It worked. The book says how, including the bits that didn't.

📦 Printed to order in the UK, 5 to 7 working days.
💷 Free. £4.95 postage, nothing else.
👉 ${LP}

P.S. No subscription, ever.
P.P.S. If it isn't useful, email hello@squatsuccess.co.uk and we refund the postage, no questions.`,
    headline: 'Advice without the sales pitch',
    altHeadlines: [
      'He has no kit to sell you',
      'The parts that don\'t make the talk',
      'Written by a dentist who built one',
    ],
    description: 'Free book, £4.95 postage',
    cta: 'Learn More',
    pairWith: '2d Us Vs Them, 4e Not In The Conference Talk',
  },
  {
    ref: 'SS-08',
    angle: 'Persona: UDA heavy / NHS associate',
    stage: 'Cold / persona targeted',
    hookType: 'Bold declaration',
    primary: `Your targets were set by someone who is not in the room.

That is not a complaint about the NHS. It is a description of the structure. Somebody who has never met your patients decided how many units the year needs, and the year does not care that Thursday ran over or that the last four were complex.

Bobby worked ten years across NHS and private before he built his own private squat. He found the routine demoralising enough that he seriously considered leaving dentistry altogether.

Then he wrote down the route out.

📖 The Dental Freedom Blueprint. Nine chapters, from "should I?" to the end of your first twelve months.
🏗️ Avenue Dental, Leamington Spa. An empty unit when he signed the lease.
📦 Printed to order in the UK, with you in 5 to 7 working days.
💷 Free. You cover £4.95 postage.

👉 ${LP}

So if you are sick of:
🚫 A number somebody else picked deciding how the year goes
🚫 Clinical range narrowing to whatever the target rewards
🚫 Wondering whether a private squat is realistic or a fantasy
🚫 Saying "one day" and hearing how long you have been saying it

And you want more.
More control of the diary.
More of the dentistry you actually trained for.
More to show at the end than another year of units.

Then hit the link and claim your copy.
👉 ${LP}

Chapter 1 is his story in full, including the parts that do not make the conference talk. Chapter 3 is the honest financial picture, with a self-assessment that tells you whether you are ready now or need twelve more months. Chapter 6 is the three decisions that settle almost everything: business model, location, timing.

Why free? He would rather it was in a thousand hands than sold to two hundred.
👉 ${LP}

P.S. If ownership turns out not to be for you, the book will tell you that too, and you will have saved yourself years.
P.P.S. If it isn't useful, email hello@squatsuccess.co.uk and the £4.95 comes back, no questions.`,
    headline: 'The route out, in nine chapters',
    altHeadlines: [
      'Ten years NHS and private, then this',
      'Set by someone not in the room',
      'A private squat, realistically',
    ],
    description: 'Free book, £4.95 postage',
    cta: 'Learn More',
    pairWith: '5b Persona NHS Escapee',
  },
  {
    ref: 'SS-09',
    angle: 'Persona: the late starter',
    stage: 'Cold / persona targeted',
    hookType: 'Quoted result',
    primary: `"One day" has been one day for nine years.

Not because of a lack of ambition. Locations get researched on the train home. Business plan templates get downloaded and never finished. The decision gets talked into and back out of, more than once.

People stop not because they are not capable, but because nobody has laid out what actually happens, in order, with real numbers.

So here it is, in nine chapters, free.

👉 ${LP}

Chapter 3 is a self-assessment. It answers one question and it answers it honestly: ready now, or twelve months of work first.

Do you know your numbers?
Do you know where you would open?
Do you know who you would hire?

Three noes is not a failure. It is a list.

📖 The Dental Freedom Blueprint by Dr Bobby Bhandal
🏗️ He built Avenue Dental from an empty unit in Leamington Spa
🩺 Ten years an associate across NHS and private first
📦 Printed to order in the UK, 5 to 7 working days to your door
💷 Free. You cover £4.95 postage and nothing else.

So if you are sick of:
🚫 Circling the same decision every January
🚫 Not knowing whether squat or buying is the right route
🚫 Advice that stops where the money starts
🚫 Hearing yourself say "one day" out loud

And you want more.
More certainty.
More sequence.
More progress than another year of thinking about it.

Then hit the link and claim your copy.
👉 ${LP}

The book covers the squat versus buy decision properly, so you can rule one out and stop circling. Plenty of readers start later than they meant to.

Why free: he would rather it was in a thousand hands than sold to two hundred.
👉 ${LP}

P.S. About four hours of reading.
P.P.S. If it isn't useful, email hello@squatsuccess.co.uk and we refund the postage, no questions.`,
    headline: 'Ready now, or twelve months?',
    altHeadlines: [
      'Nine years of "one day"',
      'Squat or buy. Rule one out.',
      'Plenty of readers start later',
    ],
    description: 'Free book, £4.95 postage',
    cta: 'Learn More',
    pairWith: '5c Persona Late Starter, 4d Ready Now Or Twelve Months',
  },
  {
    ref: 'SS-10',
    angle: 'Persona: site found, lease in progress',
    stage: 'Cold / persona targeted',
    hookType: 'Bold declaration',
    primary: `You are past "should I". The expensive mistakes start here.

Site found. Lease with the solicitor. Somewhere between now and opening day there are four or five decisions that decide whether year two is fun or miserable, and most of them get made in a hurry.

Chapters 6 to 9 are the ones you want.

06 The Certainty Compass. Business model, location, timing. Get these right and the rest is execution.
07 The A-Team Algorithm. How to advertise an opportunity instead of a job, hire A-players consistently, and build a culture people do not leave.
08 The Invisible Waiting List. The Trust Timeline, so there is a queue before the doors open, without paid ads doing the heavy lifting.
09 The First Twelve Months. What happens once the adrenaline fades. Cashflow, staffing wobbles, and the milestones that tell you it is working.

👉 ${LP}

So if you are sick of:
🚫 Advice from suppliers who are really selling you kit
🚫 Reaching opening day with an empty diary as the plan
🚫 Guessing on CQC timing
🚫 Hiring whoever applied rather than who you wanted

And you want more.
More sequence.
More mistakes already paid for by somebody else.
More certainty before you sign.

Then hit the link and claim your copy.
👉 ${LP}

Written by Dr Bobby Bhandal, who built Avenue Dental from an empty unit in Leamington Spa, through a builder walking off site and a CQC process he would rather forget.

📦 Printed to order in the UK, 5 to 7 working days.
💷 Free. You cover £4.95 postage.
👉 ${LP}

P.S. Plenty of readers are mid-build. The material runs through the first year of trading, so there is a lot left that applies.
P.P.S. If it isn't useful, email hello@squatsuccess.co.uk and we refund the postage, no questions.`,
    headline: 'Chapters 6 to 9, mid-build',
    altHeadlines: [
      'Past "should I". Now get it right.',
      'Dodge the expensive mistakes',
      'Model, location, timing',
    ],
    description: 'Free book, £4.95 postage',
    cta: 'Learn More',
    pairWith: '5d Persona Committed Builder',
  },
  {
    ref: 'SS-11',
    angle: 'Persona: open, and still quiet',
    stage: 'Cold / persona targeted',
    hookType: 'Bold declaration',
    primary: `You opened. The diary didn't fill.

Nobody warns you about this bit. The fit-out is finished, the sign is up, the team are stood there, and the phone is quieter than the business plan said it would be. It is the most expensive silence in dentistry.

Two chapters are about exactly this.

Chapter 8, The Invisible Waiting List. The Trust Timeline and the Personal Brand Blueprint: how to build a queue of patients who already trust you, without paid ads doing the heavy lifting. It is written for before opening day, and it works after.

Chapter 9, The First Twelve Months. What actually happens once the adrenaline fades and the real business begins. Cashflow, staffing wobbles, and the milestones that tell you it is working.

👉 ${LP}

So if you are sick of:
🚫 Looking at a half empty diary and doing the maths on the lease
🚫 Marketing advice that starts and ends with "run some ads"
🚫 Nobody telling you what year one is meant to look like
🚫 Feeling like the only person this has happened to

And you want more.
More demand you own rather than rent.
More of a plan for the next quarter.
More sleep.

Then hit the link and claim your copy.
👉 ${LP}

📖 The Dental Freedom Blueprint, by Dr Bobby Bhandal
🏗️ He built Avenue Dental from an empty unit in Leamington Spa, through months where he was not at all sure it would work
📦 Printed to order in the UK, with you in 5 to 7 working days
💷 Free. You cover £4.95 postage and nothing else.
👉 ${LP}

P.S. It worked. The book says how, including the bits that didn't.
P.P.S. If it isn't useful, email hello@squatsuccess.co.uk and the postage comes back, no questions.`,
    headline: 'Open, and still quiet',
    altHeadlines: [
      'The diary didn\'t fill',
      'The most expensive silence',
      'Chapters 8 and 9 are for you',
    ],
    description: 'Free book, £4.95 postage',
    cta: 'Learn More',
    pairWith: '5e Persona Struggling New Owner, 4c Invisible Waiting List',
  },
];

// --- Short form, retargeting -------------------------------------------------

interface Variant {
  ref: string;
  use: string;
  primary: string;
  headline: string;
  description: string;
  cta: string;
  creative: string;
}

const VARIANTS: Variant[] = [
  {
    ref: 'SF-01',
    use: 'Short form: Stories and Reels 9x16, any creative',
    primary: `"I'd rather this book was in a thousand hands than sold to two hundred."

That is why The Dental Freedom Blueprint is free. You cover the £4.95 stamp.

👉 Claim your copy at ${LP}`,
    headline: 'Why is the book free?',
    description: 'Free book, £4.95 postage',
    cta: 'Learn More',
    creative: 'Story 9x16 of 2f Why Free, or any story cut',
  },
  {
    ref: 'SF-02',
    use: 'Short form: pain hook, pairs with set 6',
    primary: `Ten years of building an asset you will never own.

There is a nine chapter alternative. It is free, you cover the £4.95 postage.

👉 Get your copy at ${LP}`,
    headline: 'Ten years. No equity.',
    description: 'Free book, £4.95 postage',
    cta: 'Learn More',
    creative: 'Story 9x16 of 6a, 6b, 6c or 6d',
  },
  {
    ref: 'SF-03',
    use: 'Short form: offer hook, pairs with set 1',
    primary: `The book is free. The stamp isn't.

£4.95 and it is printed to order and posted to your door in 5 to 7 working days. No subscription, ever.

👉 Send me my copy: ${LP}`,
    headline: 'The book is free. The stamp isn\'t.',
    description: 'Not a PDF. A parcel.',
    cta: 'Learn More',
    creative: 'Story 9x16 of 1b The Catch or 1c Printed And Posted',
  },
  {
    ref: 'SF-04',
    use: 'Short form: stat hook, pairs with 2e',
    primary: `61% of the UK dental workforce scored high for emotional exhaustion. (Br Dent J, 2025)

There is another way to practise, and it is written down.

👉 Free book at ${LP}`,
    headline: 'Six in ten. Br Dent J, 2025.',
    description: 'Free book, £4.95 postage',
    cta: 'Learn More',
    creative: 'Story 9x16 of 2e The Stat 61%',
  },
  {
    ref: 'SF-05',
    use: 'Short form: contents hook, pairs with 2c and 1d',
    primary: `Nine chapters. From "should I?" to the end of your first twelve months.

Free. You cover the postage.

👉 Claim your copy at ${LP}`,
    headline: 'Nine chapters. No filler.',
    description: 'Free book, £4.95 postage',
    cta: 'Learn More',
    creative: 'Story 9x16 of 2c Table Of Contents or 1d What\'s Inside',
  },
  {
    ref: 'RT-01',
    use: 'Retargeting: visited, did not convert. Kills the cost objection.',
    primary: `You had a look at the book and didn't order it.

If we had to guess, it was the £4.95.

Not because £4.95 is a lot. Because paying anything for a "free" book feels like the start of something. A trial. A subscription. A list you cannot get off.

It isn't. The £4.95 is postage. Royal Mail don't work for free, and the book is printed to order rather than sat in a warehouse. There is no second charge and no subscription, ever.

Why it is free at all: Bobby runs a programme for dentists building squats. The ones who get the most from it had already decided before they arrived. This book is how people decide. Some read it and rule ownership out. Some build the whole thing alone. A few want help at the end. All three are fine by him.

"I'd rather this book was in a thousand hands than sold to two hundred."

Don't tell yourself you will come back to it later. That is what "one day" is made of.

👉 ${LP}

Read it and it isn't useful? Email hello@squatsuccess.co.uk and we refund the £4.95, no questions. You keep the book.`,
    headline: 'It really is just the postage',
    description: 'Refunded if it isn\'t useful',
    cta: 'Get Offer',
    creative: 'RT-a Just The Postage (built: 1x1, 4x5, 9x16). See RT Creative Briefs.',
  },
  {
    ref: 'RT-02',
    use: 'Retargeting: visited, did not convert. Kills the time objection.',
    primary: `Didn't order the book?

If it wasn't the postage, it was probably time. Fair enough. Nobody is short of things to read.

It is about four hours, and it is a paperback rather than another tab left open. It arrives in 5 to 7 working days, printed to order in the UK, and it sits on the side until a quiet evening.

Worst case, you close it knowing for certain that practice ownership is not for you, and you stop spending energy on a "one day" that was never going to happen.

Best case, you are reading the instructions for the next ten years of your career.

👉 ${LP}

Free book. £4.95 postage. No subscription, ever. Postage refunded if it isn't useful.`,
    headline: 'Four hours, worst case',
    description: 'Free book, £4.95 postage',
    cta: 'Get Offer',
    creative: 'RT-b Four Hours (built: 1x1, 4x5, 9x16). See RT Creative Briefs.',
  },
  {
    ref: 'RT-03',
    use: 'Retargeting: form abandoners (started the address step)',
    primary: `You got as far as the address and stopped.

Two things people hesitate on at that point, so here they are straight.

The £4.95 is postage and it is the only charge. No trial, no subscription, nothing that starts billing later.

The address lines need to stay under 30 characters each, because the printer's label format says so. That is the only reason the form is fussy about it.

UK addresses only for now. Printed to order, posted from the UK, with you in 5 to 7 working days.

👉 Finish it here: ${LP}

If the book isn't useful when it lands, email hello@squatsuccess.co.uk and we refund the postage, no questions.`,
    headline: 'You were one field away',
    description: 'Finish your order',
    cta: 'Get Offer',
    creative: 'RT-c One Field Away (built: 1x1, 4x5, 9x16). Form-abandon audience only, never a broad ad set.',
  },
];

// --- Retargeting creative briefs ---------------------------------------------

interface Brief {
  ref: string;
  file: string;
  block: string;
  angle: string;
  headline: string;
  subline: string;
  ctaBar: string;
  visual: string;
  formats: string;
  notes: string;
}

const BRIEFS: Brief[] = [
  {
    ref: 'RT-a Just The Postage',
    file: 'RT-a-just-the-postage',
    block: 'RT-01',
    angle:
      'Kills the cost objection before the copy has to. The hesitation is not that £4.95 is a lot, it is that paying anything for a free book feels like the opening move of a subscription. An itemised bill answers that faster than a sentence can, because it shows the zeroes.',
    headline: 'Here is the whole bill.',
    subline:
      'Receipt block is the hero element, set in the gold accent on the dark canvas:\n\nThe Dental Freedom Blueprint     £0.00\nUK postage                       £4.95\nSubscription                     £0.00\nAnything later                   £0.00\n________________________________\nTotal                            £4.95\n\nUnder the rule: Postage refunded if the book is not useful.',
    ctaBar: 'Send me my free copy →',
    visual:
      'Dark canvas, no photography. The receipt is the image. Monospaced or tabular figures with leader dots so it reads as a bill rather than a feature list. Book render small, bottom right, so the receipt keeps the weight. Eyebrow top right in letterspaced gold caps: STILL DECIDING?',
    formats: '1080x1080, 1080x1350, 1080x1920',
    notes:
      'Every figure on this creative must match the funnel exactly. If postage ever changes, this creative is the first thing to pull. Do not add a struck-through RRP, because the book has no published retail price.',
  },
  {
    ref: 'RT-b Four Hours',
    file: 'RT-b-four-hours',
    block: 'RT-02',
    angle:
      'For the people who did not balk at the money. Time is the real objection and it is a fair one, so the creative does not argue with it, it reprices it. Four hours against the decision it informs is a trade that answers itself.',
    headline: 'Four hours now, or another year of wondering.',
    subline:
      'Nine chapters. It arrives as a paperback, not another tab you leave open.',
    ctaBar: 'Send me my free copy →',
    visual:
      'The only warm, domestic frame in the set, and that contrast is the point. The book closed on a side table in evening lamp light, a mug beside it, out of focus room behind. No practice, no scrubs, no teeth. It has to look like the end of a day rather than more work. Eyebrow top right: FOUR HOURS.',
    formats: '1080x1080, 1080x1350, 1080x1920',
    notes:
      'Four hours is the landing page\'s own figure, so it stays as written. No reading-speed or completion claims beyond it.',
  },
  {
    ref: 'RT-c One Field Away',
    file: 'RT-c-one-field-away',
    block: 'RT-03',
    angle:
      'The narrowest and most valuable audience: people who reached the address step and stopped. Two frictions cause it, and both are mechanical rather than emotional. Name them on the creative and the ad does the support job the form could not.',
    headline: 'One field away.',
    subline:
      'Each address line needs to be under 30 characters. That is the printer\'s label format, not a catch.',
    ctaBar: 'Finish my order →',
    visual:
      'Cream canvas, so it reads as a different moment from the dark prospecting set. A parcel address label, partly filled, recipient line blank with a cursor sitting in it. Or the book in an open padded envelope with the label not yet written. Physical and close up. The book render can be omitted here, because the parcel is the book.',
    formats: '1080x1080, 1080x1350, 1080x1920',
    notes:
      'Only ever served to the form-abandon audience. It makes no sense to anyone who has not seen the form, so exclude it from every broad or prospecting ad set.',
  },
];

// --- Creative map ------------------------------------------------------------

interface Creative {
  ref: string;
  set: string;
  name: string;
  onCreative: string;
  formats: string;
  file: string;
  block: string;
}

const CREATIVES: Creative[] = [
  { ref: '1a', set: '1 Offer', name: 'The Offer', onCreative: 'A free book for dentists who keep saying "one day."', formats: 'Feed 1x1, Landscape 1.91x1, Story 9x16', file: '1a-the-offer', block: 'SS-01' },
  { ref: '1b', set: '1 Offer', name: 'The Catch', onCreative: 'The book is free. The stamp isn\'t.', formats: 'Feed 1x1, Landscape 1.91x1, Story 9x16', file: '1b-the-catch', block: 'SS-04' },
  { ref: '1c', set: '1 Offer', name: 'Printed And Posted', onCreative: 'We\'ll post you the book. You cover the stamp.', formats: 'Feed 1x1, Landscape 1.91x1, Story 9x16', file: '1c-printed-and-posted', block: 'SS-04' },
  { ref: '1d', set: '1 Offer', name: 'What\'s Inside', onCreative: 'What it actually costs to open a squat, with the real numbers.', formats: 'Feed 1x1, Landscape 1.91x1, Story 9x16', file: '1d-whats-inside', block: 'SS-06' },
  { ref: '2a', set: '2 Offer + proof', name: 'Someone Else\'s Dream', onCreative: 'Every patient you see builds someone else\'s practice.', formats: 'Feed 4x5, Story 9x16', file: '2a-someone-elses-dream', block: 'SS-05' },
  { ref: '2b', set: '2 Offer + proof', name: 'No Catch', onCreative: 'A free book. No catch. Seriously.', formats: 'Feed 4x5, Story 9x16', file: '2b-no-catch', block: 'SS-04' },
  { ref: '2c', set: '2 Offer + proof', name: 'Table Of Contents', onCreative: '9 chapters. From "should I?" to your first 12 months.', formats: 'Feed 4x5, Story 9x16', file: '2c-table-of-contents', block: 'SS-06' },
  { ref: '2d', set: '2 Offer + proof', name: 'Us Vs Them', onCreative: 'Squat advice, without the sales pitch.', formats: 'Feed 4x5, Story 9x16', file: '2d-us-vs-them', block: 'SS-07' },
  { ref: '2e', set: '2 Offer + proof', name: 'The Stat 61%', onCreative: '61% of the UK dental workforce scored high for emotional exhaustion. (Br Dent J, 2025)', formats: 'Feed 4x5, Story 9x16', file: '2e-the-stat-61pc', block: 'SS-02' },
  { ref: '2f', set: '2 Offer + proof', name: 'Why Free', onCreative: '"I\'d rather this book was in a thousand hands than sold to two hundred." Dr Bobby Bhandal', formats: 'Feed 4x5, Story 9x16', file: '2f-why-free', block: 'SS-01' },
  { ref: '4a', set: '4 Book content', name: 'Three Infections', onCreative: 'Three infections keep good dentists stuck.', formats: 'Feed 4x5, Story 9x16', file: '4a-three-infections', block: 'SS-06' },
  { ref: '4b', set: '4 Book content', name: 'Certainty Compass', onCreative: 'Three decisions settle almost everything.', formats: 'Feed 4x5, Story 9x16', file: '4b-certainty-compass', block: 'SS-06' },
  { ref: '4c', set: '4 Book content', name: 'Invisible Waiting List', onCreative: 'There is a way to open with a queue already waiting.', formats: 'Feed 4x5, Story 9x16', file: '4c-invisible-waiting-list', block: 'SS-11' },
  { ref: '4d', set: '4 Book content', name: 'Ready Now Or Twelve Months', onCreative: 'Ready now, or twelve months from now?', formats: 'Feed 4x5, Story 9x16', file: '4d-ready-now-or-twelve-months', block: 'SS-09' },
  { ref: '4e', set: '4 Book content', name: 'Not In The Conference Talk', onCreative: 'The parts that don\'t make the conference talk.', formats: 'Feed 4x5, Story 9x16', file: '4e-not-in-the-conference-talk', block: 'SS-07' },
  { ref: '5a', set: '5 Persona', name: 'Ceiling Hitter', onCreative: 'Your book is full. Your split hasn\'t moved.', formats: 'Feed 4x5, Story 9x16', file: '5a-persona-ceiling-hitter', block: 'SS-05' },
  { ref: '5b', set: '5 Persona', name: 'NHS Escapee', onCreative: 'Your targets were set by someone who isn\'t in the room.', formats: 'Feed 4x5, Story 9x16', file: '5b-persona-nhs-escapee', block: 'SS-08' },
  { ref: '5c', set: '5 Persona', name: 'Late Starter', onCreative: '"One day" has been one day for nine years.', formats: 'Feed 4x5, Story 9x16', file: '5c-persona-late-starter', block: 'SS-09' },
  { ref: '5d', set: '5 Persona', name: 'Committed Builder', onCreative: 'You\'re past "should I". Now don\'t get it wrong.', formats: 'Feed 4x5, Story 9x16', file: '5d-persona-committed-builder', block: 'SS-10' },
  { ref: '5e', set: '5 Persona', name: 'Struggling New Owner', onCreative: 'You opened. The diary didn\'t fill.', formats: 'Feed 4x5, Story 9x16', file: '5e-persona-struggling-new-owner', block: 'SS-11' },
  { ref: '6a', set: '6 Pain hook', name: 'Associate Ceiling', onCreative: 'The associate lifestyle has a ceiling.', formats: 'Feed 4x5, Story 9x16', file: '6a-associate-ceiling', block: 'SS-05' },
  { ref: '6b', set: '6 Pain hook', name: 'Someone Else\'s Diary', onCreative: 'Someone else\'s diary. Someone else\'s practice.', formats: 'Feed 4x5, Story 9x16', file: '6b-someone-elses-diary', block: 'SS-05' },
  { ref: '6c', set: '6 Pain hook', name: 'Never Own The Asset', onCreative: 'Ten years of building an asset you\'ll never own.', formats: 'Feed 4x5, Story 9x16', file: '6c-never-own-the-asset', block: 'SS-05' },
  { ref: '6d', set: '6 Pain hook', name: 'Tired Of The Associate Lifestyle', onCreative: 'Tired of the associate lifestyle?', formats: 'Feed 4x5, Story 9x16', file: '6d-tired-of-the-associate-lifestyle', block: 'SS-05' },
];

// --- To confirm --------------------------------------------------------------

const CONFIRM: string[][] = [
  [
    'Proof stack numbers',
    'The proof bullets in every block are built only from what the landing page states. A direct response proof stack is stronger with hard numbers, and we have none that are substantiated.',
    'From Bobby: how many dentists have been through Squat Success, how many practices have opened, how many copies of the book have been posted, and any review count or rating. Each one needs to be a figure he is happy to have challenged.',
  ],
  [
    'Book specifics',
    'The template calls for "just X pages of street-tested, no-fluff content". We know the book is nine chapters and roughly four hours of reading, and nothing else.',
    'Page count, and whether there is a stated retail price anywhere (Amazon or otherwise) that we can anchor the free offer against.',
  ],
  [
    'Scarcity line',
    'The P.S. block in the template uses "only X copies left". We have deliberately not written one, because the book is printed to order, which makes a copy limit untrue.',
    'Confirm whether there is any genuine limit (a print run, a monthly postage budget, a campaign end date). If there is not, the P.S. stays as despatch terms and the refund, which is what is written now.',
  ],
  [
    'Bonuses',
    'The template includes "plus X free bonuses worth £Y". Nothing on the funnel offers bonuses.',
    'Confirm whether anything ships or emails alongside the book. If it does, it belongs in the offer reveal block.',
  ],
  [
    'Post-purchase upsell',
    'Deliberately not written. The upsell template needs a real price, a real discount and a real deadline, and inventing any of those is both dishonest and a compliance problem.',
    'The offer that follows the book order: what it is, list price, welcome price, what is included, and whether the deadline is genuine and enforced.',
  ],
  [
    'Income and earnings claims',
    'No block contains an earnings claim, a revenue figure or a return on investment claim, so none currently needs a disclaimer.',
    'If Bobby wants earnings or practice value figures added, they need substantiation and a typicality disclaimer before they go anywhere near an ad.',
  ],
  [
    'RT-c audience exclusion',
    'RT-c One Field Away is built and says "one field away" on the artwork. It only makes sense to someone who reached the address step of the form, and reads as a non sequitur to anyone else.',
    'Confirm it is bound to the form-abandon audience only and excluded from every broad and prospecting ad set before RT-03 goes live.',
  ],
  [
    'Set 1 has no 4x5',
    'Sets 2, 4, 5, 6 and the RT set are built at 1x1, 4x5 and 9x16. Set 1 (1a to 1d) is 1x1, 9x16 and 1.91x1 instead, so it is the only set that cannot serve the 4x5 feed slot.',
    'Confirm whether that is deliberate. If 4x5 is wanted for set 1, those four need re-exporting.',
  ],
  [
    'The missing set 3',
    'The exports run 1, 2, 4, 5 and 6. There is no set 3 in the batch and no source for one anywhere else.',
    'Confirm whether set 3 exists and what it was. If it was the warm or retargeting set, it closes the gap above.',
  ],
  [
    'Video for Reels',
    'The short-form blocks are written for Stories and Reels placements, but every export is a static. There is no video in the batch.',
    'Confirm whether Reels video is in scope. If it is, the short-form copy stands as written and the assets need producing.',
  ],
  [
    'Creative folder sharing',
    'The creative folder is link-shared as view-only. That is required rather than cosmetic: Google fetches the =IMAGE thumbnails on the Creative Map without the viewer\'s credentials, so a private file renders as a broken cell for everyone.',
    'Confirm that is acceptable. It can be restricted at any time, at the cost of the previews in this sheet.',
  ],
];

// --- Payload -----------------------------------------------------------------

// One row per creative, with its copy inline. This is the build sheet: whoever
// loads Ads Manager should never have to cross-reference a second tab. Copy is
// repeated across the creatives that share an angle, deliberately.
const BLOCK_BY_REF = new Map(BLOCKS.map((b) => [b.ref, b]));
const VARIANT_BY_REF = new Map(VARIANTS.map((v) => [v.ref, v]));

interface BuildRow {
  ref: string;
  set: string;
  name: string;
  file: string;
  onCreative: string;
  blockRef: string;
}

const BUILD_ROWS: BuildRow[] = [
  ...CREATIVES.map((c) => ({
    ref: c.ref,
    set: c.set,
    name: c.name,
    file: c.file,
    onCreative: c.onCreative,
    blockRef: c.block,
  })),
  {
    ref: 'RT-a',
    set: 'RT Retargeting',
    name: 'Just The Postage',
    file: 'RT-a-just-the-postage',
    onCreative: 'Here is the whole bill.',
    blockRef: 'RT-01',
  },
  {
    ref: 'RT-b',
    set: 'RT Retargeting',
    name: 'Four Hours',
    file: 'RT-b-four-hours',
    onCreative: 'Four hours now, or another year of wondering.',
    blockRef: 'RT-02',
  },
  {
    ref: 'RT-c',
    set: 'RT Retargeting',
    name: 'One Field Away',
    file: 'RT-c-one-field-away',
    onCreative: 'One field away.',
    blockRef: 'RT-03',
  },
];

function copyFor(blockRef: string): {
  primary: string;
  headline: string;
  alts: string;
  description: string;
  cta: string;
  angle: string;
} {
  const block = BLOCK_BY_REF.get(blockRef);
  if (block) {
    return {
      primary: block.primary,
      headline: block.headline,
      alts: block.altHeadlines.join('\n'),
      description: block.description,
      cta: block.cta,
      angle: block.angle,
    };
  }
  const variant = VARIANT_BY_REF.get(blockRef);
  if (!variant) throw new Error(`No copy block or variant for ref ${blockRef}`);
  return {
    primary: variant.primary,
    headline: variant.headline,
    alts: '',
    description: variant.description,
    cta: variant.cta,
    angle: variant.use,
  };
}

const payload = {
  build: {
    head: [
      'Ref',
      'Set',
      'Creative Name',
      'Preview (square 1x1)',
      'Formats',
      'Open in Drive',
      'On-creative headline (do not repeat verbatim)',
      'Copy block',
      'Angle',
      'Primary Text',
      'Headline',
      'Headline alternates (rotate)',
      'Description',
      'CTA Button',
      'Destination URL',
    ],
    rows: BUILD_ROWS.map((r) => {
      const sqId = squareFileId(r.file);
      const c = copyFor(r.blockRef);
      return [
        r.ref,
        r.set,
        r.name,
        sqId ? `=IMAGE("https://lh3.googleusercontent.com/d/${sqId}=w500", 1)` : r.file,
        formatsFor(r.file),
        sqId
          ? `=HYPERLINK("https://drive.google.com/file/d/${sqId}/view", "Open file")`
          : r.file,
        r.onCreative,
        r.blockRef,
        c.angle,
        c.primary,
        c.headline,
        c.alts,
        c.description,
        c.cta,
        DEST,
      ];
    }),
    widths: [7, 15, 24, 28, 26, 13, 44, 12, 34, 84, 30, 30, 24, 13, 32],
    frozenCols: 3,
  },
  adcopy: {
    head: [
      'Ref',
      'Angle',
      'Funnel stage',
      'Hook type',
      'Primary Text',
      'Headline',
      'Headline alternates (rotate)',
      'Description',
      'CTA Button',
      'Destination URL',
      'Pair with creatives',
    ],
    rows: BLOCKS.map((b) => [
      b.ref,
      b.angle,
      b.stage,
      b.hookType,
      b.primary,
      b.headline,
      b.altHeadlines.join('\n'),
      b.description,
      b.cta,
      DEST,
      b.pairWith,
    ]),
    widths: [8, 34, 20, 18, 90, 30, 32, 26, 13, 34, 40],
    frozenCols: 2,
  },
  creatives: {
    head: [
      'Ref',
      'Set',
      'Creative Name',
      'Preview (feed)',
      'Preview (square 1x1)',
      'On-creative headline (do not repeat verbatim)',
      'Formats exported',
      'Open in Drive',
      'Copy block',
    ],
    rows: CREATIVES.map((c) => {
      const fileId = feedFileId(c.file);
      const sqId = squareFileId(c.file);
      return [
        c.ref,
        c.set,
        c.name,
        fileId ? `=IMAGE("https://lh3.googleusercontent.com/d/${fileId}=w500", 1)` : c.file,
        sqId
          ? `=IMAGE("https://lh3.googleusercontent.com/d/${sqId}=w500", 1)`
          : 'No 1x1 cut in this batch',
        c.onCreative,
        formatsFor(c.file) || c.formats,
        fileId
          ? `=HYPERLINK("https://drive.google.com/file/d/${fileId}/view", "Open file")`
          : c.file,
        c.block,
      ];
    }),
    widths: [7, 15, 24, 28, 28, 46, 26, 14, 12],
    frozenCols: 3,
  },
  variants: {
    head: ['Ref', 'Use', 'Primary Text', 'Headline', 'Description', 'CTA Button', 'Creative to run it on'],
    rows: VARIANTS.map((v) => [v.ref, v.use, v.primary, v.headline, v.description, v.cta, v.creative]),
    widths: [8, 40, 84, 30, 24, 13, 44],
    frozenCols: 2,
  },
  briefs: {
    head: [
      'Creative ref',
      'For copy block',
      'Preview (square 1x1)',
      'Status',
      'Angle',
      'Headline',
      'Sub-line / on-creative detail',
      'CTA bar',
      'Visual direction',
      'Formats built',
      'Notes',
    ],
    rows: BRIEFS.map((b) => {
      const sqId = squareFileId(b.file);
      const built = formatsFor(b.file);
      return [
        b.ref,
        b.block,
        sqId ? `=IMAGE("https://lh3.googleusercontent.com/d/${sqId}=w500", 1)` : 'Not built yet',
        built ? 'Built' : 'To build',
        b.angle,
        b.headline,
        b.subline,
        b.ctaBar,
        b.visual,
        built || b.formats,
        b.notes,
      ];
    }),
    widths: [22, 13, 28, 11, 56, 32, 44, 22, 56, 26, 46],
    frozenCols: 2,
  },
  confirm: {
    head: ['Item', 'Why it matters', 'What we need from Bobby'],
    rows: CONFIRM,
    widths: [26, 62, 62],
    frozenCols: 1,
  },
  destination: DEST,
  date: DATE,
  creativeFolder: ASSETS?.folderUrl ?? '',
};

// --- Emit --------------------------------------------------------------------

function write(path: string, body: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, body);
  console.log(`wrote ${path}`);
}

write('data/squat-success-meta-ad-copy.json', JSON.stringify(payload, null, 2));

const md = [
  '# Meta Ad Copy: Squat Success',
  '',
  '**Client:** Squat Success (Dr Bobby Bhandal)  ',
  '**Offer:** The Dental Freedom Blueprint, free paperback, reader covers £4.95 UK postage  ',
  '**Objective:** Leads (book orders)  ',
  `**Date:** ${DATE}  `,
  `**Destination:** ${DEST}  `,
  `**Live sheet:** ${SHEET}  `,
  ...(ASSETS ? [`**Creative folder:** ${ASSETS.folderUrl}  `] : []),
  '**Creatives:** 24 concepts, `exports 8` (sets 1, 2, 4, 5, 6)',
  '',
  'Copy is written in long-form direct response structure: hook, proof stack, offer reveal,',
  'pain list, desire run, repeated CTA, origin story, "why free" objection handler, specifics,',
  'and a two-line P.S. block. One copy block per angle, run against the creatives listed,',
  'rather than one rewrite per creative.',
  '',
  '> **No invented figures.** Every number traces to book.squatsuccess.co.uk or the Br Dent J 2025',
  '> stat printed on creative 2e. The proof stacks, scarcity line, bonuses and post-purchase upsell',
  '> the template calls for are on the To Confirm list instead of being guessed.',
  '',
  '---',
  '',
  ...BLOCKS.flatMap((b) => [
    `## ${b.ref} · ${b.angle}`,
    '',
    `**Funnel stage:** ${b.stage}  `,
    `**Hook type:** ${b.hookType}  `,
    `**Pair with:** ${b.pairWith}`,
    '',
    '**Primary Text:**',
    '',
    '```',
    b.primary,
    '```',
    '',
    `**Headline:** ${b.headline} (${b.headline.length} chars)  `,
    `**Headline alternates:** ${b.altHeadlines.join(' · ')}  `,
    `**Description:** ${b.description} (${b.description.length} chars)  `,
    `**CTA Button:** ${b.cta}  `,
    `**Destination:** ${DEST}`,
    '',
    '---',
    '',
  ]),
  '## Short form, retargeting and form abandoners',
  '',
  ...VARIANTS.flatMap((v) => [
    `### ${v.ref} · ${v.use}`,
    '',
    '```',
    v.primary,
    '```',
    '',
    `**Headline:** ${v.headline} (${v.headline.length} chars)  `,
    `**Description:** ${v.description} (${v.description.length} chars)  `,
    `**CTA Button:** ${v.cta}`,
    '',
  ]),
  '---',
  '',
  '## Retargeting creative briefs (to build)',
  '',
  'Design language: match the existing Squat Success set. SQUAT SUCCESS logotype top left,',
  'letterspaced gold eyebrow top right, heavy sans headline with a gold emphasis phrase,',
  'orange CTA pill, "Free book · £4.95 postage" footer. No em dashes on artwork.',
  '',
  ...BRIEFS.flatMap((b) => [
    `### ${b.ref} · for ${b.block}`,
    '',
    `- **Angle:** ${b.angle}`,
    `- **Headline:** ${b.headline}`,
    `- **Sub-line / on-creative detail:**`,
    '',
    '```',
    b.subline,
    '```',
    '',
    `- **CTA bar:** ${b.ctaBar}`,
    `- **Visual:** ${b.visual}`,
    `- **Formats:** ${b.formats}`,
    `- **Notes:** ${b.notes}`,
    '',
  ]),
  '---',
  '',
  '## Creative map',
  '',
  '| Ref | Set | Creative | On-creative headline | Copy block |',
  '|-----|-----|----------|----------------------|------------|',
  ...CREATIVES.map(
    (c) => `| ${c.ref} | ${c.set} | ${c.name} | ${c.onCreative.replace(/\|/g, '\\|')} | ${c.block} |`,
  ),
  '',
  '---',
  '',
  '## To confirm with Bobby before launch',
  '',
  '| Item | Why it matters | What we need |',
  '|------|----------------|--------------|',
  ...CONFIRM.map((r) => `| ${r[0]} | ${r[1]} | ${r[2]} |`),
  '',
].join('\n');

write(`outputs/ad-copy/squat-success-meta-${DATE}.md`, md);
