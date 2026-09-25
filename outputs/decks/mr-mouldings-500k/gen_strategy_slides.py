# Generates the creative and organic social slides (from the MR Mouldings Strategy Plan doc)
# and inserts them into manifest.txt after SocialForecast.
import html
G='rgba(142,254,187,.09);border-color:rgba(142,254,187,.30)'
def e(s): return html.escape(s,quote=False).replace('—','&#8212;').replace('–','&#8211;').replace('×','&#215;').replace('·','&#183;').replace('’',"'")
def ul(items,size=16): return f'<ul class="mut">'+''.join(f'<li style="font-size:{size}px;color:#B9C7C0">{e(i)}</li>' for i in items)+'</ul>'
def card(title,inner,style='',lbl=None):
    t=f'<p class="lbl" style="color:#8EFEBB">{e(lbl)}</p>' if lbl else ''
    h=f'<h3>{e(title)}</h3>' if title else ''
    return f'<div class="card" style="{style}">{t}{h}{inner}</div>'
def table(head,rows,hi=(),size=16,widths=None):
    th=''.join(f'<th{(" style=\"width:%s\"" % widths[i]) if widths and widths[i] else ""}>{e(h)}</th>' for i,h in enumerate(head))
    tr=''.join(f'<tr{" class=\"hi\"" if i in hi else ""}>'+''.join(f'<td>{e(c)}</td>' for c in r)+'</tr>' for i,r in enumerate(rows))
    return f'<table style="font-size:{size}px" class="big"><thead><tr>{th}</tr></thead><tbody>{tr}</tbody></table>'
BIG='<style>.big td{padding:12px 16px 12px 0;vertical-align:top}</style>'
S={}; H={}

S['Audience']=f'''<div class="bd" style="flex-direction:column;justify-content:center;gap:18px">
<div style="display:grid;grid-template-columns:1fr 1fr;gap:18px">
{card("B2B · trade", f'<p class="lbl" style="margin-top:14px">What they buy</p><p class="mut" style="font-size:17px">{e("Consistent machining, stock depth, lead times they can quote, made to match, fire rated.")}</p><p class="lbl" style="margin-top:14px">What paid proves</p><p style="font-size:17px;margin:0;color:#8EFEBB;font-weight:700">{e("We are the factory, and the lead time is real.")}</p>', "padding:30px 30px")}
{card("D2C · homeowner", f'<p class="lbl" style="margin-top:14px">What they buy</p><p class="mut" style="font-size:17px">{e("A room that looks more expensive than it cost, with a profile that suits the house.")}</p><p class="lbl" style="margin-top:14px">What paid proves</p><p style="font-size:17px;margin:0;color:#8EFEBB;font-weight:700">{e("It is achievable in a weekend, and the finish looks right.")}</p>', "padding:30px 30px")}
</div>
<div class="card" style="background:{G}"><p style="margin:0;font-size:17px"><strong style="color:#8EFEBB">Eight personas, four each side.</strong> <span class="mut">Each has its own messaging and format.</span></p></div>
</div>'''
H['Audience']=('08 &#183; Creative &#183; Audience','One factory, <span class="fl">two</span> audiences','MR Mouldings makes what every competitor resells. That splits the creative in two.')

P=[
('Marcus','Sole trader joiner, 40s','B2B','Fits for a living, buys on consistency and lead time.',
 ['Repeat orders of two or three profiles, primed, in volume','Moisture resistant grade for kitchens and bathrooms'],
 ['Needs a delivery date he can trust','Wants proof we make it, not resell it'],
 ['Where your skirting actually comes from','If they cannot tell you the tolerance, they did not make it','The lead time we quote is the one you get'],
 'Factory footage: the machine, the board coming off it, the rack.'),
('Lee','Small renovation firm','B2B','Orders whole-house quantities and needs availability before he quotes.',
 ['Full-house packages in one order','Primed as standard to save his decorator a day'],
 ['Needs a firm lead time to quote','Wants everything from one supplier'],
 ['How to price a whole house of skirting','One order, one delivery, one supplier','What a 10% wastage buffer actually saves'],
 'A worked full-house order, with quantities and coverage.'),
('Ray','Commercial fit-out contractor','B2B','Shop fronts, offices and multi-unit buildings. Compliance is the conversation.',
 ['Fire rated MDF skirting and architrave, Euroclass B','Repeat specification across many units'],
 ['Needs paperwork building control accepts','Specifies only what he can evidence'],
 ['Euroclass B, in plain English','The moulding question that decides a fit-out sign-off','Specifying fire rated trim across forty units'],
 'The fire rated range, with its documentation.'),
('Priya','Interior designer','B2B','Specifies rather than fits. Wants period-correct profiles that photograph well.',
 ['Made to match from a sample','Georgian, Regency, Victorian, Bolection'],
 ['Needs an exact match for her scheme','Expects bespoke to be slow and costly'],
 ['We can match a profile from one offcut','Georgian, Regency or Victorian: which one the house wants','The detail that gives away a modern extension'],
 'Original sample and matched reproduction, side by side.'),
('Sophie','Period restorer, Victorian or Edwardian terrace','D2C','Wants authenticity and will pay for a match to what is already there.',
 ['Made to match for rooms with original skirting','Tall profiles, dado and picture rails'],
 ['Thinks a match needs solid timber','Unsure MDF suits a period house'],
 ['Your house already has the answer. Bring us one piece','Why MDF suits walls that are not straight','What was lost when your hallway was modernised'],
 'One sample in, a matched length out, fitted next to the original.'),
('Jamie','First-time panelling DIYer','D2C','Saw it on Instagram. Needs reassurance more than product detail.',
 ['Primed panel mould, in a worked-out quantity','One room, on a weekend budget'],
 ['Unsure how much to order or which tools','Nervous about mitres'],
 ['You do not need a mitre saw for this','The calculator does the maths. You pick the wall','My first wall panel, and what I learned'],
 'An unedited first attempt that still looks good, plus the finished room.'),
('Hannah','New-build upgrader','D2C','Bland box, wants character. Buying a look, not a repair.',
 ['Taller skirting to replace builder-grade 95mm','Whole-room transformations'],
 ['Has not spotted that skirting sets the tone','Assumes it is a builder job'],
 ['Why your new build feels like a rental','Swap one thing and the room grows up','Developer skirting versus what it should be'],
 'Same room, builder profile against a taller one.'),
('Adam','Small developer, two or three flips a year','D2C','Cost per unit and speed decide everything.',
 ['Volume in a few safe profiles, primed','Whatever photographs well for the listing'],
 ['Sees mouldings as a cost line','Cannot wait on a long lead time'],
 ['The cheapest upgrade that moves an asking price','What buyers notice in the first ten seconds','Buying primed costs less than priming yourself'],
 'Cost per room against the finish it delivers, in a real property.'),
]
for name,role,side,line,buy,hold,hooks,proof in P:
    k='P'+name
    S[k]=f'''<div class="bd" style="flex-direction:column;justify-content:center;gap:16px">
<div style="display:grid;grid-template-columns:1fr 1fr 1.3fr;gap:16px">
{card("What they buy", ul(buy,19), "padding:26px 26px")}
{card("What wins them", ul(hold,19), "padding:26px 26px")}
{card("Hook angles", ul(hooks,19), f"padding:26px 26px;background:{G}")}
</div>
<div class="card" style="padding:20px 26px"><p style="margin:0;font-size:19px"><span class="lbl">Proof that converts</span>&#160;&#160;&#160;&#160;<span style="color:#fff">{e(proof)}</span></p></div>
</div>'''
    H[k]=(f'08 &#183; Creative &#183; Persona &#183; {side}',f'<span class="fl">{name}</span>, {e(role[0].lower()+role[1:]) if name not in ("Sophie",) else e(role[0].lower()+role[1:])}',e(line))

S['Personas']=BIG+'<div class="bd" style="align-items:center"><div class="col" style="flex:1">'+table(['Persona','Side','Lead message','Format'],[
 ['Marcus','B2B','We machine it here, so the spec never drifts','Factory video'],
 ['Lee','B2B','One order covers the whole house','Worked example carousel'],
 ['Ray','B2B','Fire rated stock, with the paperwork','Green screen explainer'],
 ['Priya','B2B','Matched from a single sample','Before and after stills'],
 ['Sophie','D2C','Your house already has the profile','Made to match film'],
 ['Jamie','D2C','You can do this in a weekend','Creator install reel'],
 ['Hannah','D2C','Taller skirting changes the whole room','Transformation reel'],
 ['Adam','D2C','Small spend, visible return','Cost and finish comparison']],size=17,widths=['140px','90px',None,'280px'])+'</div></div>'
H['Personas']=('08 &#183; Creative &#183; Personas','Eight personas at a <span class="fl">glance</span>','')

S['Shoot']=f'''<div class="bd" style="flex-direction:column;justify-content:center;gap:18px">
<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px">
{card("Podcast episodes", '<p class="mut" style="font-size:17px;margin:0">Each cut into a long-form piece and a bank of short clips.</p>', "padding:30px", None).replace('<h3>','<p class="stat" style="font-size:72px">2</p><h3 style="margin-top:14px">',1)}
{card("Green screen answers", '<p class="mut" style="font-size:17px;margin:0">Short pieces to camera that carry the quarter.</p>', "padding:30px").replace('<h3>','<p class="stat" style="font-size:72px">~20</p><h3 style="margin-top:14px">',1)}
{card("And cutaways", '<p class="mut" style="font-size:17px;margin:0">Profiles, hands and product detail for paid and organic.</p>', "padding:30px").replace('<h3>','<p class="stat" style="font-size:72px">Stills</p><h3 style="margin-top:14px">',1)}
</div>
<div class="card" style="background:{G}"><p style="margin:0;font-size:17px"><strong style="color:#8EFEBB">On camera:</strong> <span class="mut">founder or senior sales lead, continuing from podcast into green screen. One look, one day.</span></p></div>
</div>'''
H['Shoot']=('08 &#183; Creative &#183; Shoot day','30 September: one day, a <span class="fl">quarter</span> of content','Two set-ups in one space, feeding both paid and organic.')

S['ShootPodcast']=f'''<div class="bd" style="flex-direction:column;justify-content:center;gap:18px">
<div style="display:grid;grid-template-columns:1fr 1fr;gap:18px">
{card("Tulipwood, oak and softwood", ul(["When timber beats MDF, and when it does not","Why tulipwood takes paint so well","Stain, paint or leave it","What sustainably sourced means"],17), "padding:30px", "Episode one")}
{card("Mouldings in period properties", ul(["Matching a profile from one offcut","Why MDF holds a line in a house that moves","Skirting height and proportion","Dado and picture rails: whether to put them back"],17), "padding:30px", "Episode two")}
</div>
<div class="card" style="background:{G}"><p style="margin:0;font-size:17px"><strong style="color:#8EFEBB">The set:</strong> <span class="mut">two seats, profiles on the table as props, a question bank rather than a script.</span></p></div>
</div>'''
H['ShootPodcast']=('08 &#183; Creative &#183; Shoot day','The podcast <span class="fl">set</span>','')

S['ShootGreen']=f'''<div class="bd" style="flex-direction:column;justify-content:center;gap:18px">
<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px">
{card("Profile school", ul(["Ogee, torus or lambs tongue","Skirting height for a 2.4m ceiling","Should architrave match skirting","How much to order, plus 10%"],17), "padding:28px", "Block A")}
{card("Myths and questions", ul(["Is MDF a cheap option","Primed or unprimed","MDF in a bathroom","Do you need a mitre saw"],17), "padding:28px", "Block B")}
{card("Reactions", ul(["Answering comment questions","Calling the profile in customer rooms","What trends will date"],17), "padding:28px", "Block C")}
</div>
<p class="note" style="font-size:14px">Shot flat, so answers drop onto rooms, product shots, comments or customer photos later.</p>
</div>'''
H['ShootGreen']=('08 &#183; Creative &#183; Shoot day','The green screen <span class="fl">set</span>','Short answers to single questions.')

S['ShootDay']=BIG+'<div class="bd" style="align-items:center;gap:40px"><div class="col" style="flex:0 0 880px">'+table(['Time','Block','Detail'],[
 ['09:00','Set build','Podcast corner and green screen in one space'],
 ['09:45','Sound and framing','Levels, framing, wardrobe'],
 ['10:00','Podcast one','Tulipwood, oak and softwood'],
 ['11:15','Podcast two','Mouldings in period properties'],
 ['12:15','Lunch',''],
 ['13:00','Green screen A','Profile school'],
 ['14:45','Green screen B','Myths and questions'],
 ['16:00','Green screen C','Reactions and comment answers'],
 ['16:45','Stills and cutaways','Profiles, hands, product detail'],
 ['17:15','Wrap','']],hi=(2,3),size=15,widths=['90px','220px',None])+f'''</div><div class="col" style="flex:1"><div class="card" style="background:{G};padding:28px"><h3 style="color:#8EFEBB">Podcast comes first</h3><p class="mut" style="font-size:16px;margin:0">If the day runs long, block C moves to the next shoot.</p></div></div></div>'''
H['ShootDay']=('08 &#183; Creative &#183; Shoot day','The running <span class="fl">order</span>','')

S['ShootNeeds']='<div class="bd" style="align-items:center"><div class="col" style="flex:1">'+''.join(f'<div class="card" style="padding:18px 24px"><div class="kv"><span class="k" style="font-size:18px;color:#fff">{e(a)}</span><span class="v" style="color:#8EFEBB;font-size:16px">{e(b)}</span></div></div>' for a,b in [
 ('Presenter, plus a second seat for each episode','Confirm'),
 ('Location with power, big enough for both set-ups','Confirm'),
 ('Tulipwood, oak and softwood samples, plus period profiles','On set'),
 ('A matched pair: original sample and reproduction','On set'),
 ('Question bank','Sign off'),
 ('Fire rating and sourcing claims','Check')])+'</div></div>'
H['ShootNeeds']=('08 &#183; Creative &#183; Shoot day','Ready for the <span class="fl">30th</span>','Six things to line up before the shoot.')

S['SocialOrganicNow']=f'''<div class="bd" style="flex-direction:column;justify-content:center;gap:18px">
<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px">
<div class="card"><p class="lbl">Followers</p><p class="stat" style="font-size:48px">10,000</p></div>
<div class="card"><p class="lbl">Posts</p><p class="statw" style="font-size:48px">213</p></div>
<div class="card"><p class="lbl">Creators</p><p class="statw" style="font-size:48px">15</p></div>
<div class="card"><p class="lbl">Creator reach</p><p class="stat" style="font-size:48px">1.27m</p></div>
</div>
<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px">
{card("Content strategy", '<p class="mut" style="font-size:16px;margin:0">Six pillars, eight personas, a founder-led format.</p>', "padding:24px")}
{card("Creator framework", '<p class="mut" style="font-size:16px;margin:0">Tiered deliverables, usage rights and ASA disclosure built in.</p>', "padding:24px")}
{card("Channels in place", '<p class="mut" style="font-size:16px;margin:0">UGC ad scripts, an Instagram post bank, a YouTube install series.</p>', "padding:24px")}
</div>
</div>'''
H['SocialOrganicNow']=('08 &#183; Organic social &#183; Today','The foundations are <span class="fl">built</span>','')

S['SocialOrganicPerf']=BIG+f'''<div class="bd" style="align-items:center;gap:40px"><div class="col" style="flex:0 0 760px">'''+table(['Top posts','Viewers','Engaged','Rate'],[
 ['What Order Should You Renovate?','1,500','21','1.4%'],['Four Mouldings. One Wall.','1,400','30','2.1%'],['Nobody Notices Good Skirting','1,000','23','2.3%'],['Set Out Before You Cut','966','~19','2.0%']],size=18,widths=[None,'110px','110px','90px'])+f'''</div>
<div class="col" style="flex:1">
<div class="card" style="background:{G};padding:24px"><h3 style="color:#8EFEBB">Reach is strong</h3><p class="mut" style="font-size:16px;margin:0">The best posts reach 1,000 to 1,500 accounts.</p></div>
<div class="card" style="padding:24px"><h3>Engagement is the next lever</h3><p class="mut" style="font-size:16px;margin:0">Save prompts and questions turn views into action.</p></div>
<div class="card" style="padding:24px"><h3>Headroom on newer posts</h3><p class="mut" style="font-size:16px;margin:0">Recent posts at 333 to 403 viewers, with the best format to bring them up.</p></div>
</div></div>'''
H['SocialOrganicPerf']=('08 &#183; Organic social &#183; Performance','Strong reach, with <span class="fl">engagement</span> to grow','Instagram, highest performing posts.')

S['SocialOrganicWorks']=f'''<div class="bd" style="flex-direction:column;justify-content:center;gap:18px">
<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px">
{card("A claim, not a description", '<p class="mut" style="font-size:16px;margin:0">"Nobody Notices Good Skirting."</p>', "padding:26px")}
{card("A question people have", '<p class="mut" style="font-size:16px;margin:0">"What order should you renovate?"</p>', "padding:26px")}
{card("The room sells", '<p class="mut" style="font-size:16px;margin:0">Product in shot, never the subject.</p>', "padding:26px")}
{card("Serif over a finished room", '<p class="mut" style="font-size:16px;margin:0">Recognisable, and reads at feed size.</p>', "padding:26px")}
</div>
<div class="card" style="background:{G}"><p style="margin:0;font-size:17px"><strong style="color:#8EFEBB">All four top posts share this format.</strong> <span class="mut">Next, bring reels, creator content and product posts into it.</span></p></div>
</div>'''
H['SocialOrganicWorks']=('08 &#183; Organic social &#183; What works','One <span class="fl">winning</span> format','A styled room with one short editorial line over it.')

S['SocialOrganicNext']=f'''<div class="bd" style="flex-direction:column;justify-content:center;gap:14px">
'''+''.join(f'<div class="card" style="padding:20px 26px;display:flex;gap:22px;align-items:baseline"><span class="stat" style="font-size:30px">0{i+1}</span><div><h3 style="margin:0 0 4px">{e(a)}</h3><p class="mut" style="font-size:16px;margin:0">{e(b)}</p></div></div>' for i,(a,b) in enumerate([
 ('A static for every episode','The winning format carries the claim; video carries the detail.'),
 ('Clips open on the claim','Written line over a finished room first, presenter second.'),
 ('A reason to act','Save prompts, direct questions and answerable comments.'),
 ('Stronger creator briefs','An editorial still becomes a standard deliverable.'),
 ('A healthy audience before growth','Review follower quality so more followers see each post.')]))+'</div>'
H['SocialOrganicNext']=('08 &#183; Organic social &#183; Next','Five <span class="fl">upgrades</span> to the plan','')

S['SocialSeries']=BIG+'<div class="bd" style="flex-direction:column;justify-content:center;gap:18px"><div>'+table(['Series','Cadence','For','What it does'],[
 ['Period Properties','Fortnightly','Sophie, Priya, Marcus','Owns what only a manufacturer can do: matching the house'],
 ['New Products','Monthly','Marcus, Lee, Ray, Hannah','Gives the range a reason to be posted, keeps trade current'],
 ['Green Screen','Weekly','Jamie, Hannah, Sophie','High volume, low cost, answers real questions']],size=18,widths=['220px','150px','260px',None])+f'</div><div class="card" style="background:{G}"><p style="margin:0;font-size:17px"><strong style="color:#8EFEBB">All three come from one shoot day a quarter.</strong> <span class="mut">Green screen carries the weekly cadence in between.</span></p></div></div>'
H['SocialSeries']=('08 &#183; Organic social &#183; Mini series','Three <span class="fl">series</span>, one shoot a quarter','')

S['SocialPodcast']=f'''<div class="bd" style="flex-direction:column;justify-content:center;gap:18px">
<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px">
{card("Format", ul(["Two seats, conversational","Recorded two at a time on shoot days","One long-form piece plus short clips per episode"],17), "padding:28px")}
{card("In the chair", ul(["Founder or senior sales lead","Guests who earn it: a joiner, a designer, a creator"],17), "padding:28px")}
{card("Why it works", ul(["Sixty years of combined trade knowledge","Feeds green screen, blog posts and paid hooks"],17), f"padding:28px;background:{G}")}
</div></div>'''
H['SocialPodcast']=('08 &#183; Organic social &#183; Podcast','Sixty years of trade knowledge, on <span class="fl">record</span>','')

bank=['Made to match: what can be reproduced','Inside the Epsom workshop','Fire rated mouldings and fit-out compliance','Flexi mouldings: curves and arches','Pricing a whole house','Jobs we have rescued','Bespoke joinery: stairs, sashes, shopfronts','Trade versus DIY: five common mistakes']
S['SocialPodcastBank']=f'''<div class="bd" style="gap:24px;align-items:center">
<div class="col" style="flex:0 0 420px">{card("Confirmed for 30 September", ul(["Tulipwood, oak and softwood","Mouldings in period properties"],18), f"padding:30px;background:{G}")}</div>
<div class="col" style="flex:1"><p class="lbl">Next in the bank</p><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">'''+''.join(f'<div class="card" style="padding:16px 20px"><p style="margin:0;font-size:16px;color:#fff">{e(b)}</p></div>' for b in bank)+'</div></div></div>'
H['SocialPodcastBank']=('08 &#183; Organic social &#183; Podcast','Ten episodes <span class="fl">ready</span> to go','')

S['SocialCreators']=BIG+f'''<div class="bd" style="align-items:center;gap:40px"><div class="col" style="flex:0 0 700px">'''+table(['Stage','Projects'],[
 ['Early conversations','4'],['Product shipped','4'],['Content in progress','5'],['Catching up','1'],['Complete','2']],size=18,widths=[None,'120px'])+f'''</div>
<div class="col" style="flex:1">
<div class="card" style="background:{G};padding:26px"><p class="lbl" style="color:#8EFEBB">Combined followers</p><p class="stat" style="font-size:56px">1.27m</p><p class="mut" style="font-size:16px;margin:8px 0 0">15 creators, 16 projects.</p></div>
<div class="card" style="padding:24px"><h3>Ten projects with content on the way</h3><p class="mut" style="font-size:16px;margin:0">Next: collect raw files so the best content can run as paid ads.</p></div>
</div></div>'''
H['SocialCreators']=('08 &#183; Organic social &#183; Creators','A creator programme with <span class="fl">1.27m</span> reach','From the current tracking sheet.')

S['SocialQuarter']=BIG+'<div class="bd" style="align-items:center"><div class="col" style="flex:1">'+table(['Month','Mini series','Podcast','Creators'],[
 ['October','Period Properties ×2, New Products ×1, Green Screen weekly','Tulipwood, oak and softwood','Backlog delivered, two new briefed'],
 ['November','Period Properties ×2, New Products ×1, Green Screen weekly','Period properties','Three live, one large creator'],
 ['December','Period Properties ×2, New Products ×1, Green Screen weekly','Next shoot day recorded','Five live, Q1 pipeline built']],size=17,widths=['140px',None,'260px','300px'])+'</div></div>'
H['SocialQuarter']=('08 &#183; Organic social &#183; Q4','The quarter at a <span class="fl">glance</span>','')

# Creative/persona/shoot slides are superseded by gen_creative_slides.py; only organic social is generated here.
order=['SocialOrganicNow','SocialOrganicPerf','SocialOrganicWorks','SocialOrganicNext','SocialSeries','SocialPodcast','SocialPodcastBank','SocialCreators','SocialQuarter']
for k in order: open(f'bodies/{k}.html','w').write(S[k]+'\n')
rows=[l.rstrip('\n').split('|') for l in open('manifest.txt') if l.strip()]
rows=[r for r in rows if r[0] not in order]
i=[r[0] for r in rows].index('PodcastFocuses')+1
for k in reversed(order):
    eb,t,sf=H[k]; rows.insert(i,[k,'',eb,t,sf])
for j,r in enumerate(rows): r[1]='%02d'%(j+2)
open('manifest.txt','w').write('\n'.join('|'.join(r) for r in rows)+'\n')
import json
c=json.load(open('canvas.json')); files=['Main.dc.html']+[r[0]+'.dc.html' for r in rows]
c['artboards']=[{'file':f,'x':(n%4)*1740,'y':(n//4)*1100,'w':1600,'h':900} for n,f in enumerate(files)]
json.dump(c,open('canvas.json','w'),indent=2)
print(len(files))
