# SEO slides (from mr-mouldings-seo-slides.pptx), agenda and section dividers.
import html
MINT='#8EFEBB'; AMBER='#F5D674'
G='rgba(142,254,187,.09);border-color:rgba(142,254,187,.30)'
A='rgba(245,214,116,.08);border-color:rgba(245,214,116,.35)'
def e(s): return html.escape(s,quote=False).replace('—','&#8212;').replace('–','&#8211;').replace('×','&#215;').replace('·','&#183;').replace('→','&#8594;')
def b(s): return f'<strong style="color:#fff">{e(s)}</strong>'
def pl(t,amber=False): return f'<span class="pill {"p-hold" if amber else "p-go"}">{e(t)}</span>'
S={}; H={}

# ---------- SEO ----------
S['Seo1']=f'''<div class="bd" style="flex-direction:column;gap:14px">
<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1.45fr;gap:14px">
<div class="card" style="background:{G}"><p class="lbl">UK clicks, last 30 days</p><p class="stat" style="font-size:44px">6,200</p><p class="note" style="margin-top:10px">2,854 a year ago &#183; 2.17&#215;</p></div>
<div class="card"><p class="lbl">All countries, last 30 days</p><p class="statw" style="font-size:44px">7,031</p><p class="note" style="margin-top:10px">3,646 a year ago &#183; 1.93&#215;</p></div>
<div class="card"><p class="lbl">UK impressions, last 30 days</p><p class="statw" style="font-size:44px">565,994</p><p class="note" style="margin-top:10px">Not compared: see note</p></div>
<div class="card" style="background:{G}"><p style="margin:0;font-size:17px;line-height:1.5"><strong style="color:{MINT}">Clicks are the clean measure.</strong> <span class="mut">They count real visits from Google, and they have doubled in a year on the range the site already sells.</span></p></div>
</div>
<p class="note">Google changed how Search Console counts impressions and positions in September 2025, so only clicks compare cleanly with last year.</p>
<div class="card" style="display:flex;gap:40px;align-items:center;padding:28px 30px"><div style="flex:0 0 250px"><p class="lbl">Where organic sits in the £500k</p><p class="stat" style="font-size:52px;color:{AMBER}">7.6%</p></div>
<p class="mut" style="flex:1;margin:0;font-size:16px">of site revenue came through organic search in the twelve months to May 2026. Paid search carried 30% and direct 27%.</p>
<p style="flex:1.2;margin:0;font-size:16px"><strong style="color:#fff">The room to grow.</strong> <span class="mut">Organic clicks have doubled on today's range. The slides that follow show where the next clicks are, and how the new product lines give the site more to rank for.</span></p></div>
</div>'''
H['Seo1']=('SEO &#183; Where organic stands','Organic clicks have <span class="fl">doubled</span> in a year',"The same thirty days, a year apart. Google UK, from the site's own Search Console.")

groups=[('Positions 1–3','Top of page one',14,26),('Positions 4–10','Rest of page one',45,53),('Positions 11–20','Page two',34,19),('Position 21+','Page three onwards',7,2)]
bars=''
for c,sub_,i,k in groups:
    hi=round(i/60*330); hk=round(k/60*330)
    bars+=f'''<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:380px">
<div style="display:flex;gap:6px;align-items:flex-end">
<div style="display:flex;flex-direction:column;align-items:center;gap:4px"><span style="font-size:15px;color:#B9C7C0;font-weight:700">{i}%</span><div style="width:56px;height:{hi}px;background:#2F5A50;border-radius:3px 3px 0 0"></div></div>
<div style="display:flex;flex-direction:column;align-items:center;gap:4px"><span style="font-size:15px;color:{MINT};font-weight:800">{k}%</span><div style="width:56px;height:{hk}px;background:{MINT};border-radius:3px 3px 0 0"></div></div>
</div></div>'''
labels=''.join(f'<div style="flex:1;text-align:center"><p style="margin:10px 0 0;font-size:14px;color:#fff;font-weight:700">{e(c)}</p><p style="margin:0;font-size:13px;color:#8FA39B">{e(sub_)}</p></div>' for c,sub_,_,_ in groups)
S['Seo2']=f'''<div class="bd">
<div class="col" style="flex:1.45"><div class="card" style="height:100%"><p class="lbl">Share by position range &#183; UK &#183; 90 days &#183; non-brand</p>
<div style="display:flex;gap:28px;margin:6px 0 4px"><div style="display:flex;align-items:center;gap:8px"><div style="width:12px;height:12px;background:#2F5A50"></div><span style="font-size:14px;color:#B9C7C0">Share of times Google showed the site</span></div><div style="display:flex;align-items:center;gap:8px"><div style="width:12px;height:12px;background:{MINT}"></div><span style="font-size:14px;color:#B9C7C0">Share of clicks the site got</span></div></div>
<div style="display:flex;border-bottom:1px solid rgba(255,255,255,.12)">{bars}</div><div style="display:flex">{labels}</div>
<p class="note" style="margin-top:10px">Read across each pair: page one gets more than its share of clicks, page two much less.</p></div></div>
<div class="col" style="flex:1">
<div class="card" style="background:{G}"><p class="lbl" style="color:{MINT}">Share of searchers who click, this site</p>'''+''.join(f'<div class="kv"><span class="k" style="font-size:16px">{p}</span><span class="v" style="color:{MINT};font-size:20px">{v}</span></div>' for p,v in [('Position 1','9.4%'),('Position 3','3.0%'),('Position 5','1.7%'),('Position 10','0.7%'),('Page two','0.5%')])+f'''</div>
<div class="card"><h3>Page two is the cheapest traffic in the plan.</h3><p class="mut" style="margin:0;font-size:15px">It holds 34% of impressions and earns 19% of clicks. A term that moves from page two to position 5 gets about three times the clicks, from pages that already exist.</p></div>
</div></div>'''
H['Seo2']=('SEO &#183; The ranking gap','Page one is where the <span class="fl">clicks</span> are','How often Google showed the site, and how often people clicked, by where it ranked. UK, last 90 days, brand searches excluded.')

rows=[('Oct','/collections/dado-rails','dado rail 33,100 · mdf dado rail 880','11.9','The combined dado and picture rail page competes with this one and lists every product on it. Fold it in here (a redirect, so it needs sign-off) and move its 5 rebated trims across.'),
('Oct','/collections/picture-rails','picture rail 12,100 (incl. picture rails)','11.4','Split today between the combined page and this one. After the fold this is the only picture rail page: title and intro lead with "Picture Rail".'),
('Nov','/collections/architrave','door architrave 9,900 (incl. architrave door)','12–18','Three architrave collections share the term: this, thin and modern. Make this the door architrave page with its own title, and link the other two to it.'),
('Nov','/collections/mdf-skirting-boards','mdf skirting board 4,400 · mdf skirting 2,400','12–14','Google shows the homepage and one product; this collection does not appear. Add intro copy and link here from the homepage and every MDF skirting product.'),
('Nov','/collections/cornices','cornice 12,100','14.4','Google already picks this page. A second collection, /cornice, lists the same 46 products: fold it in after sign-off. Most of the gain is copy and links here.'),
('Dec','/collections/ogee-skirting-boards','ogee skirting 6,600','15.4','Google already picks this page. It needs buying copy on the profile and sizes, and a link from every ogee product back to it.'),
('Dec','/collections/torus-skirting-boards|/products/torus-architrave','torus skirting board 4,400 · torus architrave 1,900','11–13','Skirting: Google already picks the collection, so copy and links. Architrave: Google picks the Torus product page, so we strengthen that page.'),
('Dec','/collections/ovolo-architrave|/collections/stepped-architrave','ovolo architrave 720 · stepped architrave 210','14–17','Ovolo: the collection leads, so copy and links. Stepped: the collection and four stepped products split the term, so the products link to the collection.')]
tr=''.join(f'<tr><td style="color:{MINT};font-weight:700">{w}</td><td style="color:#fff;font-weight:600">{''.join(f'<div style="margin-bottom:3px">{x}</div>' for x in p.split('|'))}</td><td class="mut">{e(s)}</td><td class="n" style="color:{AMBER};font-weight:700">{e(pos)}</td><td class="mut" style="padding-left:18px">{e(d)}</td></tr>' for w,p,s,pos,d in rows)
S['Seo3']=f'''<style>.seo3 td{{padding:6px 12px 6px 0;vertical-align:top;line-height:1.3}}</style><div class="bd" style="flex-direction:column;gap:12px;padding-top:20px">
<table class="seo3" style="font-size:12.5px"><thead><tr><th style="width:50px">When</th><th style="width:240px">Page</th><th style="width:250px">Searches a month it should win</th><th class="n" style="width:70px">Position</th><th style="padding-left:18px">What we will do</th></tr></thead><tbody>{tr}</tbody></table>
<div style="display:flex;gap:24px;align-items:center"><div class="card" style="flex:0 0 640px;background:{G};padding:16px 22px"><p style="margin:0;font-size:15px"><strong style="color:{MINT};font-size:22px">57 &#8594; about 1,500</strong> <span class="mut">visits a month at position 5, about 2,700 at position 3</span></p></div>
<p class="note" style="flex:1">At this site's own click-through: 1.7% at position 5, 3.0% at 3. The largest terms, skirting board (90,500 a month), architrave (27,100) and window sill (27,100), also sit on page two and follow once these land.</p></div>
</div>'''
H['Seo3']=('SEO &#183; Page two','Eight pages one step from <span class="fl">page one</span>','Each already ranks on page two for a term with real demand. UK, last 90 days, checked page by page.')

S['Seo4']=f'''<div class="bd" style="gap:18px">
<div class="col" style="flex:1.2"><p class="lbl">UK searches a month</p><table style="font-size:15px"><thead><tr><th>Search term</th><th class="n">Searches / mo</th></tr></thead><tbody>
<tr><td>tulip mouldings</td><td class="n">10</td></tr><tr><td>tulipwood skirting board</td><td class="n">10</td></tr><tr><td>timber, hardwood and wooden terms</td><td class="n">17,500</td></tr><tr><td>oak skirting and architrave terms</td><td class="n">5,900</td></tr><tr class="hi"><td>Addressable with Tulipwood and oak</td><td class="n">23,400</td></tr></tbody></table></div>
<div class="col" style="flex:0 0 280px">
<div class="card" style="background:{G}"><p class="lbl" style="color:{MINT}">Already showing</p><p class="stat" style="font-size:44px">~3,200</p><p class="mut" style="margin:10px 0 0;font-size:15px">times a month Google shows the site for timber skirting, architrave and moulding searches, before the range exists.</p></div>
<div class="card"><p style="margin:0;font-size:15px"><strong style="color:#fff">The demand is on the material.</strong> <span class="mut">"Tulip" also means a floral profile elsewhere in the catalogue, so it stays in titles and filters, not page names.</span></p></div></div>
<div class="col" style="flex:1"><div class="card"><h3>How the pages are built</h3>'''+''.join(f'<p style="margin:12px 0 0;font-size:15px"><strong style="color:#fff">{e(a)}</strong><br><span class="mut">{e(c)}</span></p>' for a,c in [('A Solid Hardwood range page','at the top of the menu, named in search language.'),('Collections by product type','hardwood skirting, architrave, dado and panel mould, where the searches land.'),('Oak as its own products','not a dropdown, so each species can rank for its own searches.'),('Periods as the room sets','Georgian first, as the release order and a filter across every page.')])+'</div></div></div>'
H['Seo4']=('SEO &#183; Solid hardwood','Name the range for how people <span class="fl">search</span>','Tulipwood is the range. Hardwood, timber and oak are what people type.')

def idea(tag,amber,title,num,unit,desc,needs,hl=False):
    return f'''<div class="card" style="display:flex;flex-direction:column;{"background:rgba(142,254,187,.09);border-color:rgba(142,254,187,.30)" if hl else ""}">{pl(tag,amber)}<h3 style="margin-top:14px;font-size:20px">{e(title)}</h3><p class="stat" style="font-size:40px;{"color:"+AMBER if amber else ""}">{num}</p><p class="note" style="margin-top:6px">{e(unit)}</p><p class="mut" style="font-size:15px;margin:16px 0 0">{e(desc)}</p><p class="lbl" style="margin:auto 0 6px;padding-top:16px">What it needs</p><p style="margin:0;font-size:15px;color:#fff;min-height:46px">{e(needs)}</p></div>'''
S['Seo5']=f'''<div class="bd" style="flex-direction:column;gap:14px"><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;flex:1">
{idea('Do first',False,'Bobbin mouldings','3,040','searches a month','Google already shows the site for bobbin searches, with nothing to land on. The top results are small specialists; the big retailers only sell plastic strips.','Confirmation you can make it, and in which profiles: trim, dado and picture rail.',True)}
{idea('Do second',False,'LED coving','8,270','searches a month · "led coving" alone 6,600','The largest of the three. Buyers shop for a coving shape with space for the light strip, and no strong site holds the category.','Your pick of the cornice profiles that suit an LED gap.')}
{idea('Commercial call',True,'Ceiling roses','8,000','decorative searches a month, beside a 22,200 head term','Plaster is not off brand. W M Boyle sells plaster roses beside timber mouldings and ranks for both.','A decision to stock plaster, as its own range.')}
</div><div class="card" style="background:{G};padding:16px 22px"><p style="margin:0;font-size:16px"><strong style="color:{MINT}">All three sit behind the Solid Hardwood launch.</strong> <span class="mut">The hardwood range is built and waiting; none of these three exists yet.</span></p></div></div>'''
H['Seo5']=('SEO &#183; New categories','Three ideas from Adam, <span class="fl">ranked</span>','Bobbin, LED coving and ceiling roses. UK search demand, the competition, and what each would take.')

lines=[('Solid Hardwood','23,400',702,2200),('LED coving','8,270',248,777),('Ceiling roses','8,000',240,752),('Bobbin','3,040',91,286)]
hb=''.join(f'''<div style="display:flex;align-items:center;gap:16px;margin-bottom:34px"><div style="flex:0 0 190px"><p style="margin:0;font-size:17px;color:#fff;font-weight:700">{e(n)}</p><p style="margin:2px 0 0;font-size:13px;color:#8FA39B">{q} searches a month</p></div>
<div style="flex:1"><div style="display:flex;align-items:center;gap:8px;margin-bottom:5px"><div style="height:26px;width:{round(t/2200*420)}px;background:{MINT};border-radius:2px"></div><span style="font-size:14px;color:{MINT};font-weight:800">{t:,}</span></div>
<div style="display:flex;align-items:center;gap:8px"><div style="height:26px;width:{round(f/2200*420)}px;background:#2F5A50;border-radius:2px"></div><span style="font-size:14px;color:#B9C7C0;font-weight:700">{f:,}</span></div></div></div>''' for n,q,t,f in lines)
S['Seo6']=f'''<div class="bd">
<div class="col" style="flex:1.5"><div class="card" style="height:100%"><p class="lbl">Visits a month from Google &#183; UK</p>
<div style="display:flex;gap:28px;margin:6px 0 22px 206px"><div style="display:flex;align-items:center;gap:8px"><div style="width:12px;height:12px;background:{MINT}"></div><span style="font-size:14px;color:#B9C7C0">Visits a month at third place</span></div><div style="display:flex;align-items:center;gap:8px"><div style="width:12px;height:12px;background:#2F5A50"></div><span style="font-size:14px;color:#B9C7C0">Visits a month at first place</span></div></div>{hb}</div></div>
<div class="col" style="flex:1">
<div class="card" style="background:{G}"><p class="lbl" style="color:{MINT}">All four at third place</p><p class="stat" style="font-size:48px">+1,281</p><p class="mut" style="margin:12px 0 0;font-size:15px">visits a month, +21% on the 6,200 UK clicks Google sends the site today. About 4,000 if all four reach first place.</p></div>
<div class="card"><p class="lbl">The maths</p><p class="mut" style="margin:0;font-size:15px">LED coving: 8,270 searches &#215; 3.0% = 248 visits at third place, &#215; 9.4% = 777 at first. The same sum for each line, using the site's own non-brand click-through. Visits, not revenue: pound values follow once the lines sell.</p></div>
</div></div>'''
H['Seo6']=('SEO &#183; What the new lines add','From searches to <span class="fl">visits</span>','Searches a month become visits at the rate this site already earns: 3.0% of searchers click at third place, 9.4% at first.')

def cc(tag,title,text,hl=False): return f'<div class="card" style="padding:26px 28px;{"background:rgba(142,254,187,.09);border-color:rgba(142,254,187,.30)" if hl else ""}">{pl(tag)}<h3 style="margin-top:14px;font-size:21px">{e(title)}</h3><p class="mut" style="margin:0;font-size:16px">{e(text)}</p></div>'
S['Seo7']='<div class="bd" style="align-items:center"><div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;width:100%">'+cc('Paid search','Product titles feed Shopping','The LED coving results are mostly Shopping listings, so the product titles carry the words buyers search. Search-led collection names give every ad a page that matches its keyword.',True)+cc('Paid social','Bobbin is a social trend','Instagram and TikTok videos rank in Google\'s top ten for "bobbin moulding". Bobbin content made for Meta can also sit on the collection page.')+cc('Organic','Search sets the words','"Tulip mouldings" has no searches; timber and hardwood terms have 17,500 a month. The same names run across ads, pages and the menu, so every channel speaks the buyer\'s language.')+cc('Measurement','A baseline before launch','58 keywords tracked, 21 of them timber terms captured before the range goes live. The launch\'s effect on search can be shown, not assumed.')+'</div></div>'
H['Seo7']=('SEO &#183; Across channels','One set of pages, <span class="fl">three</span> channels','Every page SEO specifies is also where paid search and Meta traffic lands.')

def item(lbl,url,desc): return f'<p class="lbl" style="margin:14px 0 4px">{e(lbl)}</p>' if lbl else ''
def page(u,d): return f'<p style="margin:10px 0 0;font-size:13.5px"><span style="color:{MINT};font-weight:700">{e(u)}</span><br><span class="mut">{e(d)}</span></p>'
def para(t,bold=True): return f'<p style="margin:4px 0 0;font-size:14px;color:#fff;font-weight:{700 if bold else 400}">{e(t)}</p>'
oct_=f'<div class="card" style="flex:1.5;background:{G}"><h3 style="color:{MINT};font-size:22px">October</h3><p class="lbl" style="margin:6px 0 0">New pages &#183; Solid Hardwood, Georgian set, 16 products</p>'+page('/collections/timber-mouldings','Range page. Opens with the Georgian set; every period adds to it as it releases.')+page('/collections/hardwood-skirting-boards','Aysgarth, Ayton, Beckwithshaw and Helmsley skirting boards')+page('/collections/hardwood-architrave','The same four profiles as architrave')+page('/collections/hardwood-dado-rails','The same four as dado rail')+page('/collections/hardwood-panel-moulding','The same four as panel moulding')+'<p class="lbl" style="margin:16px 0 0">Page two</p>'+para('Fold the combined dado and picture rail page; dado and picture rail fixes')+'</div>'
nov=f'<div class="card" style="flex:1"><h3 style="font-size:22px">November</h3><p class="lbl" style="margin:6px 0 0">New page</p>'+page('/collections/bobbin-mouldings','Bobbin trim, bobbin dado rail and bobbin picture rail, in the profiles Adam confirms.')+'<p class="lbl" style="margin:18px 0 0">Page two</p>'+para('Door architrave, MDF skirting boards, cornice')+'<p class="lbl" style="margin:18px 0 0">Check</p>'+para('Georgian pages indexed and ranking in Search Console')+'</div>'
dec=f'<div class="card" style="flex:1"><h3 style="font-size:22px">December</h3><p class="lbl" style="margin:6px 0 0">Specs ready for January</p>'+para('Oak products and collections')+'<p class="mut" style="margin:0;font-size:13.5px">Named to match the Tulipwood set</p>'+para('LED coving collection')+'<p class="mut" style="margin:0;font-size:13.5px">Once Adam picks the cornices</p><p class="lbl" style="margin:18px 0 0">Page two</p>'+para('Ogee skirting, torus, ovolo and stepped architrave')+'<p class="lbl" style="margin:18px 0 0">Report</p>'+para('The quarter against the pre-launch baseline')+'</div>'
S['Seo8']=f'<div class="bd" style="gap:14px">{oct_}{nov}{dec}</div>'
H['Seo8']=('SEO &#183; October to December','The next <span class="fl">three</span> months','New pages, with their web addresses and the products on them, and the page-two fixes alongside.')

Q=[('Q4 2026 · Oct–Dec',[('Spec the Georgian hardwood pages',' for an October launch: the range page and four type collections, 16 products'),('Spec the eight page-two fixes',' dado and picture rail first, then architrave, skirting, cornice, ogee and torus'),('Spec the bobbin collection',' for November, once Adam confirms the profiles'),('Check the site release',' in Search Console: pages indexed, new titles picked up, no ranking drops')]),
('Q1 2027 · Jan–Mar',[('Spec oak as its own products',' and collections, named to match the Tulipwood set'),('Spec the LED coving collection',' with LED wording in product titles so it reaches Shopping too'),('Spec the Victorian and Edwardian sets',' into the hardwood collections as each releases'),('Rewrite titles and descriptions',' on terms at positions 4–10, which hold 45% of impressions')]),
('Q2 2027 · Apr–Jun',[('Spec the Contemporary set',' into the hardwood collections'),('Take on the largest page-two terms',' skirting board, architrave and window sill, once the first eight land'),('Spec a ceiling roses range',' if Adam decides to stock plaster'),('Review what ranked',' since launch and re-order the list')]),
('Q3 2027 · Jul–Sep',[('Build on what reached page one',' with more profiles and supporting pages'),('Research the next categories',' from searches rising in Search Console'),('Report the year',' rankings, clicks and revenue against the pre-launch baseline')])]
S['Seo9']='<div class="bd" style="gap:14px">'+''.join(f'<div class="card" style="flex:1;{"background:rgba(142,254,187,.09);border-color:rgba(142,254,187,.30)" if i==0 else ""}"><p class="lbl" style="{"color:"+MINT if i==0 else ""}">{e(q)}</p>'+''.join(f'<p style="margin:12px 0 0;font-size:14.5px;line-height:1.4"><strong style="color:#fff">{e(a)}</strong><span class="mut">{e(r)}</span></p>' for a,r in its)+'</div>' for i,(q,its) in enumerate(Q))+'</div>'
H['Seo9']=('SEO &#183; The sequence','The SEO work, <span class="fl">quarter</span> by quarter','Every item is ours to research, specify and check. Toby builds from our specs once they are signed off.')

steps=[('Research',"We pull search demand, competitor rankings and the site's own Search Console data, and size each opportunity in visits."),('Specify','We write the exact changes: URLs, page titles, headings, copy and internal links, ready to build with nothing left to interpret.'),('Build','Toby builds from the spec once it is signed off. Nothing reaches the live site any other way.'),('Check and report','We confirm each change is live and picked up in Search Console, then track rankings and clicks against the baseline every month.')]
needs=['Which cornices suit an LED gap','Whether to stock plaster ceiling roses','The bobbin profiles you can cut','Broughton panel mould confirmed as the 80th product']
S['Seo10']='<div class="bd" style="flex-direction:column;gap:16px"><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px">'+''.join(f'<div class="card" style="padding:26px 24px"><p class="stat" style="font-size:40px">0{i+1}</p><h3 style="margin-top:14px;font-size:21px">{e(t)}</h3><p class="mut" style="margin:0;font-size:15px">{e(d)}</p></div>' for i,(t,d) in enumerate(steps))+f'</div><div class="card" style="background:{A};padding:22px 26px"><h3 style="color:{AMBER}">What we need from Adam</h3><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:18px;margin-top:10px">'+''.join(f'<div style="display:flex;gap:12px;align-items:baseline"><span style="font-size:22px;font-weight:800;color:{AMBER}">0{i+1}</span><span style="font-size:15px;color:#fff">{e(n)}</span></div>' for i,n in enumerate(needs))+'</div></div></div>'
H['Seo10']=('SEO &#183; How the work runs','From search data to a <span class="fl">live</span> page','The same four steps for every item on the plan, reported monthly.')

# ---------- Agenda and dividers ----------
SECTIONS=[
 ('Div1','The opportunity',['Where the business is','The trajectory to £500k','What the plan is for','Who is buying','Clean measurement']),
 ('Div2','SEO',['Where organic stands','The ranking gap and page two','Solid hardwood and new categories','The next three months']),
 ('Div3','Paid search',['Year-to-date performance','Google Ads and Microsoft Advertising','Where the growth came from','Q4 focus']),
 ('Div4','Paid creative strategy',['Audience division','Eight personas','Personas at a glance','Content formats for paid','Format focuses']),
 ('Div5','Organic social',['Where we are today','What is working','Mini series and the podcast','The creator programme','The quarter at a glance']),
 ('Div6','New lines and channels',['Solid hardwood','Launching the range','Specification','High-end renovation builders']),
 ('Div7','Paid social',['Meta today','The plan','The forecast']),
 ('Div8','Website',['Five waves, ready to go live','Everything built','What the release is worth','The funnel, stage by stage','Recoverable revenue at checkout']),
]
for i,(k,title,items) in enumerate(SECTIONS):
    S[k]=f'''<div class="bd" style="align-items:center;gap:60px"><div class="col" style="flex:1"><p style="margin:0;font-family:'Instrument Serif',Georgia,serif;font-style:italic;font-size:150px;line-height:1;color:{MINT}">{i+1:02d}</p></div>
<div class="card" style="flex:0 0 560px;padding:30px 36px"><p class="lbl" style="color:{MINT}">In this section</p>'''+''.join(f'<p style="margin:12px 0 0;font-size:20px;color:#fff">{e(t)}</p>' for t in items)+'</div></div>'
    H[k]=(f'Section {i+1:02d}',e(title).replace(' ','&#160;',0),'')
S['Agenda']='<div class="bd" style="align-items:center"><div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;width:100%">'+''.join(f'<div class="card" style="padding:22px 26px;display:flex;gap:18px;align-items:baseline"><span style="font-family:\'Instrument Serif\',Georgia,serif;font-style:italic;font-size:34px;color:{MINT}">{i+1:02d}</span><span style="font-size:20px;color:#fff;font-weight:700">{e(t)}</span></div>' for i,(k,t,_) in enumerate(SECTIONS))+'</div></div>'
H['Agenda']=('Agenda','Eight sections, one <span class="fl">plan</span>','Each channel takes its own time.')

for k in S: open(f'bodies/{k}.html','w').write(S[k]+'\n')
json_out={k:H[k] for k in S}
import json; json.dump(json_out,open('new_headers.json','w'))
print(len(S))
