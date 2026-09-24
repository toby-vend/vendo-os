"""Build the Sword Stall Meta ad naming map from an Ads Manager export + Motion creative IDs.

Usage: python3 build_rows.py <ads_export.csv> <creative_map.tsv> <out.json>
Naming convention: Format | Talent | Angle | Subject | Hook | Edit | Launch(YYMMDD)
"""
import csv, json, re, sys

export, cmap_path, out = sys.argv[1:4]

CAMPAIGN_BY_ADSET = {
    'tROAS+ Ad Set | Video Ads': 'VD | Sales | tROAS Campaign',
    'Prospecting Ad Set - IC | Video Creatives': 'VD | Sales | Prospecting | New Customer Purchase',
    'DPA Ad Set': 'VD | Sales | DPA Campaign',
    'Retargeting Ad Set | ATC Audience': 'VD | Traffic | Retargeting ATC Audience',
}

rows = []
for x in csv.DictReader(open(export)):
    rows.append({
        'ad_id': x['Ad ID'], 'name': x['Ad name'], 'adset': x['Ad set name'],
        'campaign': CAMPAIGN_BY_ADSET.get(x['Ad set name'], ''),
        'status': 'Live' if x['Ad delivery'] == 'active' else 'Rejected',
        'created': x['Date created'], 'spend': float(x['Amount spent (GBP)'] or 0),
        'roas': float(x['Purchase ROAS (return on ad spend)'] or 0), 'source': x['Ad ID'],
    })

# Draft ads in VD | Sales | Creative Testing | ABO, each duplicated from (or pointed at the post of) a live ad.
DRAFTS = [
    ('120252198611200306', 'Test | W1 | Family Gifting', '120248293325280306'),
    ('120252198611160306', 'Test | W1 | Family Gifting', '120248293714680306'),
    ('120252198611170306', 'Test | W1 | Family Gifting', '120248297947830306'),
    ('120252198611180306', 'Test | W1 | Family Gifting', '120248293532120306'),
    ('120252198611190306', 'Test | W1 | Family Gifting', '120248293702820306'),
    ('120252199462700306', 'Test | W1 | Fandom UGC', '120233431167250306'),
    ('120252199462820306', 'Test | W1 | Fandom UGC', '120232773702040306'),
    ('120252199462780306', 'Test | W1 | Fandom UGC', '120232778803320306'),
    ('120252199462670306', 'Test | W1 | Fandom UGC', '120233366901810306'),
    ('120252199462720306', 'Test | W1 | Fandom UGC', '120233366955340306'),
    ('120252199462800306', 'Test | W1 | Skippy Product Focus', '120240366566580306'),
    ('120252199462770306', 'Test | W1 | Skippy Product Focus', '120240366566570306'),
    ('120252199462730306', 'Test | W1 | Skippy Product Focus', '120240366566560306'),
    ('120252199462710306', 'Test | W1 | Skippy Product Focus', '120240366566550306'),
    ('120252199462690306', 'Test | W1 | Skippy Product Focus', '120240265315330306'),
    ('120252199462790306', 'Test | W1 | Assassins Creed UGC', '120237363257380306'),
    ('120252199462750306', 'Test | W1 | Assassins Creed UGC', '120237363257180306'),
    ('120252199462740306', 'Test | W1 | Assassins Creed UGC', '120237363257300306'),
    ('120252199462680306', 'Test | W1 | Assassins Creed UGC', '120237363257390306'),
    ('120252199462760306', 'Test | W1 | Assassins Creed UGC', '120237363257340306'),
]
by_id = {r['ad_id']: r for r in rows}
for ad_id, adset, src in DRAFTS:
    s = by_id[src]
    rows.append({'ad_id': ad_id, 'name': None, 'adset': adset, 'campaign': 'VD | Sales | Creative Testing | ABO',
                 'status': 'Draft', 'created': '', 'spend': 0.0, 'roas': 0.0, 'source': src, 'source_name': s['name']})

# Creative grouping: Motion creative asset per ad; fall back to the ad's own ID.
cmap = {}
for line in open(cmap_path):
    p = line.rstrip('\n').split('\t')
    if len(p) >= 2 and p[1]:
        cmap[p[0]] = p[1]

for r in rows:
    r['creative'] = cmap.get(r['source'], 'ad:' + r['source'])

# Current name for drafts is the name we gave them in Ads Manager.
DRAFT_NAMES = {
    '120252198611200306': 'Memorable Gift 1', '120252198611160306': 'Sister Gift 1', '120252198611170306': 'Mum Gift 3',
    '120252198611180306': 'Memorable Gift 4', '120252198611190306': 'Brother Gift 4',
    '120252199462700306': 'UGC LOTR - Have I Got Something For You | Subs', '120252199462820306': 'UGC LOTR - Gift Hook | No Subs',
    '120252199462780306': 'UGC LOTR - Fandom Hook | Subs', '120252199462670306': 'UGC Supernatural | Owning Hook | Captions',
    '120252199462720306': 'UGC Supernatural | Realistic Hook', '120252199462800306': 'Skippy | Witcher Focus | Gifting For A Witcher Fan',
    '120252199462770306': 'Skippy | Witcher Focus | Stop Scrolling', '120252199462730306': 'ASMR Boxing Video | Skippy',
    '120252199462710306': 'Skippy | Gifting Focus | Gifts for Collectors', '120252199462690306': 'Logo Video | Plain Black Background',
    '120252199462790306': 'UGC Assassin Creed | Coolest Thing Hook', '120252199462750306': "UGC Assassin Creed | Everyone's Asking Hook",
    '120252199462740306': 'UGC Assassin Creed | Real Assassin Hook', '120252199462680306': 'UGC Assassin Creed | Fan Hook',
    '120252199462760306': 'UGC Unboxing | PASTOR | Subs',
}
for r in rows:
    if r['status'] == 'Draft':
        r['name'] = DRAFT_NAMES[r['ad_id']]

# Launch = earliest created date across all ads sharing the creative (drafts inherit their source's creative).
launch = {}
for r in rows:
    if r['created']:
        c = r['creative']
        launch[c] = min(launch.get(c, r['created']), r['created'])

def parse(src_name):
    n = src_name
    low = n.lower()
    f = {'format': '', 'talent': '', 'angle': '', 'subject': 'Range', 'hook': '', 'edit': 'V1', 'flags': []}
    # Format + talent
    if low.startswith('ugc'):
        f['format'], f['talent'] = 'UGC', 'TBC'
        f['flags'].append('UGC creator name needed for Talent')
    elif low.startswith('asmr'):
        f['format'], f['talent'] = 'ASMR', 'Skippy'
    elif low.startswith('logo video'):
        f['format'], f['talent'] = 'LOGO', 'None'
    elif low.startswith('left cart'):
        f['format'], f['talent'] = 'STATIC', 'None'
    elif low.startswith('dpa'):
        f['format'], f['talent'] = 'DPA', 'None'
    else:
        f['format'], f['talent'] = 'TH', 'Skippy'
        if 'skippy' not in low and not re.match(r'(memorable|mum|sister|brother) gift|last minute', low):
            f['flags'].append('Assumed Skippy talking head, check')
    if 'pastor' in low:
        f['flags'].append('Current name has PASTOR, confirm meaning')
    # Edit
    if 'no subs' in low: f['edit'] = 'NoSubs'
    elif 'subs' in low: f['edit'] = 'Subs'
    elif 'captions' in low: f['edit'] = 'Captions'
    # Subject
    for key, subj in [('lotr', 'LOTR'), ('witcher', 'Witcher'), ('supernatural', 'Supernatural'),
                      ('assassin', 'AssassinsCreed'), ('katana', 'Katana')]:
        if key in low:
            f['subject'] = subj
            break
    if low.startswith('ugc unboxing'):
        f['subject'] = 'GhostOfTsushima'
    if 'lotr focus' in low and 'witcher' in low:
        f['subject'] = 'LOTR'
        f['flags'].append('Name mixes LOTR Focus and Witcher Fan, check which it is')
    # Hook + angle
    rules = [
        (r"have i got something", 'HaveIGot', 'Gift'),
        (r'gift hook', 'GiftHook', 'Gift'),
        (r"you won't believe", 'WontBelieve', 'Fandom'),
        (r'fandom hook', 'FandomHook', 'Fandom'),
        (r'owning hook', 'Owning', 'Fandom'),
        (r'realistic hook', 'Realistic', 'Fandom'),
        (r'generic hook', 'Generic', 'Fandom'),
        (r'coolest thing', 'CoolestThing', 'Fandom'),
        (r"everyone's asking", 'EveryonesAsking', 'Fandom'),
        (r'real assassin', 'RealAssassin', 'Fandom'),
        (r'fan hook', 'FanHook', 'Fandom'),
        (r'gifting guide', 'GiftGuide', 'Gift'),
        (r'gifts for collectors', 'GiftsForCollectors', 'Collector'),
        (r'goldmine', 'Goldmine', 'Gift'),
        (r'gifting for a witcher fan', 'WitcherFanGift', 'Gift'),
        (r'stop scrolling', 'StopScrolling', 'Fandom'),
        (r'unboxing', 'Unboxing', 'Craft'),
        (r'asmr boxing', 'Boxing', 'Craft'),
        (r'plain white', 'WhiteBG', 'Brand'),
        (r'plain black', 'BlackBG', 'Brand'),
        (r'comic con', 'ComicCon', 'Fandom'),
        (r'faq (\d)', 'FAQ{0}', 'Trust'),
        (r'katana', 'Katana', 'Craft'),
        (r'memorable gift (\d)', 'Memorable{0}', 'Gift'),
        (r'mum gift (\d)', 'Mum{0}', 'Gift'),
        (r'sister gift (\d)', 'Sister{0}', 'Gift'),
        (r'brother gift (\d)', 'Brother{0}', 'Gift'),
        (r'last minute (\d)', 'LastMinute{0}', 'Gift'),
        (r'left cart \| image (\d)', 'LeftCart{0}', 'Retarget'),
        (r'dpa - frame (\d)', 'Frame{0}', 'Retarget'),
        (r'dpa - frame$', 'Frame1', 'Retarget'),
        (r'^dpa$', 'Catalogue', 'Retarget'),
    ]
    for pat, hook, angle in rules:
        m = re.search(pat, low)
        if m:
            f['hook'] = hook.format(*m.groups())
            f['angle'] = angle
            break
    if not f['hook']:
        f['flags'].append('Hook not recognised')
    if f['hook'] == 'Katana':
        f['flags'].append('Angle and Subject guessed from name')
    return f

out_rows = []
order = {'Draft': 0, 'Live': 1, 'Rejected': 2}
for r in rows:
    f = parse(r['name'] if r['status'] != 'Draft' else r['source_name'])
    l = launch.get(r['creative'], r['created'])
    f['launch'] = l.replace('-', '')[2:] if l else ''
    if r['status'] == 'Rejected':
        f['flags'].insert(0, 'Rejected by Meta, suggest archive rather than rename')
    if r['status'] == 'Live' and r['creative'].startswith('ad:'):
        f['flags'].append('No Motion creative ID, Launch = own created date')
    out_rows.append({**r, **f})
out_rows.sort(key=lambda r: (order[r['status']], r['campaign'], r['adset'], -r['spend']))
json.dump(out_rows, open(out, 'w'), indent=1)
print(len(out_rows))
for r in out_rows[:8] + out_rows[20:30]:
    print(r['status'], '|', r['name'], '=>', ' | '.join([r['format'], r['talent'], r['angle'], r['subject'], r['hook'], r['edit'], r['launch']]), '|', '; '.join(r['flags']))
