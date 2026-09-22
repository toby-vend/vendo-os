/**
 * Squat Success Live (13 and 14 November 2026, Birmingham) — Meta ad copy, mapped
 * onto the short video snippets already approved on Frame.io.
 *
 *   node --env-file=.env.local --import tsx/esm \
 *     scripts/reports/squat-success-event-copy.ts [spreadsheetId]
 *
 * ADDITIVE ON PURPOSE, same as squat-video-tab.ts: this touches one tab
 * ("Event Ads (Nov)") and nothing else. The book funnel tabs are left alone.
 *
 * Scope (Toby, 22/09/2026):
 *   - Short snippets only. The 2:40 / 3:23 testimonial compilations, the two 4:40
 *     Bobby car long-form CTA cuts and the two 33:50 podcast cuts are out.
 *   - No ticket price and no deadline in the copy. Neither is published on the LP
 *     and nothing is invented. Both sit on the To Confirm list in the markdown.
 *
 * House rules applied here (same as the book campaign):
 *   - Long-form direct response: hook, proof stack, offer reveal, pain list,
 *     desire run, CTA repeated through the body, objection handler, logistics, P.S.
 *   - No em dashes in client-facing copy.
 *   - No invented numbers. Every claim traces to the live landing page or to facts
 *     already cleared for the book campaign (Avenue Dental, Leamington Spa, ten
 *     years an associate).
 *   - Pain lists use "if you are sick of" / "if you have been", never "you are",
 *     to stay the right side of Meta's personal attributes policy.
 */
import { config } from 'dotenv';
config({ path: '.env.local', override: true });

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import { mintSheetsAccessToken } from '../../web/lib/google-sheets.js';

const TOKEN_PATH = '.secrets/google-sheets-tokens.json';
if (!process.env.GOOGLE_SHEETS_REFRESH_TOKEN && existsSync(TOKEN_PATH)) {
  const saved = JSON.parse(readFileSync(TOKEN_PATH, 'utf-8')) as { refresh_token?: string };
  if (saved.refresh_token) process.env.GOOGLE_SHEETS_REFRESH_TOKEN = saved.refresh_token;
}

const DATE = '2026-09-22';
const SPREADSHEET = process.argv[2] ?? '1yI9SYYsnwUmYbH9XWVcPqj5Y9cnfBhEVkk8DstRROhM';
const TAB_TITLE = 'Event Ads (Nov)';
const BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

const LP = 'lp.squatsuccess.co.uk';
const DEST = 'https://lp.squatsuccess.co.uk/squat-success-event-november-2026/';

/** Logistics block. Every fact here is printed on the landing page. */
const DETAILS = `📅 Friday 13 and Saturday 14 November 2026
📍 Birmingham
🎟️ One ticket, both days
🧰 Workbooks, templates and tools you can use the moment you get home
🤝 Guest experts on finance, marketing, recruitment and leadership
🍽️ Refreshments and lunch on both days`;

const CTA = `👉 ${LP}`;

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
}

const BLOCKS: Block[] = [
  {
    ref: 'EV-01',
    angle: 'Differentiator: most events teach one half',
    stage: 'Cold / prospecting',
    hookType: 'Pattern interrupt',
    primary: `Most dental business events teach you how to open. Almost none teach you what happens after you do.

Which is odd, because opening is the easy half to talk about and the hard half to live through.

Squat Success Live is two days because the job is two jobs.

📅 Day 1, The Blueprint. Location, niche, funding, feasibility, CQC, and the first 90 days after the doors open.
🏗️ Day 2, Building the Business. Filling the diary, recruiting a team, the numbers, pricing, systems, and what comes after site one.
🎟️ One ticket covers both. Friday and Saturday, 13 and 14 November, Birmingham.

${CTA}

Day 1 without Day 2 gets you open with no idea how to stay open.
Day 2 without Day 1 assumes somebody already did the hard thinking for you.

That is why every ticket this time is a two day ticket.

So if you are sick of:
🚫 Conference talks that stop at "find a unit"
🚫 Advice from people who have not done it, or did it fifteen years ago
🚫 Panel theatre where you never get to ask your actual question
🚫 Going home with a notebook and no plan

And you want more.
More detail than a keynote allows.
More access than a queue at the front of the stage.
More to act on the Monday after than the Monday before.

Then come to both days.
${CTA}

It is run by Dr Bobby Bhandal, who built Avenue Dental from an empty unit in Leamington Spa after ten years as an associate across NHS and private, and by the Squat Success team who work with dentists through the whole build.

The content is current. It comes from practices trading right now, with real numbers, not case studies from a decade ago.

${DETAILS}

${CTA}

P.S. Spaces are intentionally limited so the room stays small enough to ask the question that matters to your practice.
P.P.S. Both days are in one room in Birmingham. No travel between venues, no breakout maze.`,
    headline: 'Open it, then grow it',
    altHeadlines: [
      'Most events teach one half',
      'Day 1 opens. Day 2 grows.',
      'Both halves, one room',
    ],
    description: '13 and 14 Nov, Birmingham',
    cta: 'Learn More',
  },
  {
    ref: 'EV-02',
    angle: 'Curiosity led: the Three Infections',
    stage: 'Cold / prospecting',
    hookType: 'Curiosity gap',
    primary: `Three things stop most associates ever opening their own practice. None of them are money.

Bobby Bhandal calls them the Three Infections.

🦠 The Prestige Virus.
🦠 Quick Fix Fever.
🦠 Analysis Paralysis Syndrome.

Every dentist who has ever said "one day" has caught at least one of them. Most have caught all three and mistaken it for being sensible.

Day 1 of Squat Success Live is where they get named, and where you get the framework to get past them.

${CTA}

📅 Friday 13 and Saturday 14 November 2026, Birmingham.
🎟️ One ticket, both days.
🏗️ Day 1 is the Blueprint: location, niche, funding, feasibility, CQC, the first 90 days.
📈 Day 2 is the business: the diary, the team, the numbers, the pricing, the systems.

So if you have been stuck in the loop of:
🚫 Researching locations on the train home and doing nothing about it
🚫 Downloading business plan templates you never finish
🚫 Talking yourself into it and back out of it, again
🚫 Waiting for a version of the numbers that feels completely safe

And you want more.
More say over the week.
More clinical range than somebody else's targets allow.
More at the end of ten years than another payslip.

Then Day 1 is where that loop ends.
${CTA}

Bobby built Avenue Dental from an empty unit in Leamington Spa, after ten years as an associate across NHS and private. The framework you get on Day 1 is the one he used, and the one dozens of dentists across the UK have used since.

${DETAILS}

${CTA}

P.S. Day 2 is the half most events skip, and it is included on the same ticket.
P.P.S. You leave with frameworks and tools you can act on the moment you get home, not a tote bag.`,
    headline: 'Three infections',
    altHeadlines: [
      'Not money. Three things.',
      'Why associates stay stuck',
      'Prestige. Quick fix. Paralysis.',
    ],
    description: 'Two days. One ticket.',
    cta: 'Learn More',
  },
  {
    ref: 'EV-03',
    angle: 'Pain led: the "one day" loop',
    stage: 'Cold / prospecting',
    hookType: 'Bold declaration',
    primary: `Researching locations on the train home. Then doing nothing about it.

That is the loop. It runs for years and it feels like progress, because there is always one more thing to check before you commit.

Squat Success Live is two days in Birmingham built to end it.

📅 Friday 13 and Saturday 14 November 2026.
🏗️ Day 1, The Blueprint. How to identify the right location using a demand assessment framework rather than gut feel or estate agent enthusiasm. Niche and USP. Feasibility, funding, and finding a property that actually works. CQC. The first 90 days after opening.
📈 Day 2, Building the Business. The Invisible Waiting List. Recruiting and keeping an A-Team. The numbers every owner must know. Pricing and presenting treatment. Systems that let you step out of the chair.
🎟️ One ticket. Both days. One room.

${CTA}

So if you are sick of:
🚫 A Sunday evening that starts at four o'clock
🚫 Clinical range narrowing to whatever the target rewards
🚫 Being confident about the dentistry and uncertain about the business
🚫 Saying "one day" and hearing how long you have been saying it

And you want more.
More control over the diary.
More of the work you actually trained for.
More to show for the next ten years than the last ten.

Then put a date on it.
${CTA}

It is run by Dr Bobby Bhandal, who spent ten years as an associate across NHS and private before building Avenue Dental from an empty unit in Leamington Spa. He is not describing the route from memory. He is still running the practice.

${DETAILS}

${CTA}

P.S. You leave with a plan, not a notebook. Workbooks, templates and tools you can use the moment you get home.
P.P.S. The room is full of dentists at the same point you are, which is the part nobody expects to be the most useful.`,
    headline: 'The "one day" loop ends',
    altHeadlines: [
      'From "one day" to a date',
      'Two days in Birmingham',
      'Stuck on the train home?',
    ],
    description: '13 and 14 Nov, Birmingham',
    cta: 'Learn More',
  },
  {
    ref: 'EV-04a',
    angle: 'Testimonial compilation: take their word, not ours',
    stage: 'Cold / prospecting',
    hookType: 'Quoted result',
    primary: `Don't take our word for it. Take theirs.

These are dentists who came to a previous Squat Success event. Different stages, different parts of the country, and the same question on the way in: can I actually do this.

In their own words:

"The biggest takeaway for me has been the belief that I can do it. That I can start a business and start a practice myself."

"If anyone is looking into setting up their own dental practice, coming on to Bobby's course would be an amazing thing to do."

"It definitely makes the journey smoother, having someone giving you all that information. Like a map to follow."

${CTA}

Squat Success Live is back on 13 and 14 November 2026 in Birmingham.

🎟️ One ticket, both days, Friday and Saturday.
🏗️ Day 1, The Blueprint. Location, niche, feasibility, funding, CQC, and the first 90 days after opening.
📈 Day 2, Building the Business. The diary, the team, the numbers, pricing, systems, the next stage.
🗣️ Live Q&A with Bobby and the Squat Success team across both days.

So if you are sick of:
🚫 Adverts telling you what a course is worth
🚫 Being the only person you know who is seriously considering this
🚫 Reading about it instead of planning it

And you want more.
More proof the route is walkable.
More people around you who have walked it.
More of a decision and less of a daydream.

Then hear it from them rather than from us.
${CTA}

Run by Dr Bobby Bhandal, who built Avenue Dental from an empty unit in Leamington Spa after ten years as an associate across NHS and private.

${DETAILS}

${CTA}

P.S. The full films are on the page. Three of them, between one and three minutes each.
P.P.S. Every ticket covers both days, because the dentists who get the most out of it are the ones in the room for both.`,
    headline: 'Take their word, not ours',
    altHeadlines: [
      'Dentists from previous events',
      'In their own words',
      'What they said afterwards',
    ],
    description: 'Two days. One ticket.',
    cta: 'Learn More',
  },
  {
    ref: 'EV-04b',
    angle: 'Testimonial compilation: nothing different about them',
    stage: 'Cold / prospecting',
    hookType: 'Bold declaration',
    primary: `There is nothing different about the dentists who end up owning practices.

Not better clinicians. Not braver. Most of them spent years saying "one day" in the same way, to the same people, over the same kitchen table.

What changed was not personality. It was having the sequence in front of them, and a room full of people a year or two further down it.

That is what the two days are.

${CTA}

Squat Success Live, 13 and 14 November 2026, Birmingham.

🏗️ Day 1, The Blueprint. How to identify the right location, define a niche and USP, handle feasibility and funding, manage the CQC process, and plan the first 90 days after opening.
📈 Day 2, Building the Business. Filling the diary, recruiting an A-Team, the numbers, pricing, systems, second sites.
🎟️ One ticket, both days.

So if you are sick of:
🚫 Assuming the dentists who open practices know something you do not
🚫 Downloading business plan templates you never finish
🚫 Waiting to feel ready, which is not a thing that happens on its own

And you want more.
More say over the week.
More clinical range than somebody else's targets allow.
More at the end of ten years than another payslip.

Then close the gap in two days.
${CTA}

Dr Bobby Bhandal spent ten years as an associate across NHS and private before building Avenue Dental from an empty unit in Leamington Spa. He is not describing the route from memory. He still runs it.

${DETAILS}

${CTA}

P.S. Dentists from previous events tell their own version of this on the page, on film, unedited.
P.P.S. You leave with workbooks and templates, not a notebook full of good intentions.`,
    headline: 'They were associates too',
    altHeadlines: [
      'Nothing different about them',
      'Not braver. Just sequenced.',
      'The gap is not talent',
    ],
    description: '13 and 14 Nov, Birmingham',
    cta: 'Learn More',
  },
  {
    ref: 'EV-04c',
    angle: 'Testimonial compilation: the questions and the room',
    stage: 'Cold / prospecting',
    hookType: 'Curiosity gap',
    primary: `The questions you would actually ask, if you knew who to ask.

What did it really cost, all in, including the bits nobody puts in a feasibility. How long was the diary quiet. What went wrong in the first year. Would you do it again.

You cannot ask a webinar that. You can ask a room.

${CTA}

Squat Success Live is two days in Birmingham, 13 and 14 November 2026, built around dentists at every stage of the same journey.

👥 Networking with dentists walking the same path, some a year ahead, some starting where you are.
🗣️ Live Q&A with Bobby and the Squat Success team across both days.
🤝 Guest experts on finance, marketing, recruitment and leadership. Direct access, not panel theatre.
🎟️ One ticket covers Friday and Saturday.

So if you are sick of:
🚫 Queueing at the front of a stage for ninety seconds with a speaker
🚫 Generic answers to a question about your own practice
🚫 Advice from people whose help arrives with an invoice attached
🚫 Events where the useful conversation happens to somebody else

And you want more.
More straight answers, including the unflattering ones.
More people to compare notes with afterwards.
More of the pitfalls named before you walk into them.

Then bring the questions.
${CTA}

Spaces are intentionally limited so the room stays small enough to ask the one that actually matters to your practice.

Day 1 covers the build. Day 2 covers what happens after the doors open. Both are on the same ticket.

${DETAILS}

${CTA}

P.S. Refreshments and lunch are on both days, which is where a lot of those conversations happen.
P.P.S. Bobby still runs Avenue Dental in Leamington Spa, so the answers are current.`,
    headline: 'Ask the room, not a webinar',
    altHeadlines: [
      'What did it actually cost?',
      'The questions nobody answers',
      'Dentists a year ahead of you',
    ],
    description: 'Two days. One ticket.',
    cta: 'Sign Up',
  },
  {
    ref: 'EV-05',
    angle: 'Content led: the Day 1 agenda in full',
    stage: 'Cold / prospecting',
    hookType: 'Curiosity gap',
    primary: `Here is the entire Day 1 agenda, in public, before you spend anything.

Squat Success Live, Friday 13 November 2026, Birmingham. Day 1 is The Blueprint, and you leave it knowing:

1️⃣ How to identify the right location, using a proven demand assessment framework rather than gut feel or estate agent enthusiasm.
2️⃣ How to define your niche and USP, and why "good dentistry at fair prices" is not one.
3️⃣ How to escape the Three Infections. The Prestige Virus, Quick Fix Fever and Analysis Paralysis Syndrome, which are the three that keep most associates stuck.
4️⃣ The realities. Feasibility, funding, and finding a property that actually works.
5️⃣ How to plan your first 90 days after opening, so you do not haemorrhage cash waiting for patients.
6️⃣ The mindset shifts required to move from clinician to owner.
7️⃣ How to manage the CQC process, so it is an easy process instead of a scary one.

${CTA}

That is the foundation. Get it right and everything after it gets easier.

Then Saturday is Day 2, Building the Business, on the same ticket. The diary, the team, the numbers, pricing, systems, and what comes after site one.

So if you are sick of:
🚫 Agendas that say "an inspiring morning" and nothing else
🚫 Paying to find out what is actually being taught
🚫 Sessions that turn into a pitch by eleven o'clock

And you want more.
More specifics.
More frameworks you can use on Monday.
More of the awkward detail, like funding and CQC.

Then look at the agenda and decide on the facts.
${CTA}

It is taught by Dr Bobby Bhandal, who used this framework to build Avenue Dental from an empty unit in Leamington Spa, plus guest experts on finance, marketing, recruitment and leadership.

${DETAILS}

${CTA}

P.S. Day 2's agenda is published on the same page. Nothing is held back to make you buy.
P.P.S. Workbooks and templates are included, so the frameworks leave the room with you.`,
    headline: 'Day 1: the whole agenda',
    altHeadlines: [
      'Seven things you leave with',
      'Location, funding, CQC',
      'The Blueprint, published',
    ],
    description: 'Day 1: Friday 13 Nov',
    cta: 'Learn More',
  },
  {
    ref: 'EV-06',
    angle: 'Content led: Day 2, building the business',
    stage: 'Cold / prospecting',
    hookType: 'Bold declaration',
    primary: `Opening the practice is the start, not the finish line.

Nobody says it at the point you sign the lease. They say it afterwards, while you look at a diary with gaps and a payroll that does not care.

Day 2 of Squat Success Live is the day most events skip.

Saturday 14 November 2026, Birmingham. You leave it knowing:

🔹 How to build the Invisible Waiting List. The marketing, referral and reputation systems that fill a diary without paid ads doing the heavy lifting.
🔹 How to recruit, retain and lead an A-Team. The people problems that make or break the first three years.
🔹 The numbers every owner must know, weekly, monthly and quarterly, and what to do when they head the wrong way.
🔹 How to price, package and present treatment so patients say yes to the right plan.
🔹 Systems that let you step out of the chair without the practice falling apart.
🔹 How to think about the next stage. Second sites, associates, long term vision.

${CTA}

Day 1 on the Friday is The Blueprint, for the part before the doors open. One ticket, both days.

So if you are sick of:
🚫 Being owner, principal, marketer and HR department in the same afternoon
🚫 Numbers you only look at when something has already gone wrong
🚫 Hiring, then rehiring, then wondering what keeps going wrong
🚫 A practice that only works when you are in it

And you want more.
More diary and less admin.
More of a team that runs the day without you.
More of a business you actually enjoy owning.

Then take the Saturday too.
${CTA}

This is not theory. It comes from real practices, real numbers and real conversations inside the Squat Success community right now, including Bobby's own practice in Leamington Spa.

${DETAILS}

${CTA}

P.S. Guest experts on finance, marketing, recruitment and leadership.
P.P.S. Day 2 is about staying open and growing strong, not just surviving year one.`,
    headline: 'Day 2: after the launch',
    altHeadlines: [
      'Opening is not the finish',
      'The team, numbers, pricing',
      'Build the business',
    ],
    description: 'Day 2: Saturday 14 Nov',
    cta: 'Sign Up',
  },
  {
    ref: 'EV-07',
    angle: 'Persona: open, and still quiet',
    stage: 'Cold / persona targeted',
    hookType: 'Bold declaration',
    primary: `The hardest year of a squat is not the one before it opens.

It is the one after. The fit out is done, the sign is up, the equipment is on finance, and the diary has gaps in it that nobody warned you about.

Day 2 of Squat Success Live is built for exactly that year.

📅 Saturday 14 November 2026, Birmingham. On the same ticket as Day 1, the Friday.

🔹 The Invisible Waiting List. Marketing, referral and reputation systems that fill a diary without paid ads carrying the whole load.
🔹 The numbers every owner must know, weekly, monthly and quarterly, and what to do when they are heading the wrong way.
🔹 Pricing, packaging and presenting treatment, so patients say yes to the right plan.
🔹 Recruiting, retaining and leading an A-Team.
🔹 Systems that let you step out of the chair without it all wobbling.

${CTA}

So if you are sick of:
🚫 Checking the diary at seven in the morning to see what tomorrow looks like
🚫 Turning the ads up every time a week goes quiet
🚫 Being the only reason the practice functions
🚫 Growth advice written for a practice ten years older than yours

And you want more.
More patients arriving without you paying for every one.
More weeks that do not depend on your own energy.
More reason to believe year two looks different from year one.

Then spend the Saturday on it.
${CTA}

Hear from dentists who are right where you are, and a few steps ahead. In one member's words: "Having someone to lean on, someone that can support you along that journey, kind of break it down for you."

${DETAILS}

${CTA}

P.S. Day 1 on the Friday covers the build, and it is included, which is useful if a second site is anywhere in your thinking.
P.P.S. Case studies come from practices trading right now, not from a deck written in 2016.`,
    headline: 'Open, and still quiet?',
    altHeadlines: [
      'The Invisible Waiting List',
      'Year one is the hard one',
      'Diary gaps, not ad spend',
    ],
    description: '13 and 14 Nov, Birmingham',
    cta: 'Sign Up',
  },
  {
    ref: 'EV-08',
    angle: 'Persona: close to opening, the first 90 days',
    stage: 'Cold / persona targeted',
    hookType: 'Bold declaration',
    primary: `If the site is found and the lease is moving, the next ninety days decide more than the fit out does.

Most of what goes wrong in a new squat was set before a single patient walked in. Funding structured badly. A niche nobody defined. A CQC application treated as a formality. Ninety days of cash burn nobody planned for.

Squat Success Live is two days on exactly that, 13 and 14 November 2026 in Birmingham.

🏗️ Day 1, The Blueprint. Feasibility, funding, and finding a property that actually works. Niche and USP. Managing the CQC process so it is an easy one rather than a scary one. And how to plan the first 90 days after opening so you do not haemorrhage cash waiting for patients.
📈 Day 2, Building the Business. The diary, the team, the numbers, the pricing, the systems, the next stage.
🎟️ One ticket, both days, one room.

${CTA}

So if you are sick of:
🚫 Being sold to by everyone who hears the word "squat"
🚫 Quotes you cannot sense check against anybody who has done it
🚫 Guessing which order any of this is supposed to happen in
🚫 Opening day being the only date in the plan

And you want more.
More certainty about the sequence.
More people to sense check the decisions with.
More of a plan for the ninety days after opening than "get busy".

Then get both days in the diary before the build takes over.
${CTA}

Bobby built Avenue Dental from an empty unit in Leamington Spa and still runs it, so the answers come from someone who has had the same conversations with the same landlords, lenders and regulators.

${DETAILS}

${CTA}

P.S. Guest experts on finance, marketing, recruitment and leadership are in the room on both days, with direct access.
P.P.S. You leave with workbooks and templates, which is more useful at this stage than any keynote.`,
    headline: 'The first 90 days',
    altHeadlines: [
      'Lease signed. Now what?',
      'Launch without the bleed',
      'Before the fit out starts',
    ],
    description: 'Two days. One ticket.',
    cta: 'Sign Up',
  },
];

// Meta's hard limits. The recommended lengths are softer, but these are refusals.
for (const b of BLOCKS) {
  if (b.primary.length > 2200) {
    throw new Error(`${b.ref} primary text is ${b.primary.length} chars, over Meta's 2200 limit`);
  }
  for (const h of [b.headline, ...b.altHeadlines, b.description]) {
    if (h.length > 255) throw new Error(`${b.ref} "${h}" is over the 255 character limit`);
  }
  if (/[—–]/.test(b.primary)) throw new Error(`${b.ref} primary text contains a dash we do not use`);
}

// Two blocks that open the same way are one block wearing two hats. The whole point
// of splitting the testimonials was that a scroll never hits the same quote twice.
const hooks = new Map<string, string>();
for (const b of BLOCKS) {
  const hook = b.primary.split('\n')[0].trim();
  const clash = hooks.get(hook);
  if (clash) throw new Error(`${b.ref} opens on the same line as ${clash}`);
  hooks.set(hook, b.ref);
}

const blockMap = new Map(BLOCKS.map((b) => [b.ref, b]));

// --- Video mapping -----------------------------------------------------------
// Short snippets only. Primary block is the safe default; the alternate is there
// so an ad set can rotate angle without anybody rewriting copy per clip.

interface Video {
  group: string;
  name: string;
  length: string;
  folder: string;
  use: string;
  block: string;
  notes: string;
}
interface Inventory {
  source: Record<string, string>;
  folders: Record<string, string>;
  videos: Video[];
}
const inv = JSON.parse(
  readFileSync('data/squat-success-video-ads.json', 'utf-8'),
) as Inventory;

/** name -> [primary block, alternate block] */
const MAPPING: Record<string, [string, string]> = {
  // Testimonial snippets. These are compilation cuts with several dentists in each,
  // so the copy stays generic: no block names a person or claims the speaker on screen
  // said the line in the text. Rotated across the three so adjacent ad sets differ.
  'Squat Success Testimonial Snippet 1.mov': ['EV-04a', 'EV-04b'],
  'Squat Success Testimonial Snippet 2.mov': ['EV-04b', 'EV-04c'],
  'Squat Success Testimonial Snippet 3.mov': ['EV-04c', 'EV-04a'],
  'Squat Success Testimonial Snippet 4.mov': ['EV-04a', 'EV-03'],
  'Squat Success Testimonial Snippet 5.mov': ['EV-04b', 'EV-02'],
  'Squat Success Testimonial Snippet 6.mov': ['EV-04c', 'EV-01'],
  'Squat Success Testimonial Comp 2 Snippet 1.mov': ['EV-04a', 'EV-04c'],
  'Squat Success Testimonial Comp 2 Snippet 2.mov': ['EV-04b', 'EV-04a'],
  'Squat Success Testimonial Comp 2 Snippet 3.mov': ['EV-04c', 'EV-04b'],
  'Squat Success Testimonial Comp 2 Snippet 4.mov': ['EV-04a', 'EV-07'],
  'Squat Success Testimonial Comp 2 Snippet 5.mov': ['EV-04b', 'EV-03'],
  'Squat Success Testimonial Comp 2 Snippet 6.mov': ['EV-04c', 'EV-08'],
  'Squat Success Testimonial Comp 2 Snippet 7.mov': ['EV-04a', 'EV-01'],
  'Squat Success Testimonial Comp 2 Snippet 8.mov': ['EV-04b', 'EV-07'],
  // Bobby to camera. Cold pain-led is the safest default, curiosity the rotation.
  'Squat Success Bobby Car Snippet 1.mov': ['EV-03', 'EV-02'],
  'Squat Success Bobby Car Snippet 2.mov': ['EV-03', 'EV-02'],
  'Squat Success Bobby Car Snippet 3.mov': ['EV-03', 'EV-01'],
  'Squat Success Bobby Car Snippet 4.mov': ['EV-02', 'EV-05'],
  'Squat Success Bobby Car Snippet 5.mov': ['EV-02', 'EV-05'],
  'Squat Success Bobby Car Snippet 6.mov': ['EV-03', 'EV-08'],
  'Squat Success Bobby Car Snippet 7.mov': ['EV-03', 'EV-06'],
  // Podcast snippets. These are the only clips with a confirmed topic, so they are
  // the only ones mapped on substance rather than on a safe default.
  'SS podcast snippet 1 - Personal Brand.mov': ['EV-07', 'EV-06'],
  'SS podcast snippet 2 - Why Matt Joined SS.mov': ['EV-04a', 'EV-01'],
  'SS podcast snippet 3 - Support From SS.mov': ['EV-04c', 'EV-01'],
  'SS podcast snippet 4 - Why Open a Squat.mov': ['EV-03', 'EV-02'],
  'SS podcast snippet 5 - Pros and Cons.mov': ['EV-02', 'EV-05'],
  'SS podcast snippet 6 - CareStack Promo.mov': ['', ''],
  'SS podcast snippet 7 - Same Team.mov': ['EV-06', 'EV-07'],
  'SS podcast snippet 8 - Recruitment.mov': ['EV-06', 'EV-07'],
  'SS podcast snippet 9 - Trusting Others.mov': ['EV-06', 'EV-07'],
  'SS podcast snippet 10 - People & Support.mov': ['EV-04c', 'EV-06'],
};

/** Extra note per clip, on top of whatever the inventory already flags. */
const EXTRA_NOTES: Record<string, string> = {
  'SS podcast snippet 3 - Support From SS.mov':
    'Talks about the paid programme. The copy sells the event ticket, so check the clip does not blur the two.',
  'SS podcast snippet 6 - CareStack Promo.mov':
    'Sponsor content for a third party. Do not run it on the event funnel either.',
};

const videos = inv.videos.filter((v) => v.name in MAPPING);
const missing = Object.keys(MAPPING).filter((n) => !inv.videos.some((v) => v.name === n));
if (missing.length) throw new Error(`Mapped clips not in the inventory: ${missing.join(', ')}`);

const HEAD = [
  'Group',
  'Video',
  'Length',
  'Watch (Frame.io)',
  'Copy block',
  'Alt block (rotate)',
  'Angle',
  'Primary Text',
  'Headline',
  'Headline alternates (rotate)',
  'Description',
  'CTA Button',
  'Destination URL',
  'Notes',
];
const WIDTHS = [26, 44, 9, 17, 11, 15, 30, 84, 30, 32, 24, 13, 34, 54];

const rows = videos.map((v) => {
  const [primaryRef, altRef] = MAPPING[v.name];
  const b = primaryRef ? blockMap.get(primaryRef) : undefined;
  if (primaryRef && !b) throw new Error(`Unknown block ${primaryRef} for ${v.name}`);
  if (altRef && !blockMap.has(altRef)) throw new Error(`Unknown alt block ${altRef} for ${v.name}`);
  const folderUrl = inv.folders[v.folder];
  if (!folderUrl) throw new Error(`Unknown folder key ${v.folder} for ${v.name}`);
  const notes = [v.notes, EXTRA_NOTES[v.name]].filter(Boolean).join(' ');
  return [
    v.group,
    v.name,
    v.length,
    `=HYPERLINK("${folderUrl}", "Open folder")`,
    primaryRef || 'NOT FOR ADS',
    altRef,
    b?.angle ?? '',
    b?.primary ?? '',
    b?.headline ?? '',
    b?.altHeadlines.join('\n') ?? '',
    b?.description ?? '',
    b?.cta ?? '',
    b ? DEST : '',
    notes,
  ];
});

// --- Sheet -------------------------------------------------------------------

const INK = { red: 0x05 / 255, green: 0x14 / 255, blue: 0x12 / 255 };
const MINT = { red: 0x8e / 255, green: 0xfe / 255, blue: 0xbb / 255 };
const WHITE = { red: 1, green: 1, blue: 1 };
const BAND = { red: 0.957, green: 0.965, blue: 0.961 };
const FLAG = { red: 0.992, green: 0.906, blue: 0.906 };
const RULE_LINE = { style: 'SOLID', color: { red: 0.85, green: 0.87, blue: 0.86 } };

const token = await mintSheetsAccessToken();

async function api<T>(path: string, method: string, body?: unknown): Promise<T> {
  const resp = await fetch(`${BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`${method} ${path} failed (${resp.status}): ${text.slice(0, 500)}`);
  }
  return (await resp.json()) as T;
}

const meta = await api<{ sheets: { properties: { sheetId: number; title: string } }[] }>(
  `/${SPREADSHEET}?fields=sheets.properties(sheetId,title)`,
  'GET',
);
const existing = meta.sheets.find((s) => s.properties.title === TAB_TITLE);

let sheetId: number;
if (existing) {
  sheetId = existing.properties.sheetId;
  console.log(`refreshing existing tab "${TAB_TITLE}" (gid ${sheetId})`);
  await api(`/${SPREADSHEET}:batchUpdate`, 'POST', {
    requests: [
      {
        updateSheetProperties: {
          properties: {
            sheetId,
            gridProperties: {
              rowCount: rows.length + 1,
              columnCount: HEAD.length,
              frozenRowCount: 1,
              frozenColumnCount: 2,
            },
          },
          fields: 'gridProperties(rowCount,columnCount,frozenRowCount,frozenColumnCount)',
        },
      },
    ],
  });
} else {
  const added = await api<{ replies: { addSheet: { properties: { sheetId: number } } }[] }>(
    `/${SPREADSHEET}:batchUpdate`,
    'POST',
    {
      requests: [
        {
          addSheet: {
            properties: {
              sheetId: Math.max(0, ...meta.sheets.map((s) => s.properties.sheetId)) + 1,
              title: TAB_TITLE,
              index: meta.sheets.length,
              gridProperties: {
                rowCount: rows.length + 1,
                columnCount: HEAD.length,
                frozenRowCount: 1,
                frozenColumnCount: 2,
              },
            },
          },
        },
      ],
    },
  );
  sheetId = added.replies[0].addSheet.properties.sheetId;
  console.log(`added tab "${TAB_TITLE}" (gid ${sheetId})`);
}

await api(`/${SPREADSHEET}/values:batchUpdate`, 'POST', {
  valueInputOption: 'USER_ENTERED',
  data: [{ range: `'${TAB_TITLE}'!A1`, majorDimension: 'ROWS', values: [HEAD, ...rows] }],
});

const requests: unknown[] = [
  {
    repeatCell: {
      range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: HEAD.length },
      cell: {
        userEnteredFormat: {
          backgroundColor: INK,
          wrapStrategy: 'WRAP',
          verticalAlignment: 'MIDDLE',
          textFormat: { foregroundColor: MINT, bold: true, fontSize: 10, fontFamily: 'Arial' },
        },
      },
      fields: 'userEnteredFormat(backgroundColor,wrapStrategy,verticalAlignment,textFormat)',
    },
  },
  {
    updateDimensionProperties: {
      range: { sheetId, dimension: 'ROWS', startIndex: 0, endIndex: 1 },
      properties: { pixelSize: 44 },
      fields: 'pixelSize',
    },
  },
  {
    repeatCell: {
      range: { sheetId, startRowIndex: 1, endRowIndex: 1 + rows.length, startColumnIndex: 0, endColumnIndex: HEAD.length },
      cell: {
        userEnteredFormat: {
          backgroundColor: WHITE,
          wrapStrategy: 'WRAP',
          verticalAlignment: 'TOP',
          padding: { top: 6, bottom: 6, left: 8, right: 8 },
          textFormat: { fontSize: 10, fontFamily: 'Arial' },
        },
      },
      fields: 'userEnteredFormat(backgroundColor,wrapStrategy,verticalAlignment,textFormat,padding)',
    },
  },
  {
    updateBorders: {
      range: { sheetId, startRowIndex: 0, endRowIndex: 1 + rows.length, startColumnIndex: 0, endColumnIndex: HEAD.length },
      innerHorizontal: RULE_LINE,
      innerVertical: RULE_LINE,
    },
  },
  {
    updateDimensionProperties: {
      range: { sheetId, dimension: 'ROWS', startIndex: 1, endIndex: 1 + rows.length },
      properties: { pixelSize: 300 },
      fields: 'pixelSize',
    },
  },
  {
    setBasicFilter: {
      filter: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1 + rows.length, startColumnIndex: 0, endColumnIndex: HEAD.length },
      },
    },
  },
];

for (let i = 1; i < rows.length; i += 2) {
  requests.push({
    repeatCell: {
      range: { sheetId, startRowIndex: 1 + i, endRowIndex: 2 + i, startColumnIndex: 0, endColumnIndex: HEAD.length },
      cell: { userEnteredFormat: { backgroundColor: BAND } },
      fields: 'userEnteredFormat.backgroundColor',
    },
  });
}

WIDTHS.forEach((w, c) => {
  requests.push({
    updateDimensionProperties: {
      range: { sheetId, dimension: 'COLUMNS', startIndex: c, endIndex: c + 1 },
      properties: { pixelSize: Math.min(Math.round(w * 7.2), 560) },
      fields: 'pixelSize',
    },
  });
});

const blockCol = HEAD.indexOf('Copy block');
rows.forEach((r, i) => {
  if (r[blockCol] === 'NOT FOR ADS') {
    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: 1 + i, endRowIndex: 2 + i, startColumnIndex: 0, endColumnIndex: HEAD.length },
        cell: {
          userEnteredFormat: {
            backgroundColor: FLAG,
            textFormat: { fontSize: 10, fontFamily: 'Arial', bold: true },
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat)',
      },
    });
  }
});

await api(`/${SPREADSHEET}:batchUpdate`, 'POST', { requests });

// --- Markdown record ---------------------------------------------------------

const TO_CONFIRM = [
  'Ticket price. Nothing is published on the landing page and nothing has been invented. If there is a price, or an early bird cutoff, the offer stack and the P.S. lines can carry it.',
  'Whether the two day ticket has a booking deadline or a genuine cap number. "Spaces are intentionally limited" is the landing page wording and is all the copy uses.',
  'Venue. The page says Birmingham and nothing more. A named venue and a start time would strengthen every block.',
  'Speakers. Guest experts are described by discipline (finance, marketing, recruitment, leadership) but not named anywhere.',
  'Testimonial snippet contents. Speaker and topic are unconfirmed on all fourteen, which is why the copy on them is generic. If someone watches them and a clip turns out to be one dentist on one clear subject, it can move to the angle that matches.',
  'Named attribution. No block names a dentist, because the testimonial clips are compilations and the copy must not imply the person on screen said the line in the text. If a clip is ever cut down to one identified speaker, a named version of EV-04a would hit harder.',
  'Bobby car snippet contents. Same problem. All seven are on a safe default block.',
  'Whether the ad headline clashes with anything spoken or captioned in the first two seconds of the clip. Same rule as the statics: the headline should not repeat the line already on the creative.',
];

const md = `# Squat Success Live — Meta ad copy (event)

**Event:** Squat Success Live, Friday 13 and Saturday 14 November 2026, Birmingham
**Destination:** ${DEST}
**Objective:** Traffic / leads (the page opens a GoHighLevel ticket form)
**Date written:** ${DATE}
**Sheet:** [Event Ads (Nov)](https://docs.google.com/spreadsheets/d/${SPREADSHEET}/edit#gid=${sheetId})

${BLOCKS.length} copy blocks, run against the ${rows.length} short video snippets already approved on
Frame.io. One block per angle, not one per clip: swap the clip, leave working words alone.

The testimonial clips are compilation cuts with several dentists in each, so EV-04a to
EV-04c are deliberately generic: none names a person or implies the dentist on screen
said the line in the copy. They still argue three different things, so a scroll does not
hit the same ad three times.

No ticket price and no deadline appear in any block, because neither is published.

---

${BLOCKS.map(
  (b) => `## ${b.ref} — ${b.angle}

**Stage:** ${b.stage} · **Hook type:** ${b.hookType} · **CTA button:** ${b.cta}

**Primary text**

${b.primary}

**Headline:** ${b.headline} (${b.headline.length} chars)
**Headline alternates:** ${b.altHeadlines.map((h) => `${h} (${h.length})`).join(' · ')}
**Description:** ${b.description} (${b.description.length} chars)

**Clips on this block:** ${
    videos
      .filter((v) => MAPPING[v.name][0] === b.ref)
      .map((v) => v.name.replace(/\.mov$/, ''))
      .join(', ') || 'none by default'
  }
**Rotation slot on:** ${
    videos
      .filter((v) => MAPPING[v.name][1] === b.ref)
      .map((v) => v.name.replace(/\.mov$/, ''))
      .join(', ') || 'none'
  }`,
).join('\n\n---\n\n')}

---

## Clip mapping

| Group | Clip | Length | Block | Alt |
|---|---|---|---|---|
${videos
  .map(
    (v) =>
      `| ${v.group} | ${v.name.replace(/\.mov$/, '')} | ${v.length} | ${
        MAPPING[v.name][0] || 'NOT FOR ADS'
      } | ${MAPPING[v.name][1] || ''} |`,
  )
  .join('\n')}

## Testing

- **Test variable:** angle, not wording. ${BLOCKS.length} blocks, one ad set each, same clips underneath.
- **Recommended split:** start EV-01 and EV-03 against the Bobby car snippets, and run the
  three testimonial blocks one ad set apiece against the compilation snippets. EV-05 and
  EV-06 are agenda led and will do more work on retargeting than cold.
- **Testimonial blocks:** EV-04a is proof led, EV-04b argues the gap is sequence not talent,
  EV-04c sells the room and the questions. All three work behind any compilation clip. If
  budget is tight, run EV-04a and EV-04c, they are the furthest apart.
- **Persona blocks** EV-07 and EV-08 want their own ad sets. They speak to dentists who are
  already open or already committed, and will drag CPM if they run broad.
- **Minimum duration:** 3 to 5 days per angle with enough budget to leave prospecting alone.
- **Key metric:** cost per ticket form submission. Landing page view rate is the early signal.

## To confirm

${TO_CONFIRM.map((t) => `- ${t}`).join('\n')}
`;

const mdPath = `outputs/ad-copy/squat-success-event-meta-${DATE}.md`;
mkdirSync(dirname(mdPath), { recursive: true });
writeFileSync(mdPath, md);

const payloadPath = 'data/squat-success-event-ad-copy.json';
writeFileSync(
  payloadPath,
  JSON.stringify(
    {
      date: DATE,
      destination: DEST,
      tab: TAB_TITLE,
      blocks: BLOCKS,
      mapping: MAPPING,
      toConfirm: TO_CONFIRM,
    },
    null,
    2,
  ),
);

console.log('');
console.log(`Tab:      ${TAB_TITLE} (gid ${sheetId})`);
console.log(`Blocks:   ${BLOCKS.length}`);
console.log(`Clips:    ${rows.length}`);
console.log(`Markdown: ${mdPath}`);
console.log(`Payload:  ${payloadPath}`);
console.log(`Sheet:    https://docs.google.com/spreadsheets/d/${SPREADSHEET}/edit#gid=${sheetId}`);
console.log('');
