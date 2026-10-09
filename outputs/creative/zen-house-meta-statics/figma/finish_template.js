const SITE=__SITE__, PAGE=__PAGE__, W1=__W1__, W9=__W9__;
const C=__DATA__;
const fix=t=>t.split('[Banstead / Battersea]').join(SITE).split('[the High Street in Banstead / Northcote Road in Battersea]').join(SITE==='Banstead'?'the High Street in Banstead':'Northcote Road in Battersea');
const page=await figma.getNodeByIdAsync(PAGE); await figma.setCurrentPageAsync(page);
const depth=n=>{let d=0,p=n.parent;while(p){d++;p=p.parent;}return d;};
const out={rows:{}};
for (const [wid,size] of [[W1,'1x1'],[W9,'9x16']]) {
  const wrap=await figma.getNodeByIdAsync(wid);
  for (const t of wrap.findAllWithCriteria({types:['TEXT']})) for (const f of t.getRangeAllFontNames(0,t.characters.length)) { try{await figma.loadFontAsync(f);}catch(e){} }
  const all=wrap.findAll(()=>true); const geo=new Map();
  for (const n of all){const m=n.absoluteTransform; geo.set(n.id,{ax:m[0][2],ay:m[1][2],w:n.width,h:n.height,d:depth(n)});}
  for (const f of all.filter(n=>'layoutMode' in n&&n.layoutMode!=='NONE').sort((a,b)=>geo.get(a.id).d-geo.get(b.id).d)) f.layoutMode='NONE';
  for (const n of all.sort((a,b)=>geo.get(a.id).d-geo.get(b.id).d)){ const g=geo.get(n.id); if(!n.parent||n.parent.id===wid) continue; const p=geo.get(n.parent.id); if(!p) continue;
    if('resize' in n&&n.type!=='TEXT'&&(Math.abs(n.width-g.w)>.5||Math.abs(n.height-g.h)>.5)){try{n.resize(Math.max(g.w,.01),Math.max(g.h,.01));}catch(e){}}
    n.x=g.ax-p.ax; n.y=g.ay-p.ay; }
  const boards=[...wrap.children[0].children].filter(b=>b.width>100);
  const y = size==='1x1'?80:2560;
  boards.forEach((b,i)=>{ page.appendChild(b); b.x=80+i*1160; b.y=y; b.clipsContent=true; const c=C[i]; b.name=`${c[1]} | Static | ${c[2]} | ${SITE} | ${size} | 261009`;
    for (const n of b.findAll(n=>n.type!=='TEXT'&&'fills' in n&&Array.isArray(n.fills))){ const f=n.fills;
      if(f.some(p=>p.type==='IMAGE')) n.name='Photo';
      else if(n.parent===b&&Math.abs(n.width-b.width)<2&&Math.abs(n.height-b.height)<2&&(!('children' in n)||n.children.length===0)&&f.some(p=>p.type.startsWith('GRADIENT'))){ n.name='Overlay (locked)'; n.locked=true; } } });
  wrap.remove(); out.rows[size]=boards.length;
}
await figma.loadFontAsync({family:'Inter',style:'Regular'}); await figma.loadFontAsync({family:'Inter',style:'Bold'});
let maxH=0;
C.forEach((c,i)=>{ const card=figma.createFrame(); card.name=`Copy | ${c[0]} ${c[1]} | ${SITE}`; card.fills=[{type:'SOLID',color:{r:1,g:1,b:1}}]; card.cornerRadius=12;
  const mk=(txt,size,bold,y,col)=>{const t=figma.createText(); t.fontName={family:'Inter',style:bold?'Bold':'Regular'}; t.fontSize=size; t.characters=txt; t.fills=[{type:'SOLID',color:col||{r:.1,g:.1,b:.1}}]; t.textAutoResize='HEIGHT'; t.resize(1000,t.height); t.x=40; t.y=y; card.appendChild(t); return t;};
  const a=mk(`${c[0]} | ${c[1]} | ${SITE}`,22,true,36,{r:.45,g:.37,b:.25});
  const b=mk('HEADLINE',14,true,a.y+a.height+24,{r:.5,g:.5,b:.5});
  const h=mk(fix(c[3]),26,true,b.y+b.height+6);
  const p=mk('PRIMARY TEXT',14,true,h.y+h.height+24,{r:.5,g:.5,b:.5});
  const t=mk(fix(c[4]),19,false,p.y+p.height+8);
  card.resize(1080,t.y+t.height+40); page.appendChild(card); card.x=80+i*1160; card.y=1240; maxH=Math.max(maxH,card.height); });
out.cards=C.length; out.maxCard=Math.round(maxH);
return out;
