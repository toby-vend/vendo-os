# Merges new/changed slides into the live Google Slides export without touching
# anyone else's slides. Slides are identified by their text, not position, so edits
# made in Google Slides (e.g. Matthew's paid search section) survive.
#   merge_live.py <base.pptx exported from Google> <new_slides.pptx> <out.pptx>
import copy, io, re, sys
from pptx import Presentation
from pptx.oxml.ns import qn

base_path, new_path, out_path = sys.argv[1:4]
base = Presentation(base_path); new = Presentation(new_path)

def text(slide):
    return ' '.join(sh.text_frame.text for sh in slide.shapes if sh.has_text_frame).replace('\n', ' ')

SIG = [  # (key, phrase) — first match wins
 ('Main','Roadmap to £500k a month'),('Position','The business has grown'),('Trajectory','£500k is roughly where'),
 ('Gap','Two jobs: hold the trend'),('Customers','A repeat buyer is worth'),('Analytics','Clean data will make every channel'),
 ('Foundation','Five waves built and tested'),('SiteWork','A rebuilt site'),('SiteValue','Every 0.1 of a point'),
 ('Funnel','What each step'),('Checkout','ready to recover at'),('Organic','610,000 impressions a month, with'),
 ('OrganicPrize','The demand is already earned'),('SocialNow','Meta returns 10.7'),('SocialPlan','Four moves, in'),
 ('SocialForecast','Meta to £20k a month'),('CreativeIntro','How the creative is planned'),('Audience','Audience division'),
 ('PMarcus','PERSONA Marcus'),('PLee','PERSONA Lee'),('PRay','PERSONA Ray'),('PPriya','PERSONA Priya'),('PSophie','PERSONA Sophie'),
 ('PJamie','PERSONA Jamie'),('PHannah','PERSONA Hannah'),('PAdam','PERSONA Adam'),
 ('Personas','Personas at a'),('ContentFormats','Content formats for'),('PaidFormats','Paid content'),('FormatsByPersona','Formats by'),
 ('GreenFocuses','Green screen focuses'),('PodcastFocuses','Podcast focuses'),('FormatFocuses','Format focuses'),
 ('SocialOrganicNow','The foundations are'),('SocialOrganicPerf','Strong reach, with'),('SocialOrganicWorks','winning format'),
 ('SocialOrganicNext','upgrades to the plan'),('SocialSeries','one shoot a quarter'),('SocialPodcast','Sixty years of trade knowledge'),
 ('SocialPodcastBank','episodes ready to go'),('SocialCreators','A creator programme'),('SocialQuarter','The quarter at a'),
 ('Hardwood','Tulipwood is already'),('Launch','Release by period'),('Specification','specify'),('Builders','Buy the content'),
 ('Flooring','Big demand, worth'),('Roadmap','A sequence, not a shopping'),('Budget','Investment to'),
 ('Inputs','Almost everything is in'),('Next','The first thirty'),
]
def head(slide):
    # eyebrow + title + standfirst: text boxes in the top fifth of the slide
    return ' '.join(sh.text_frame.text for sh in slide.shapes
                    if sh.has_text_frame and sh.top < base.slide_height * 0.2).replace('\n', ' ')
def key_of(slide):
    t = re.sub(r'\s+', ' ', head(slide))
    for k, ph in SIG:
        if ph in t: return k
    if 'Roadmap to £500k a month' in text(slide) and 'STRATEGY PRESENTATION' in text(slide): return 'Main'
    return None

base_slides = list(base.slides)
keys = [key_of(s) for s in base_slides]
print('unmatched (kept as-is):', [i + 1 for i, k in enumerate(keys) if k is None])
dupes = {k for k in keys if k and keys.count(k) > 1}
assert not dupes, f'ambiguous matches: {dupes}'

NEW_KEYS = ['Agenda'] + [f'Div{i}' for i in range(1, 10)] + [f'Seo{i}' for i in range(1, 11)] + ['Gap', 'Roadmap']
assert len(new.slides) == len(NEW_KEYS)
REMOVE = {'Organic', 'OrganicPrize', 'CreativeIntro', 'Flooring', 'Gap', 'Roadmap'}

# blank-ish layout from the base deck
layout = min(base.slide_layouts, key=lambda l: len(l.placeholders))

def copy_in(src):
    dst = base.slides.add_slide(layout)
    for ph in list(dst.placeholders): ph._element.getparent().remove(ph._element)
    src_bg = src._element.cSld.find(qn('p:bg'))
    if src_bg is not None:
        dst._element.cSld.insert(0, copy.deepcopy(src_bg))
    tree = dst.shapes._spTree
    for el in src.shapes._spTree.iterchildren():
        if el.tag in (qn('p:nvGrpSpPr'), qn('p:grpSpPr')): continue
        tree.append(copy.deepcopy(el))
    for blip in tree.iter(qn('a:blip')):
        rid = blip.get(qn('r:embed'))
        blob = src.part.related_part(rid).blob
        _, new_rid = dst.part.get_or_add_image_part(io.BytesIO(blob))
        blip.set(qn('r:embed'), new_rid)
    return dst

new_by_key = {k: copy_in(s) for k, s in zip(NEW_KEYS, new.slides)}

# final order: our keys in section order; unmatched slides (e.g. Matthew's) stay together after their preceding matched slide
ORDER = ['Main','Agenda','Div1','Position','Trajectory','Gap','Customers','Analytics','Div2'] + [f'Seo{i}' for i in range(1, 11)] + \
 ['Div3','@PAIDSEARCH','Div4','Audience','PMarcus','PLee','PRay','PPriya','PSophie','PJamie','PHannah','PAdam','Personas','ContentFormats',
  'PaidFormats','FormatsByPersona','FormatFocuses','GreenFocuses','PodcastFocuses','Div5','SocialOrganicNow','SocialOrganicPerf',
  'SocialOrganicWorks','SocialOrganicNext','SocialSeries','SocialPodcast','SocialPodcastBank','SocialCreators','SocialQuarter',
  'Div6','Hardwood','Launch','Specification','Builders','Div7','Roadmap','Budget','Inputs','Next','Div8','SocialNow','SocialPlan',
  'SocialForecast','Div9','Foundation','SiteWork','SiteValue','Funnel','Checkout']

by_key = {k: s for k, s in zip(keys, base_slides) if k and k not in REMOVE}
by_key.update(new_by_key)
unmatched = [s for s, k in zip(base_slides, keys) if k is None]
missing = [k for k in ORDER if not k.startswith('@') and k not in by_key]
assert not missing, f'missing slides: {missing}'

final = []
for k in ORDER:
    if k == '@PAIDSEARCH': final.extend(unmatched)
    else: final.append(by_key[k])

# drop removed slides, then reorder sldIdLst
sld_lst = base.slides._sldIdLst
id_of = {s.slide_id: el for el in sld_lst for s in [None] if False}
el_by_slide = {}
for el in list(sld_lst):
    el_by_slide[el.get('id')] = el
keep_ids = {str(s.slide_id) for s in final}
for el in list(sld_lst):
    if el.get('id') not in keep_ids:
        base.part.drop_rel(el.get(qn('r:id'))); sld_lst.remove(el)
for s in final:
    el = el_by_slide[str(s.slide_id)]; sld_lst.remove(el); sld_lst.append(el)

# tidy text: drop old "NN · " eyebrow prefixes and renumber our footers
for n, s in enumerate(base.slides, 1):
    for sh in s.shapes:
        if not sh.has_text_frame: continue
        tf = sh.text_frame
        full = tf.text.strip()
        if re.fullmatch(r'\d\d', full) and sh.top > base.slide_height * 0.85:
            r = tf.paragraphs[0].runs[0]; r.text = f'{n:02d}'
            for extra in tf.paragraphs[0].runs[1:]: extra.text = ''
            continue
        if re.match(r'^\d\d · ', full):
            for p in tf.paragraphs:
                if p.runs and re.match(r'^\d\d · ', p.runs[0].text):
                    p.runs[0].text = re.sub(r'^\d\d · ', '', p.runs[0].text); break
base.save(out_path)
print('slides:', len(base.slides))
