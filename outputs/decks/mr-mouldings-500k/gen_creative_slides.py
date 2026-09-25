# Creative strategy slides, from the creative team's "MR Mouldings Paid Creative Strategy" Google Slides.
# Replaces the earlier creative/persona/shoot slides in manifest.txt (inserted after SocialForecast).
import html, json
G='rgba(142,254,187,.09);border-color:rgba(142,254,187,.30)'
MINT='#8EFEBB'
def e(s): return html.escape(s,quote=False).replace('—','&#8212;').replace('–','&#8211;').replace('×','&#215;').replace('·','&#183;')
def ul(items,size=15): return '<ul class="mut">'+''.join(f'<li style="font-size:{size}px;color:#B9C7C0;margin-bottom:5px">{e(i)}</li>' for i in items)+'</ul>'
def sub(t): return f'<p style="margin:0 0 6px;font-family:\'Instrument Serif\',Georgia,serif;font-style:italic;font-size:17px;color:{MINT}">{e(t)}</p>'
def pill(t): return f'<span class="pill p-go" style="background:{MINT};color:#051412">{e(t)}</span>'
BIG='<style>.big td{padding:10px 14px 10px 0;vertical-align:top}.big th{white-space:normal}</style>'
def table(head,rows,size=15,widths=None,hicol=None):
    th=''.join(f'<th{(" style=\"width:%s\"" % widths[i]) if widths and widths[i] else ""}>{e(h)}</th>' for i,h in enumerate(head))
    def td(i,c):
        st=' style="color:#8EFEBB;font-weight:700"' if i==hicol else (' style="color:#fff;font-weight:700"' if i==0 else '')
        return f'<td{st}>{e(c)}</td>'
    tr=''.join('<tr>'+''.join(td(i,c) for i,c in enumerate(r))+'</tr>' for r in rows)
    return f'<table style="font-size:{size}px" class="big"><thead><tr>{th}</tr></thead><tbody>{tr}</tbody></table>'
S={}; H={}
EB='08 &#183; Paid creative strategy'

S['CreativeIntro']='<div class="bd" style="align-items:center;justify-content:flex-end"><div class="card" style="flex:0 0 560px;padding:34px 38px">'+''.join(
 f'<div style="display:flex;gap:24px;align-items:baseline;padding:10px 0"><span style="font-family:\'Instrument Serif\',Georgia,serif;font-style:italic;font-size:24px;color:{MINT}">0{i+1}</span><span style="font-size:21px;color:#fff">{e(t)}</span></div>'
 for i,t in enumerate(['Audience division','Eight personas','Personas at a glance','Content formats for paid','Format focuses']))+'</div></div>'
H['CreativeIntro']=(EB,'Paid <span class="fl">strategy</span>','How the creative is planned: who we are speaking to, and the formats that prove it.')

def aud(tag,title,buy,prove):
    return f'''<div class="card" style="padding:30px 32px">{pill(tag)}<h3 style="display:inline-block;margin:0 0 0 12px;font-size:22px">{e(title)}</h3>
<div style="margin-top:22px">{sub("What they are buying")}<p class="mut" style="font-size:17px">{e(buy)}</p></div>
<div style="margin-top:16px">{sub("What paid has to prove")}<p style="font-size:17px;margin:0;color:#fff">{e(prove)}</p></div></div>'''
S['Audience']=f'''<div class="bd" style="align-items:center"><div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;width:100%">
{aud("B2B","Trade","Consistent machining order after order, the right grade for each job (primed, moisture resistant, fire rated), a made to match service, and a supplier who knows the product.","That the spec stays the same from one order to the next, and that the team can answer the technical questions properly.")}
{aud("D2C","Homeowner","A room that looks more expensive than it cost, with a profile that suits the house.","That it is achievable by a normal person in a weekend, and that the finish looks right.")}
</div></div>'''
H['Audience']=(EB,'Audience division: trade and <span class="fl">homeowner</span>','Paid speaks to two different buyers. Trade buys on spec and consistency, homeowners on how the finished room will look, so each gets its own creative.')

P=[
('Marcus','Sole trader joiner, 40s','B2B','Fits for a living, buys on consistency, and will not risk a job on an unknown supplier.',
 ['Repeat orders of the same two or three profiles, primed, in volume.','Moisture resistant grade as standard for kitchens, bathrooms and utility rooms.'],
 ['Has had profiles vary from one batch to the next, and it cost him time on site.','Struggles to identify the advantage of one supplier over another online, so sticks with the name he knows.'],
 ['What to check on a length of skirting before you fit it.',"How to tell if a supplier's profiles will work across a whole job.",'Why your tenth order should match your first.'],
 'A joiner fitting it on a real job: close-ups of the profile, the primed finish, and lengths that match end to end. No stock imagery.'),
('Lee','Small renovation firm, runs two or three jobs at once','B2B','Orders whole-house quantities and needs a complete spec and a clear price before he can put a number in front of a client.',
 ['Full-house packages: skirting, architrave, window boards, rails, in one order.','Primed as standard so his decorator saves a day.'],
 ['Cannot quote confidently until he knows exactly what the package covers and costs.','Splitting an order across two suppliers to get everything he needs.'],
 ['How to price a whole house of skirting without losing money.','One order, one supplier, every profile in the house.','What a ten per cent wastage buffer actually saves you.'],
 'A worked example of a full-house order, with quantities and what it covers.'),
('Ray','Commercial fit-out contractor','B2B','Works on shop fronts, offices and multi-occupancy buildings, where compliance matters far more than how the trim looks.',
 ['Fire rated MDF skirting and architrave to Euroclass B.','The same specification repeated across multiple units, in volume.'],
 ['Needs documentation he can hand to building control without a follow-up call.','Will not specify a product he cannot evidence.'],
 ['Euroclass B, explained in plain English.','The moulding question that fails a fit-out sign-off.','Specifying fire rated trim across forty units.'],
 'Clear reference to the fire rated range and the documentation that comes with it.'),
('Priya','Interior designer','B2B','Specifies rather than fits. Cares whether a profile is period-correct and whether it photographs well.',
 ['Made to match profiles, reproduced from a sample so an extension looks original.','Period-correct profiles: Georgian, Regency, Victorian, Bolection.'],
 ['A near-enough match ruins a scheme and she carries the blame.','Assumes bespoke means a high price and a complicated process.'],
 ['We can match a profile from one offcut.','Georgian, Regency or Victorian: how to tell which one the house wants.','The detail that gives away a modern extension.'],
 'Side by side of an original sample and the matched reproduction.'),
('Sophie','Period restorer, Victorian or Edwardian terrace','D2C','Wants authenticity and will pay for a match to what is already in the house.',
 ['Made to match profiles for rooms where the original skirting is still in place.','Tall profiles, dado and picture rails, the details that were stripped out in the seventies.'],
 ['Believes a match is only possible in solid timber.','Worries MDF is a compromise in a period house.'],
 ['Your house already has the answer. Bring us one piece of it.','Why MDF outperforms hardwood in a house with walls that are not straight.','What was lost when your hallway was modernised.'],
 'A matched length fitted next to the original, with no visible difference between the two.'),
('Jamie','First-time panelling DIYer','D2C','Saw it on Instagram, has never fitted a moulding, and needs reassurance far more than product detail.',
 ['Primed panel mould, with the quantity already worked out for them.','One room at a time, usually a bedroom or hallway, on a small budget.'],
 ['Does not know how much to order or what tools are needed.','Frightened of mitres and of ruining a wall.'],
 ['You do not need a mitre saw to do this.','The calculator does the maths. You just pick the wall.','First wall panel I ever cut, and what I got wrong.'],
 'An unedited first attempt that still looks good, plus the finished room.'),
('Hannah','New-build upgrader','D2C','Lives in a new build that feels bland and wants to give it character. Buying a look rather than fixing a problem.',
 ['Taller skirting to replace the builder-grade 95mm, plus panelling and architrave to match.','Whole-room transformations rather than single fixes.'],
 ['Does not realise the skirting is the thing making the room feel cheap.','Assumes changing it is a builder job.'],
 ['The reason your new build feels like a rental.','Swap this one thing and the whole room grows up.','Developer skirting versus what it should have been.'],
 "The same room shown with the builder's skirting, then with a taller profile."),
('Adam','Small developer, two or three flips a year','D2C','Cost per unit and speed decide everything. Wants the finish that sells, at the price that does not eat the margin.',
 ['Volume in a small number of profiles that suit most buyers, primed to cut decorating time.','Whatever photographs well for the listing.'],
 ['Sees mouldings as a cost to keep down, not something that adds value.','Will not commit without a clear cost per room before the work starts.'],
 ['The cheapest upgrade that moves an asking price.','What buyers notice in the first ten seconds of a viewing.','Priming it yourself costs more than buying it primed.'],
 'Cost per room against the finish it delivers, shown in a real property.'),
]
for name,role,side,line,buy,stops,hooks,proof in P:
    k='P'+name
    S[k]=f'''<div class="bd" style="gap:22px">
<div class="col" style="flex:0 0 400px;justify-content:center">
<div>{pill(side)}</div>
<div>{sub("In one line")}<p style="margin:0;font-size:24px;line-height:1.35;font-weight:700;color:#fff">{e(line)}</p></div>
</div>
<div class="col" style="flex:1;gap:14px;justify-content:center">
<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
<div class="card" style="padding:20px 22px">{sub("What they buy")}{ul(buy,15)}</div>
<div class="card" style="padding:20px 22px">{sub("What stops them")}{ul(stops,15)}</div>
</div>
<div class="card" style="padding:20px 22px">{sub("Hook angles")}{ul(hooks,15)}</div>
<div class="card" style="padding:20px 22px;background:{MINT};border-color:{MINT}"><p style="margin:0 0 4px;font-family:'Instrument Serif',Georgia,serif;font-style:italic;font-size:17px;color:#0B3B2E">Proof that converts</p><p style="margin:0;font-size:16px;font-weight:700;color:#051412">{e(proof)}</p></div>
</div></div>'''
    H[k]=('08 &#183; Paid creative &#183; Persona',f'<span class="fl">{name}</span>',e(role))

S['Personas']=BIG+'<div class="bd" style="align-items:center"><div class="col" style="flex:1">'+table(['Persona','Audience','Lead message','Primary format'],[
 ['Marcus','B2B','We machine it here, so every order matches the last','Trade creator video'],
 ['Lee','B2B','One order covers the whole house','Statics and carousels'],
 ['Ray','B2B','Fire rated stock with the paperwork behind it','Statics and carousels'],
 ['Priya','B2B','Matched from a single sample','Statics and carousels'],
 ['Sophie','D2C','Your house already has the profile','Creator UGC'],
 ['Jamie','D2C','You can do this in a weekend','Creator UGC'],
 ['Hannah','D2C','Taller skirting changes the whole room','Creator UGC'],
 ['Adam','D2C','Small spend, visible return','Developer walkthroughs']],size=17,widths=['150px','120px',None,'280px'],hicol=3)+'</div></div>'
H['Personas']=(EB,'Personas at a <span class="fl">glance</span>','')

S['ContentFormats']=BIG+'<div class="bd" style="align-items:center"><div class="col" style="flex:1">'+table(['Format','Who films it','What it proves','Best for'],[
 ['Creator UGC','DIY and home creators, in their own homes','That real homeowners get a finish that looks right in their house','Jamie, Hannah, Sophie'],
 ['Trade creator video','Working joiners and fitters, on real jobs','That the product fits cleanly and consistently in professional hands','Marcus, Lee, Ray'],
 ['Developer walkthroughs','Property developers, in their own projects','That the finish adds value for what it costs','Adam'],
 ['Podcast cut-downs','The founder and a co-host, from the podcast recordings','That the team knows mouldings in real depth','Marcus, Priya, Sophie, returning visitors'],
 ['Green screen','An MR Mouldings presenter','That the team can explain specs, profiles and period detail clearly','Every persona, by focus'],
 ['Statics and carousels','Designed from product stills and customer photos','Specs, costs and comparisons laid out clearly','Lee, Ray, Priya, Jamie, Hannah, Adam']],size=15,widths=['200px','300px',None,'260px'])+'</div></div>'
H['ContentFormats']=(EB,'Content formats for <span class="fl">paid</span>','')

def fcard(title,text):
    return f'<div class="card" style="padding:30px 28px"><p class="stat" style="font-size:20px;margin:0 0 16px;color:{MINT}">{e(title.split()[0])}</p><h3 style="font-size:22px">{e(title)}</h3><p class="mut" style="font-size:17px;margin:0">{e(text)}</p></div>'
S['PaidFormats']='<div class="bd" style="align-items:center"><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:18px;width:100%">'+''.join(
 f'<div class="card" style="padding:32px 30px"><h3 style="font-size:24px;color:{MINT}">{e(t)}</h3><p class="mut" style="font-size:17px;margin:12px 0 0">{e(x)}</p></div>' for t,x in [
 ('Founder led','Features in the podcast. In paid, those clips run as short knowledge pieces, often with product and room footage laid over the audio, so the founder is not the face of every ad.'),
 ('Product led','Close-ups of profiles, finishes and fitted lengths carry the visuals. Machining and production processes stay off camera.'),
 ('Customer led','Trade customers, developers, designers and home creators front most of the paid content, so the proof comes from people who have used the product.')])+'</div></div>'
H['PaidFormats']=(EB,'Paid content <span class="fl">formats</span>','')

S['FormatsByPersona']=BIG+'<div class="bd" style="align-items:center"><div class="col" style="flex:1">'+table(['Persona','Audience','Primary format','Supporting format','What to film'],[
 ['Marcus','B2B','Trade creator video','Podcast cut-downs','A joiner fitting the same profile across a job'],
 ['Lee','B2B','Statics and carousels','Trade creator video','A worked whole-house order, then the fit room by room'],
 ['Ray','B2B','Statics and carousels','Trade creator video','The fire rated range and its documentation'],
 ['Priya','B2B','Statics and carousels','Podcast cut-downs','Original sample beside the matched reproduction'],
 ['Sophie','D2C','Creator UGC','Podcast cut-downs','The matched length fitted next to the original'],
 ['Jamie','D2C','Creator UGC','Statics and carousels','An unedited first attempt at panelling'],
 ['Hannah','D2C','Creator UGC','Statics and carousels','Builder-grade skirting swapped for a taller profile'],
 ['Adam','D2C','Developer walkthroughs','Statics and carousels','A developer walking through a finished property']],size=15,widths=['120px','100px','230px','220px',None],hicol=2)+'</div></div>'
H['FormatsByPersona']=(EB,'Formats by <span class="fl">persona</span>','')

FF=[('Green screen','Four focuses, each aimed at a different audience, with natural branding.','Every persona, by focus'),
 ('In-home content','Half day shoots in real homes, with local creators or developers.','Hannah, Jamie, Adam'),
 ('UGC','Creators filming in their own homes: first attempts, installs, finished rooms.','Jamie, Hannah, Sophie'),
 ('Instruction guides','Step-by-step measuring, ordering and fitting guides, as videos or carousels.','Jamie, Lee'),
 ('Lookbook stills','Product focused stills, styled like a lookbook, in finished rooms.','Hannah, Sophie, Priya'),
 ('Product range videos','One range per video, such as fire rated, moisture resistant or period profiles.','Ray, Marcus, Priya'),
 ('Trade creator videos','Joiners and fitters filming on real jobs, from first cut to finished room.','Marcus, Lee, Ray'),
 ('Podcast cut-downs','Founder podcast clips, with product and room footage over the audio.','Marcus, Priya, Sophie')]
S['FormatFocuses']='<div class="bd" style="flex-direction:column;justify-content:center;gap:14px"><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px">'+''.join(
 f'<div class="card" style="padding:20px 20px;display:flex;flex-direction:column"><h3 style="font-size:18px">{e(t)}</h3><p class="mut" style="font-size:15px;margin:0 0 12px">{e(x)}</p><p style="margin:auto 0 0;font-size:13px;color:#B9C7C0"><span style="font-family:\'Instrument Serif\',Georgia,serif;font-style:italic;font-size:15px;color:{MINT}">Best for:</span> {e(b)}</p></div>' for t,x,b in FF)+f'</div><div class="card" style="background:{MINT};border-color:{MINT};padding:18px 24px"><p style="margin:0;font-size:16px;font-weight:700;color:#051412">Alongside these formats, high performing organic posts will be leveraged as paid ads, some as partnership ads.</p></div></div>'
H['FormatFocuses']=(EB,'Format <span class="fl">focuses</span>','')

def focus(tag,title,items,best):
    return f'<div class="card" style="padding:22px 24px;display:flex;flex-direction:column">{sub(tag)}<h3 style="font-size:19px">{e(title)}</h3>{ul(items,14.5)}<p style="margin:10px 0 0;font-size:13px;color:#B9C7C0"><span style="font-family:\'Instrument Serif\',Georgia,serif;font-style:italic;font-size:15px;color:{MINT}">Best for:</span> {e(best)}</p></div>'
S['GreenFocuses']='<div class="bd" style="align-items:center"><div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;width:100%">'+''.join([
 focus('Trade','Trade spec series',['Euroclass B, explained in plain English.','Moisture resistant grade: which rooms need it.','Primed or unprimed, which actually saves money.','Pricing a whole house of skirting without losing money.'],'Marcus, Lee, Ray'),
 focus('Homeowner','Profile school',['Ogee, torus or lambs tongue, and which house each suits.','What height skirting suits a 2.4 metre ceiling.','Should architrave match skirting.','How much to order, and why to add ten percent.'],'Hannah, Jamie'),
 focus('Homeowner and designer','Period property mini series',['Georgian, Regency or Victorian: which one the house wants.','What was lost when period hallways were modernised.','The detail that gives away a modern extension.','Why MDF suits a house with walls that are not straight.'],'Sophie, Priya'),
 focus('All audiences','New product launches',['What the product is and what it replaces.','Which rooms and properties it suits.','How it is fitted and finished.','A trade cut and a homeowner cut of each launch.'],'Every persona')])+'</div></div>'
H['GreenFocuses']=('08 &#183; Paid and organic','Green screen <span class="fl">focuses</span>','')

S['PodcastFocuses']='<div class="bd" style="align-items:center"><div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;width:100%">'+''.join([
 focus('Episode one, planned','Tulipwood',['When tulipwood beats MDF, and when it does not.','What tulipwood is, and why it takes paint so well.','Stain, paint or leave it: choosing the right material.'],'Marcus, Priya, Sophie'),
 focus('Episode two, planned','Mouldings in period properties',['Matching a profile from a single offcut.','Why MDF holds a line better than timber in a house that moves.','Skirting height and proportion in a Victorian room.','Dado and picture rails: whether to put them back.'],'Sophie, Priya'),
 focus('Proposed episode','Getting the spec right for the trade',['Choosing the right grade for each room.','What building control asks for on fire rated trim.','Ordering for a whole house without over or under buying.','The fitting mistakes that cost time on site.'],'Marcus, Lee, Ray'),
 focus('Proposed episode','Giving a new build character',['Why builder-grade skirting makes a room feel cheap.','Taller skirting and the proportions that work.','Panelling for first-timers: where to start.','The upgrades buyers notice when you come to sell.'],'Hannah, Jamie, Adam')])+'</div></div>'
H['PodcastFocuses']=('08 &#183; Paid and organic','Podcast <span class="fl">focuses</span>','')

order=['CreativeIntro','Audience']+['P'+p[0] for p in P]+['Personas','ContentFormats','PaidFormats','FormatsByPersona','FormatFocuses','GreenFocuses','PodcastFocuses']
OLD={'Audience','Personas','Shoot','ShootPodcast','ShootGreen','ShootDay','ShootNeeds'}|{'P'+p[0] for p in P}
for k in order: open(f'bodies/{k}.html','w').write(S[k]+'\n')
rows=[l.rstrip('\n').split('|') for l in open('manifest.txt') if l.strip()]
rows=[r for r in rows if r[0] not in OLD and r[0] not in order]
i=[r[0] for r in rows].index('SocialForecast')+1
for k in reversed(order):
    eb,t,sf=H[k]; rows.insert(i,[k,'',eb,t,sf])
for j,r in enumerate(rows): r[1]='%02d'%(j+2)
open('manifest.txt','w').write('\n'.join('|'.join(r) for r in rows)+'\n')
c=json.load(open('canvas.json')); files=['Main.dc.html']+[r[0]+'.dc.html' for r in rows]
c['artboards']=[{'file':f,'x':(n%4)*1740,'y':(n//4)*1100,'w':1600,'h':900} for n,f in enumerate(files)]
json.dump(c,open('canvas.json','w'),indent=2)
print(len(files))
