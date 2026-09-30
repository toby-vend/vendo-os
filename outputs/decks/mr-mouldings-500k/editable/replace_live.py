# Replaces specific slides in the live Google Slides export, in place, leaving every
# other slide (and the order) exactly as the team has it.
#   replace_live.py <base.pptx> <new.pptx> <out.pptx> "<heading phrase 1>" "<heading phrase 2>" ...
# New slide n replaces the base slide whose heading area contains phrase n.
import copy, io, re, sys
from pptx import Presentation
from pptx.oxml.ns import qn

base_path, new_path, out_path, *phrases = sys.argv[1:]
base = Presentation(base_path); new = Presentation(new_path)
assert len(new.slides) == len(phrases), 'one phrase per new slide'

def head(slide):
    return re.sub(r'\s+', ' ', ' '.join(sh.text_frame.text for sh in slide.shapes
                  if sh.has_text_frame and sh.top < base.slide_height * 0.2))

layout = min(base.slide_layouts, key=lambda l: len(l.placeholders))
def copy_in(src):
    dst = base.slides.add_slide(layout)
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

sld_lst = base.slides._sldIdLst
for src, phrase in zip(list(new.slides), phrases):
    matches = [s for s in base.slides if phrase in head(s)]
    assert len(matches) == 1, f'{phrase!r} matched {len(matches)} slides'
    old = matches[0]
    old_el = next(el for el in sld_lst if el.get('id') == str(old.slide_id))
    pos = list(sld_lst).index(old_el)
    dst = copy_in(src)
    new_el = next(el for el in sld_lst if el.get('id') == str(dst.slide_id))
    sld_lst.remove(new_el); sld_lst.insert(pos, new_el)
    base.part.drop_rel(old_el.get(qn('r:id'))); sld_lst.remove(old_el)
    print('replaced', phrase, 'at', pos + 1)

# renumber our footers to match their final position
for n, s in enumerate(base.slides, 1):
    for sh in s.shapes:
        if sh.has_text_frame and re.fullmatch(r'\d\d', sh.text_frame.text.strip()) and sh.top > base.slide_height * 0.85:
            runs = sh.text_frame.paragraphs[0].runs
            runs[0].text = f'{n:02d}'
            for r in runs[1:]: r.text = ''
base.save(out_path)
print('slides:', len(base.slides))
