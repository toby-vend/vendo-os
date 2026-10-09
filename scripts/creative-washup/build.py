"""Build the wash-up page and the Sheet payload for one run.

    python3 -I scripts/creative-washup/build.py <run-dir> [--concepts-only]

Inputs (in <run-dir>): creatives.json, notes.json, site/img/.
Shared caches (in data/creative-washup/): transcripts.json, tags.json.
Outputs: <run-dir>/site/index.html, <run-dir>/concepts.json,
<run-dir>/sheet-payload.json.

--concepts-only prints the concept tables so the takeaways can be written
before the page is built.
"""
import json
import os
import re
import statistics
import sys
from datetime import date, timedelta

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
CACHE = os.path.join(ROOT, 'data', 'creative-washup')
RUN = sys.argv[1]
CFG = json.load(open(os.path.join(HERE, 'workspaces.json')))
FX = CFG['fx_to_gbp_approx']

c = json.load(open(os.path.join(RUN, 'creatives.json')))
tr = json.load(open(os.path.join(CACHE, 'transcripts.json')))
tags = json.load(open(os.path.join(CACHE, 'tags.json')))
DIMS = ['format', 'angle', 'offer', 'persona']
STATE = {'new': 'New', 'hidden': 'New', 'testing': 'Testing', 'holding': 'Holding',
         'declining': 'Declining', 'scaling': 'Scaling'}
run_day = date.fromisoformat(os.path.basename(os.path.normpath(RUN)))
period = (run_day - timedelta(days=14), run_day - timedelta(days=1))


def results(x):
    m = x['m']
    return (m['view_content'] or 0) + (m['leads_all'] or 0)


IF_RE = re.compile(r'(\bIF\b|instant form)', re.I)
NON_DENTAL_LEADS = {'Studio Glide Pilates', 'Vendo Digital'}


def in_concepts(x):
    """Ecommerce, or a dental website (View Content) campaign. Instant-form ads and
    non-dental lead gen are left out so lead costs compare like with like."""
    if x['ecom']:
        return True
    return x['client'] not in NON_DENTAL_LEADS and not IF_RE.search(x['campaign'] or '')


# ---------- concept comparison ----------
def concept_tables():
    out = {}
    for seg, is_ecom in (('lead', False), ('ecom', True)):
        rows = [(i, x) for i, x in enumerate(c) if x['ecom'] == is_ecom and x['key'] in tags and in_concepts(x)]
        out[seg] = {}
        for d in DIMS:
            groups = {}
            for i, x in rows:
                groups.setdefault(tags[x['key']][d], []).append((i, x))
            table = []
            for val, g in groups.items():
                sp = sum((x['m']['spend'] or 0) * FX.get(x['cur'], 1) for _, x in g)
                ts = [x['m']['thumbstop_ratio'] for _, x in g if x['is_video'] and x['m']['thumbstop_ratio']]
                ctr = [x['m']['ctr_outbound'] or 0 for _, x in g]
                ex = [i for i, _ in sorted(g, key=lambda t: -(t[1]['m']['spend'] or 0))[:4]]
                r = {'value': val, 'n': len(g), 'clients': len({x['client'] for _, x in g}), 'spend': round(sp),
                     'ts': round(statistics.median(ts), 1) if ts else None,
                     'ctr': round(statistics.median(ctr), 2), 'ex': ex}
                if is_ecom:
                    rev = sum((x['m']['purchase_value'] or 0) * FX.get(x['cur'], 1) for _, x in g)
                    r['sales'] = sum(x['m']['purchase_count'] or 0 for _, x in g)
                    r['roas'] = round(rev / sp, 2) if sp else 0
                else:
                    r['results'] = sum(x['m']['view_content'] or 0 for _, x in g)
                    r['cpr'] = round(sp / r['results'], 2) if r['results'] else None
                table.append(r)
            out[seg][d] = sorted(table, key=lambda r: -r['spend'])
    return out


concepts = concept_tables()
json.dump(concepts, open(os.path.join(RUN, 'concepts.json'), 'w'), indent=1)
if '--concepts-only' in sys.argv:
    for seg in concepts:
        for d in DIMS:
            print(f'\n## {seg} / {d}')
            for r in concepts[seg][d]:
                k = f"ROAS {r['roas']} sales {r['sales']}" if seg == 'ecom' else f"res {r['results']} cpr {r['cpr']}"
                print(f"  {r['value'][:38]:38} n={r['n']:3} cl={r['clients']:2} £{r['spend']:6} {k}  ts={r['ts']} ctr={r['ctr']}")
    sys.exit(0)

# ---------- page ----------
notes = json.load(open(os.path.join(RUN, 'notes.json')))
flag_ads = {(f['client'], a): f['sev'] for f in notes['fixes'] for a in f['ads']}
ws_cur = {w['name']: w['cur'] for w in CFG['workspaces']}

items = []
for i, x in enumerate(c):
    m = x['m']
    v = x['is_video']
    items.append({
        'i': i, 'cl': x['client'], 'n': x['adName'], 'cp': x['campaign'], 'as': x['adset'],
        'v': v, 'url': x['video'] if v else None, 'len': round(x['videoLength']) if x['videoLength'] else None,
        'car': x['cards'], 'st': STATE.get(x['spendState'], x['spendState'] or ''), 'ln': x['launch'],
        'sp': round(m['spend'] or 0, 2), 'ts': round(m['thumbstop_ratio'], 1) if v else None,
        'hold': round(m['video_thruplay_ratio'], 1) if v and m['video_thruplay_ratio'] else None,
        'ctr': round(m['ctr_outbound'] or 0, 2), 'cpm': round(m['cpm'] or 0, 1),
        'vc': m['view_content'] or 0, 'ld': m['leads_all'] or 0, 'pu': m['purchase_count'] or 0,
        'roas': round(m['roas'], 2) if m['roas'] else 0, 'ecom': x['ecom'],
        'tx': x['texts'], 'hl': x['titles'], 'ds': x['descs'],
        'sc': tr.get(x['creativeEntityId'], '') if v else '',
        'tg': tags.get(x['key']), 'fl': flag_ads.get((x['client'], x['adName'])),
    })

order = notes.get('order') or []
names = sorted({x['client'] for x in c}, key=lambda n: (order.index(n) if n in order else 999, n))
clients = [{'name': n, 'cur': ws_cur.get(n, '£'), 'notes': notes['clients'].get(n, []),
            'ids': [it['i'] for it in sorted((it for it in items if it['cl'] == n), key=lambda r: -r['sp'])]}
           for n in names]

meta = {'date': run_day.strftime('%A %-d %B %Y'), 'from': period[0].strftime('%-d %b'),
        'to': period[1].strftime('%-d %b'), 'fx': {k.strip(): v for k, v in FX.items() if v != 1}}
data = {'items': items, 'clients': clients, 'fixes': notes['fixes'], 'themes': notes['themes'],
        'concepts': concepts, 'conceptNotes': notes.get('concepts', []), 'meta': meta}
blob = json.dumps(data, ensure_ascii=False).replace('</', '<\\/')
logo_path = os.path.join(ROOT, '.claude', 'skills', 'vendo-brand', 'assets', 'logo', 'VD_LOGO_WHITE.svg')
logo = open(logo_path).read().replace('<svg ', '<svg class="logo" role="img" aria-label="Vendo" ', 1)
tpl = open(os.path.join(HERE, 'template.html')).read()
os.makedirs(os.path.join(RUN, 'site'), exist_ok=True)
open(os.path.join(RUN, 'site', 'index.html'), 'w').write(tpl.replace('/*DATA*/', blob).replace('<!--LOGO-->', logo))

# ---------- sheet payload ----------
def money(cur, v):
    return f"{v:,.0f} kr" if cur.strip() == 'DKK' else f"{cur}{v:,.0f}"


creative_rows = []
for n in names:
    for it in sorted((it for it in items if it['cl'] == n), key=lambda r: -r['sp']):
        x = c[it['i']]
        tg = it['tg'] or {}
        res = f"ROAS {it['roas']} · {it['pu']} sales" if it['ecom'] else f"{it['vc'] + it['ld']} results"
        creative_rows.append({
            'preview': x['preview'] or '', 'client': n, 'ad': it['n'], 'type': 'Video' if it['v'] else 'Static',
            'status': it['st'], 'launch': it['ln'], 'flag': it['fl'] or '',
            'format': tg.get('format', ''), 'angle': tg.get('angle', ''), 'offer': tg.get('offer', ''),
            'persona': tg.get('persona', ''), 'spend': money(ws_cur.get(n, '£'), it['sp']),
            'thumbstop': f"{it['ts']}%" if it['ts'] is not None else '', 'thruplay': f"{it['hold']}%" if it['hold'] else '',
            'ctr': f"{it['ctr']}%", 'results': res, 'hook': (it['sc'][:220] if it['sc'] else ''),
            'copy': '\n\n'.join(it['tx']), 'headlines': '\n'.join(it['hl']), 'play': it['url'] or '',
            'campaign': f"{it['cp']} › {it['as']}"})
payload = {'title': 'Creative Wash-Up (Vendo only)', 'runDate': run_day.isoformat(),
           'period': f"{meta['from']} to {meta['to']}", 'fixes': notes['fixes'], 'themes': notes['themes'],
           'clients': {n: notes['clients'].get(n, []) for n in names}, 'concepts': concepts,
           'conceptNotes': notes.get('concepts', []), 'creatives': creative_rows,
           'pageUrl': json.load(open(os.path.join(CACHE, 'artifact.json')))['url']}
json.dump(payload, open(os.path.join(RUN, 'sheet-payload.json'), 'w'), indent=1, ensure_ascii=False)
print(f'built page ({len(items)} creatives, {len(clients)} accounts) and sheet payload')
