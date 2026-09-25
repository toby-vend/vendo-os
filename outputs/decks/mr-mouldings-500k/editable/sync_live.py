# Replaces our slides in the live Google Slides export with freshly built versions,
# in place. Slides someone has edited in Google since our last upload are skipped.
# Slides between the SECTION 03 and SECTION 04 dividers (Matthew's paid search) are
# never touched, and nothing the team deleted is re-added.
#   sync_live.py <live.pptx> <last_uploaded.pptx> <ours.pptx> <keys.txt> <out.pptx>
import copy, io, re, sys
from pptx import Presentation
from pptx.oxml.ns import qn
from pptx.opc.packuri import PackURI

live_p, prev_p, ours_p, keys_p, out_p = sys.argv[1:6]
live, prev, ours = Presentation(live_p), Presentation(prev_p), Presentation(ours_p)
keys = [k.strip() for k in open(keys_p) if k.strip()]
assert len(keys) == len(ours.slides)

def norm(t): return re.sub(r'\s+', ' ', t).strip()
def head(s, prs): return norm(' '.join(sh.text_frame.text for sh in s.shapes if sh.has_text_frame and sh.top < prs.slide_height * 0.2))
def body(s):  # all text except footer numbers
    return norm(' '.join(sh.text_frame.text for sh in s.shapes if sh.has_text_frame and not re.fullmatch(r'\d\d', sh.text_frame.text.strip())))

live_slides = list(live.slides)
heads = [head(s, live) for s in live_slides]
i3 = next(i for i, h in enumerate(heads) if h.startswith('SECTION 03'))
i4 = next(i for i, h in enumerate(heads) if h.startswith('SECTION 04'))
protected = set(range(i3 + 1, i4))
live_ours = [s for i, s in enumerate(live_slides) if i not in protected]
our_pairs = [(k, s) for k, s in zip(keys, ours.slides) if k != 'Paid']
assert len(live_ours) == len(our_pairs), (len(live_ours), len(our_pairs))

prev_by_head = {}
for s in prev.slides: prev_by_head.setdefault(head(s, prev), s)

layout = min(live.slide_layouts, key=lambda l: len(l.placeholders))
def copy_in(src):
    dst = live.slides.add_slide(layout)
    for ph in list(dst.placeholders): ph._element.getparent().remove(ph._element)
    bg = src._element.cSld.find(qn('p:bg'))
    if bg is not None: dst._element.cSld.insert(0, copy.deepcopy(bg))
    tree = dst.shapes._spTree
    for el in src.shapes._spTree.iterchildren():
        if el.tag in (qn('p:nvGrpSpPr'), qn('p:grpSpPr')): continue
        tree.append(copy.deepcopy(el))
    for blip in tree.iter(qn('a:blip')):
        blob = src.part.related_part(blip.get(qn('r:embed'))).blob
        _, rid = dst.part.get_or_add_image_part(io.BytesIO(blob))
        blip.set(qn('r:embed'), rid)
    return dst

sld = live.slides._sldIdLst
skipped, replaced = [], 0
for (key, src), old in zip(our_pairs, live_ours):
    if key == 'Main': continue
    before = prev_by_head.get(head(old, live))
    if before is None or body(before) != body(old):
        skipped.append((key, head(old, live)[:60])); continue
    old_el = next(el for el in sld if el.get('id') == str(old.slide_id))
    pos = list(sld).index(old_el)
    dst = copy_in(src)
    new_el = next(el for el in sld if el.get('id') == str(dst.slide_id))
    sld.remove(new_el); sld.insert(pos, new_el)
    live.part.drop_rel(old_el.get(qn('r:id'))); sld.remove(old_el)
    replaced += 1

for n, s in enumerate(live.slides, 1):
    s.part.partname = PackURI(f'/ppt/slides/slide{n}.xml')
    for sh in s.shapes:
        if sh.has_text_frame and re.fullmatch(r'\d\d', sh.text_frame.text.strip()) and sh.top > live.slide_height * 0.85:
            runs = sh.text_frame.paragraphs[0].runs
            runs[0].text = f'{n:02d}'
            for r in runs[1:]: r.text = ''
live.save(out_p)
print('replaced', replaced, 'slides; total', len(live.slides))
print('skipped (edited in Google or not matched):', skipped)
