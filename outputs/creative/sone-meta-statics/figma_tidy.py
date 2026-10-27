"""Write the use_figma script that tidies one persona capture.

Usage: python3 figma_tidy.py <persona> <wrapperId> "<page name>" > _qa/tidy-<persona>.js
Moves the capture's 15 boards onto their own page (created if missing), strips auto layout, names boards to the
build standard, locks grain/overlays, names photos, tiles grain, lays out rows and adds Inter copy cards.
Concept names come from build.py (board data-name), copy from copy-<persona>.md.
"""
import json, re, sys, importlib.util
from pathlib import Path

ROOT = Path(__file__).parent
persona, wrapper_id, page_name = sys.argv[1], sys.argv[2], sys.argv[3]
spec = importlib.util.spec_from_file_location("build", ROOT / "build.py"); b = importlib.util.module_from_spec(spec); spec.loader.exec_module(b)
concepts = [re.search(r'data-name="([^"]+?) \| 1x1', f("1x1")).group(1) for f in b.PERSONAS[persona]]
t = (ROOT / f"copy-{persona}.md").read_text()
copy = []
for blk in re.split(r"\n## (?=[A-Z]\d )", t)[1:]:
    copy.append({"title": blk.split("\n", 1)[0].strip(),
                 "headline": re.search(r"\*\*Headline:\*\* (.+)", blk).group(1).strip(),
                 "primary": re.search(r"\*\*Primary text:\*\*\n(.+?)\n---", blk + "\n---", re.S).group(1).strip()})
print(f"""const wrapper = await figma.getNodeByIdAsync({json.dumps(wrapper_id)});
const src = wrapper.parent;
let page = figma.root.children.find(p => p.name === {json.dumps(page_name)});
if (!page) {{ page = figma.createPage(); page.name = {json.dumps(page_name)}; }}
await figma.setCurrentPageAsync(page);
const CONCEPTS = {json.dumps(concepts)};
const COPY = {json.dumps(copy)};
const isBoard = n => n.type==='FRAME' && ((n.width===1080&&(n.height===1080||n.height===1920))||(n.width===1200&&n.height===628)) && !(n.parent && n.parent.width===n.width && n.parent.height===n.height);
const boards = wrapper.findAll(isBoard).map(b=>({{b, ax:b.absoluteTransform[0][2], ay:b.absoluteTransform[1][2]}})).sort((p,q)=>(p.ay-q.ay)||(p.ax-q.ax));
if (boards.length!==15) return {{error:'expected 15 boards', found: boards.length}};
const all = wrapper.findAll(n => n.type==='FRAME'); all.push(wrapper);
const depth = n => {{ let d=0, p=n.parent; while(p && p.type!=='PAGE'){{d++; p=p.parent;}} return d; }};
for (const f of all.filter(n => n.layoutMode && n.layoutMode!=='NONE').sort((a,b)=>depth(a)-depth(b))) {{
  const w=f.width,h=f.height, kids=f.children.map(c=>[c,c.x,c.y]); f.layoutMode='NONE'; f.resize(w,h); for (const [c,x,y] of kids) {{ c.x=x; c.y=y; }}
}}
const sizes=["1x1","9x16","1.91x1"], ys={{"1x1":80,"9x16":2080,"1.91x1":4120}};
let locked=0, photos=0; const res=[];
boards.forEach(({{b}},k)=>{{
  const size=sizes[Math.floor(k/5)], i=k%5, w=b.width, h=b.height;
  page.appendChild(b); b.resize(w,h); b.x=80+i*(size==="1.91x1"?1280:1160); b.y=ys[size];
  b.name=`${{CONCEPTS[i]}} | ${{size}} | 261026`; b.cornerRadius=0; b.effects=[]; b.clipsContent=true;
  for (const n of b.findAll(n => 'fills' in n && Array.isArray(n.fills))) {{
    const img=n.fills.find(f=>f.type==='IMAGE'), full=Math.abs(n.width-w)<2&&Math.abs(n.height-h)<2, last=n.parent===b&&b.children.indexOf(n)===b.children.length-1;
    if (img && (img.scaleMode==='TILE'||(full&&last))) {{ n.fills=n.fills.map(f=>f.type==='IMAGE'?{{...f,scaleMode:'TILE',scalingFactor:0.5}}:f); n.name='Grain (locked)'; n.locked=true; locked++; }}
    else if (img) {{ n.name='Photo'; photos++; }}
    else if (full && n.fills.some(f=>f.type&&f.type.startsWith('GRADIENT'))) {{ n.name='Overlay (locked)'; n.locked=true; locked++; }}
  }}
  res.push(b.id+' '+b.name);
}});
wrapper.remove();
await figma.loadFontAsync({{family:'Inter',style:'Regular'}}); await figma.loadFontAsync({{family:'Inter',style:'Semi Bold'}}); await figma.loadFontAsync({{family:'Inter',style:'Bold'}});
const cards=[];
for (let i=0;i<COPY.length;i++) {{
  const c=COPY[i];
  const card=figma.createAutoLayout('VERTICAL',{{name:`Copy | ${{c.title}}`, itemSpacing:18}});
  card.paddingLeft=card.paddingRight=40; card.paddingTop=card.paddingBottom=36; card.fills=[{{type:'SOLID',color:{{r:1,g:1,b:1}}}}]; card.cornerRadius=12;
  page.appendChild(card); card.resize(1080,100); card.counterAxisSizingMode='FIXED'; card.primaryAxisSizingMode='AUTO'; card.x=80+i*1160; card.y=1220;
  const mk=(txt,style,size,color)=>{{ const t=figma.createText(); t.fontName={{family:'Inter',style}}; t.fontSize=size; t.characters=txt; t.fills=[{{type:'SOLID',color}}]; card.appendChild(t); t.layoutSizingHorizontal='FILL'; t.textAutoResize='HEIGHT'; return t; }};
  mk(c.title,'Bold',24,{{r:0,g:0,b:0}}); mk('HEADLINE','Semi Bold',14,{{r:.45,g:.45,b:.45}}); mk(c.headline,'Semi Bold',22,{{r:.1,g:.1,b:.1}});
  mk('PRIMARY TEXT','Semi Bold',14,{{r:.45,g:.45,b:.45}}); const p=mk(c.primary,'Regular',18,{{r:.1,g:.1,b:.1}}); p.lineHeight={{unit:'PERCENT',value:140}};
  const h=card.height, kids=card.children.map(k=>[k,k.x,k.y,k.width]); card.layoutMode='NONE'; card.resize(1080,h);
  for (const [k,x,y,w] of kids) {{ k.x=x; k.y=y; k.resize(w,k.height); k.textAutoResize='HEIGHT'; }}
  cards.push(card.id+' h='+Math.round(h));
}}
return {{page: page.id, src: src.id, boards: res, locked, photos, cards}};""")
