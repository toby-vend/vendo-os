# -*- coding: utf-8 -*-
from deckkit import *
from pptx.util import Inches as In, Pt
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
B={"bold":True,"color":WHITE}; M={"color":MINT,"bold":True}
prs=new_deck()

# ---------- 01 title ----------
s=slide(prs)
rect(s,0,0,0.14,H,MINT)
label(s,ML+0.2,0.9,8,"Strategy presentation · 25 September 2026",color=MINT,size=10)
text(s,ML+0.2,1.35,11.4,1.9,[("Roadmap to £500k ",{}),("a month",{"font":SERIF,"italic":True,"color":MINT,"size":54})],
     size=54,color=WHITE,bold=True,space=-1.4)
para(s,ML+0.2,3.35,9.6,0.9,["The business has grown 4.36× year on year and the current trajectory reaches £500,000 a month on its own. This is how we protect that trend, then beat it."],size=14.5,color=SEC,line=1.4,gap=0)
rect(s,ML+0.2,4.55,11.9,0.011,RULE)
figs=[("Growth, year on year","4.36×",MINT),("August 2026","£285,850",WHITE),
      ("To £500k on trend","~14 mths",WHITE),("Reported traffic that is real","8%",MINT)]
for i,(l,v,col) in enumerate(figs):
    x=ML+0.2+i*3.0
    if i: rect(s,x-0.22,4.75,0.008,0.85,RULE)
    label(s,x,4.8,2.7,l); stat(s,x,5.1,2.8,v,color=col,size=26)
text(s,ML+0.2,6.6,7,0.3,"Prepared for Adam McGrory · MR Mouldings Ltd",size=9,color=MUT,bold=True,space=1.6,caps=True)
text(s,W-MR-1.2,6.6,1.2,0.3,"01",size=9,color=MUT,bold=True,align=PP_ALIGN.RIGHT)

# ---------- 02 position ----------
s=slide(prs)
y=header(s,"01 · Where the business is",[("The business has grown ",{}),flourish("4.36×"),(" year on year",{})],
  "£2,304,842 in the twelve months to August, against £528,534 the year before. Read from 24 months of sales data that was not available at the first pull.",2)
c=card(s,ML,y,7.3,3.0)
label(s,ML+0.28,y+0.24,6.8,"Net sales per month · Sep 2024 – Aug 2026")
vals=[11.8,10.2,19.3,24.8,32.3,27.6,58.3,63.6,55.5,57.1,93.9,70.7,125.4,124.2,155.7,111.8,130.1,193.7,232.3,219.8,235.4,226.6,249.4,285.9]
bx,by,bw,bh=ML+0.42,y+0.72,6.6,1.95
rect(s,bx,by+bh,bw,0.008,RULE)
for i,v in enumerate(vals):
    hgt=bh*v/300.0; wdt=bw/len(vals)*0.68
    rect(s,bx+i*(bw/len(vals)),by+bh-hgt,wdt,hgt,MINT if i==len(vals)-1 else MID)
text(s,ML+0.42,y+2.78,3,0.2,"SEP 2024",size=8,color=MUT,bold=True,space=1.2)
text(s,ML+4.0,y+2.78,3,0.2,"AUG 2026 · £285,850",size=8,color=MINT,bold=True,space=1.2,align=PP_ALIGN.RIGHT)
para(s,ML,y+3.12,7.3,0.6,[[("Average order value rose alongside volume, from £305 to £408 across the two twelve-month periods — growth is coming from bigger baskets as well as more of them.",{"color":MUT,"size":10})]],gap=0)
gx=ML+7.6; gw=(CW-7.6-0.25)/2
for i,(l,v,col,note) in enumerate([("Growth, year on year","4.36×",MINT,"£2.30m against £528k the year before"),
    ("August 2026","£285,850",WHITE,"656 orders. AOV up from £305 to £408"),
    ("Orders, 12 months","5,652",WHITE,"Against 1,733 the twelve months before"),
    ("To £500k on trend","~14 mths",MINT,"At the last six months' rate of 62%/yr")]):
    cx=gx+(i%2)*(gw+0.25); cy=y+(i//2)*1.32
    card(s,cx,cy,gw,1.14); label(s,cx+0.22,cy+0.18,gw-0.4,l)
    stat(s,cx+0.22,cy+0.42,gw-0.4,v,color=col,size=23)
    para(s,cx+0.22,cy+0.82,gw-0.4,0.28,[[(note,{"color":MUT,"size":8.8})]],gap=0)
cy=y+2.7; card(s,gx,cy,CW-7.6,1.05,fill=C(0x0B,0x2A,0x24),edge=MINT)
para(s,gx+0.24,cy+0.2,CW-8.1,0.75,[[("This reframes the brief. ",M),("£500,000 a month is not a 1.76× leap engineered from a standing start. It is roughly where the existing trajectory arrives — and the strategy's real job is to stop growth decelerating, then beat the trend.",{"color":SEC})]],size=11.5,line=1.4,gap=0)

# ---------- 03 trajectory ----------
s=slide(prs)
y=header(s,"02 · The trajectory",[("£500k is roughly where the current trend ",{}),flourish("arrives"),("",{})],
  "About fourteen months out on the last six months' growth rate — which lands almost exactly on the timeline in your brief.",3)
table(s,ML,y,5.5,["Growth assumption","Rate","Months"],
  [["Last 12 months' actual","301%","4.8"],["Last 6 months' actual","62%","14.0"],
   ["Decelerating to 75%/yr","75%","12.0"],["Decelerating to 50%/yr","50%","16.5"],
   ["Decelerating to 30%/yr","30%","25.6"]],[3.4,1.0,1.0],hi=(1,),dim=(0,),rowh=0.32)
para(s,ML,y+2.15,5.5,0.7,[[("The 301% case includes the step-change off a small base and is not sustainable. The 62% figure is the honest forward number.",{"color":MUT,"size":9.8})]],gap=0)
cy=y+2.85; card(s,ML,cy,5.5,1.3,fill=C(0x0B,0x2A,0x24),edge=MINT)
para(s,ML+0.24,cy+0.2,5.05,1.0,[[("On the last six months' rate the business reaches £500,000 a month in about 14 months without doing anything new. ",M),("Every initiative here should be judged on whether it beats a 62% baseline.",{"color":SEC})]],size=11,line=1.4,gap=0)
gx=ML+5.85; gw=CW-5.85
card(s,gx,y,gw,3.5); label(s,gx+0.28,y+0.24,gw-0.5,"Monthly revenue from August 2026, by growth rate")
px,py,pw,ph=gx+0.5,y+0.72,gw-0.95,2.15
MAXV=700.0
def ypos(v): return py+ph-ph*min(v,MAXV)/MAXV
rect(s,px,py+ph,pw,0.008,RULE)
ty=ypos(500)
rect(s,px,ty,pw,0.008,WHITE)
text(s,px+0.06,ty-0.26,2.0,0.2,"£500k target",size=9,color=WHITE,bold=True)
def curve(rate,color,months=18):
    g=(1+rate)**(1/12.0); prev=None
    for m in range(months+1):
        cx=px+pw*m/months; cy=ypos(285.85*g**m)
        if prev is not None:
            x1,y1=prev
            rect(s,x1,min(y1,cy),max(cx-x1,0.022),max(abs(cy-y1),0.03),color)
        prev=(cx,cy)
    return prev
end_m=curve(0.62,MINT); end_a=curve(0.30,AMBER)
text(s,px+pw-2.5,end_m[1]-0.30,2.5,0.2,"62%/yr — £500k at month 14",size=9,color=MINT,bold=True,align=PP_ALIGN.RIGHT)
text(s,px+pw-2.5,end_a[1]+0.12,2.5,0.2,"30%/yr — £500k at month 26",size=9,color=AMBER,bold=True,align=PP_ALIGN.RIGHT)
text(s,px+0.06,py+ph+0.07,2.0,0.2,"AUG 2026 · £285,850",size=8,color=MUT,bold=True,space=1.1)
text(s,px+pw-1.4,py+ph+0.07,1.4,0.2,"MONTH 18",size=8,color=MUT,bold=True,space=1.1,align=PP_ALIGN.RIGHT)
para(s,gx,y+3.62,gw,0.5,[[("The gap between those two lines is what this roadmap is for. Holding 62% is worth twelve months of time; letting it fall to 30% costs a year.",{"color":MUT,"size":9.8})]],gap=0)

# ---------- 04 gap ----------
s=slide(prs)
y=header(s,"03 · What the plan is for",[("Two jobs: hold the trend, then ",{}),flourish("beat"),(" it",{})],
  "Six levers, ordered by what has to happen first. The first three cost almost nothing, because the work is either already built or simply absent.",4)
levers=[("Already built","Release the site work","+£147k – £194k",MINT,"Five waves merged and tested, waiting on a release decision. Costs nothing to deploy"),
 ("Do first","Stop the bot traffic","Protects all",RED,"92% of sessions are fictional and are corrupting what Google and Meta learn"),
 ("Cheapest","Trade & email","Does not exist",MINT,"6,028 buyers, repeat worth 3.7×, £65k a month abandoned, no email running"),
 ("Fastest","Paid restructure","+£30k – £50k",MINT,"Consolidation lifting working-media return, plus Microsoft to its ceiling"),
 ("Proven","Solid hardwood","+£30k – £60k",MINT,"Against the £13.3k a month it already earns with no marketing behind it"),
 ("Unproven","Flooring","Trial only",AMBER,"A different competitive set. Judged on its own funnel, not folded into the forecast")]
cw=(CW-5*0.16)/6
for i,(tag,h,v,col,note) in enumerate(levers):
    x=ML+i*(cw+0.16)
    card(s,x,y,cw,2.5,edge=MINT if i in (0,2) else (RED if i==1 else RULE))
    pill(s,x+0.16,y+0.18,tag,color=col)
    text(s,x+0.16,y+0.58,cw-0.3,0.5,h,size=12,color=WHITE,bold=True,space=-0.3)
    stat(s,x+0.16,y+1.06,cw-0.3,v,color=col,size=15)
    para(s,x+0.16,y+1.44,cw-0.3,0.95,[[(note,{"color":MUT,"size":8.6})]],line=1.35,gap=0)
cy=y+2.72; hw=(CW-0.3)/2
card(s,ML,cy,hw,1.42,fill=C(0x0B,0x2A,0x24),edge=MINT)
text(s,ML+0.26,cy+0.2,hw-0.5,0.3,"How to read these numbers honestly",size=12.5,color=MINT,bold=True)
para(s,ML+0.26,cy+0.55,hw-0.5,0.8,[[("These levers are not additive on top of the 62% trend — much of that growth arrives through them. The honest claim is narrower: ",{"color":SEC}),("this plan protects the 62% baseline and gives a credible route to twelve months or better.",B)]],size=10.5,line=1.38,gap=0)
card(s,ML+hw+0.3,cy,hw,1.42)
text(s,ML+hw+0.56,cy+0.2,hw-0.5,0.3,"The order matters more than the list",size=12.5,color=WHITE,bold=True)
para(s,ML+hw+0.56,cy+0.55,hw-0.5,0.8,[[("Stop the bots, then release the built work, then fix the paid structure — in that sequence. Each makes the measurement of the next trustworthy. Adding budget before them is how a 62% trend quietly becomes a 30% one.",{"color":SEC})]],size=10.5,line=1.38,gap=0)

# ---------- 05 customers ----------
s=slide(prs)
y=header(s,"04 · Who is buying",[("A repeat buyer is worth ",{}),flourish("3.7×"),(" a one-time buyer",{})],
  "Fifteen thousand customer records, read for the first time. They change where the cheapest revenue in the plan sits.",5)
lw=5.9
card(s,ML,y,lw,1.5,fill=C(0x0B,0x2A,0x24),edge=MINT)
para(s,ML+0.26,y+0.2,lw-0.5,0.5,[[("19.2% of buyers have ordered more than once — and those 1,155 people generate 46.6% of all lifetime revenue.",M)]],size=11.5,line=1.35,gap=0)
for i,(l,v,col) in enumerate([("Repeat buyer","£1,192",MINT),("One-time buyer","£324",WHITE),("Multiple","3.7×",MINT)]):
    x=ML+0.26+i*1.85; label(s,x,y+0.86,1.7,l); stat(s,x,y+1.08,1.7,v,color=col,size=20)
table(s,ML,y+1.72,lw,["Segment","Customers","Lifetime revenue","Share"],
 [["Top 1%","60","£398,763","13.5%"],["Top 5%","301","£1,055,460","35.7%"],
  ["Top 10%","602","£1,478,972","50.0%"],["Top 20%","1,205","£1,954,316","66.1%"]],
 [1.7,1.3,1.8,1.1],hi=(2,),rowh=0.3)
gx=ML+lw+0.3; gw=CW-lw-0.3
card(s,gx,y,gw,1.02,edge=MINT)
para(s,gx+0.26,y+0.16,gw-0.5,0.75,[[("Only 38 customers have ever spent more than £5,000, and they average 3.7 orders each. ",M),("That is the entire high-value trade base — 38 people producing 10.1% of lifetime revenue.",{"color":SEC})]],size=10.8,line=1.35,gap=0)
cy=y+1.16; card(s,gx,cy,gw,2.1,edge=RED)
pill(s,gx+0.26,cy+0.16,"Gap",color=RED)
text(s,gx+0.26,cy+0.52,gw-0.5,0.3,"There is no trade programme and no email programme",size=12.5,color=WHITE,bold=True)
for i,(l,v) in enumerate([("Tagged wholesale","2"),("Tagged newsletter","24"),("Email sessions, 30d","36")]):
    x=gx+0.26+i*1.86
    card(s,x,cy+0.88,1.7,0.62,fill=BG)
    label(s,x+0.12,cy+0.97,1.5,l,size=7.5); stat(s,x+0.12,cy+1.16,1.5,v,color=RED,size=17)
para(s,gx+0.26,cy+1.6,gw-0.5,0.42,[[("Across 6,028 buyers, two are tagged wholesale — no trade account structure, despite £1,000+ orders carrying 47.9% of revenue. There are also 9,554 customer records with no order, 61% of the file, receiving nothing.",{"color":SEC,"size":10})]],line=1.32,gap=0)
cy=y+3.4; card(s,gx,cy,gw,0.95,fill=C(0x0B,0x2A,0x24),edge=MINT)
para(s,gx+0.26,cy+0.18,gw-0.5,0.65,[[("This is the cheapest revenue in the entire plan. ",M),("A business with 6,028 buyers and a repeat buyer worth 3.7× is not emailing the people who have already bought from it.",{"color":SEC})]],size=10.8,line=1.35,gap=0)

# ---------- 06 analytics ----------
s=slide(prs)
y=header(s,"05 · The measurement problem",[("92% of reported traffic is ",{}),flourish("not real"),("",{})],
  "Every conversion rate in Shopify Analytics is currently wrong by a factor of ten — and the same signal is being fed back to Google and Meta.",6)
lw=5.6
table(s,ML,y,lw,["Month","Sessions","Orders","Implied CR"],
 [["Feb 2026","31,429","458","1.46%"],["Mar 2026","34,281","558","1.63%"],
  ["Apr 2026","45,830","545","1.19%"],["May 2026","30,451","555","1.82%"],
  ["Jun 2026","44,132","546","1.24%"],["Jul 2026","125,218","550","0.44%"],
  ["Aug 2026","531,364","656","0.12%"]],[1.5,1.4,1.1,1.3],
 rowh=0.285,rowcolors={5:AMBER,6:RED})
para(s,ML,y+2.42,lw,0.4,[[("August sessions are twelve times June's while revenue rose 25%. Sessions that do not buy, in that volume, are not customers.",{"color":MUT,"size":9.6})]],gap=0)
cy=y+2.95; card(s,ML,cy,lw,1.35,fill=C(0x0B,0x2A,0x24),edge=MINT)
label(s,ML+0.26,cy+0.18,4,"The clean conversion rate",color=MINT)
stat(s,ML+0.26,cy+0.42,3,"1.45%",size=28)
para(s,ML+2.5,cy+0.44,lw-2.8,0.7,[[("Averaged across the eleven months before the anomaly, ranging 1.05% to 2.08%. The model stands, and is now evidenced rather than assumed.",{"color":SEC,"size":10})]],line=1.35,gap=0)
gx=ML+lw+0.3; gw=CW-lw-0.3
card(s,gx,y,gw,2.55,edge=RED)
pill(s,gx+0.26,y+0.18,"Critical · confirmed",color=RED)
text(s,gx+0.26,y+0.56,gw-0.5,0.3,"92% of reported traffic is bot activity logged as direct",size=12.5,color=WHITE,bold=True)
card(s,gx+0.26,y+0.94,gw-0.5,1.0,fill=BG)
rows=[("direct","466,756",RED),("search","18,655",SEC),("social","3,409",SEC),("email","36",SEC),("paid","10",SEC)]
for i,(k,v,col) in enumerate(rows):
    yy=y+1.02+i*0.175
    text(s,gx+0.42,yy,1.4,0.18,k,size=9,color=MUT)
    text(s,gx+1.5,yy,1.0,0.18,v,size=9,color=col,bold=True,align=PP_ALIGN.RIGHT)
    text(s,gx+2.9,yy,1.4,0.18,["direct","search","social","email","paid"][i],size=9,color=MUT)
    text(s,gx+4.0,yy,1.1,0.18,["76,851","55,283","18,214","120","68"][i],size=9,color=SEC,align=PP_ALIGN.RIGHT)
label(s,gx+0.42,y+0.98-0.16,2,"last 30 days",size=7.5)
label(s,gx+2.9,y+0.98-0.16,3,"60–180 days ago, per 120",size=7.5)
para(s,gx+0.26,y+2.02,gw-0.5,0.45,[[("Direct sessions went from roughly 19,000 a month to 466,756 in thirty days — a 24-fold rise — while search, social and orders all stayed on trend.",{"color":SEC,"size":10})]],line=1.32,gap=0)
cy=y+2.7; card(s,gx,cy,gw,1.6)
text(s,gx+0.26,cy+0.18,gw-0.5,0.3,"Why it matters beyond the reporting",size=12.5,color=WHITE,bold=True)
bullets(s,gx+0.26,cy+0.52,gw-0.5,1.0,[
 "Every conversion rate in Shopify Analytics is wrong by a factor of ten, so any decision taken on it is taken on corrupted data",
 [("It contaminates the signal fed back to Google and Meta. ",B),("This needs stopping before any new paid budget is set",{"color":SEC})],
 "It is real server load, and a plausible contributor to the missed page-speed gates"],size=10)

# ---------- 07 foundation ----------
s=slide(prs)
y=header(s,"06 · Foundation",[("Five waves are built, tested and merged. None of it is ",{}),flourish("live")],
  "Every figure on this slide is an unrealised gain sitting in a branch, waiting on a release decision.",7)
lw=7.0
table(s,ML,y,lw,["Metric","Before","After","Status"],
 [["PDP page weight — 38s idle","36.9 MB","under 1.6 MB","Merged, not live"],
  ["Time until size options usable","45.0 s","11.7 s","Merged, not live"],
  ["Product page layout shift (CLS)","0.362","0.045","Merged, not live"],
  ["Largest contentful paint","up to 8.0 s","3.0 s","Merged, not live"],
  ["Critical accessibility violations","32 nodes","0","Merged, not live"],
  ["Contrast failures","108 nodes","0","Merged, not live"],
  ["Products wrongly excluding VAT","635","0","Live"],
  ["Configurable products, no from-price","47","0","Live"]],
 [3.0,1.2,1.3,1.5],hi=(0,1,2),rowh=0.30,fs=10)
para(s,ML,y+2.85,lw,0.4,[[("Waves 0–4 were built, browser-tested and merged to develop from 5 September. main is untouched.",{"color":MUT,"size":9.6})]],gap=0)
gx=ML+lw+0.3; gw=CW-lw-0.3
card(s,gx,y,gw,1.55,fill=C(0x2A,0x24,0x10),edge=AMBER)
pill(s,gx+0.26,y+0.18,"Decision required",color=AMBER)
text(s,gx+0.26,y+0.56,gw-0.5,0.3,"The release is the highest-value action available",size=12.5,color=AMBER,bold=True)
para(s,gx+0.26,y+0.92,gw-0.5,0.55,[[("That includes the head-tag fix. Written on 6 September and merged — the live site still carries the broken version. Every day it waits, 610,000 monthly impressions keep converting at 1.09%.",{"color":SEC,"size":10})]],line=1.32,gap=0)
cy=y+1.7; card(s,gx,cy,gw,2.6)
text(s,gx+0.26,cy+0.18,gw-0.5,0.3,"What is still outstanding",size=12.5,color=WHITE,bold=True)
bullets(s,gx+0.26,cy+0.54,gw-0.5,1.9,[
 [("Wave 5, the CRO wave, is not built. ",B),("Title and price above the fold, sticky checkout bar, price per metre, pre-selected defaults, Klarna above £100",{"color":SEC})],
 [("Performance gates still missed. ",B),("Home LCP 6.9s against a 4s target; Lighthouse mobile 45–51 against a 70 gate",{"color":SEC})],
 [("The £6.68 is only half solvable from the theme. ",B),("Shopify injects its own product JSON-LD carrying the placeholder; full resolution needs the configurator replaced",{"color":SEC})]],size=10)

# ---------- 08 sitevalue ----------
s=slide(prs)
y=header(s,"06 · What the release is worth",[("Every 0.1 of a point is worth ",{}),flourish("£19,250"),(" a month",{})],
  "The conversion rate is now measured rather than assumed, which turns the whole model from an estimate into arithmetic.",8)
lw=5.7
label(s,ML,y,lw,"What a fraction of a point pays · 44,132 real sessions, £436 AOV")
table(s,ML,y+0.28,lw,["Conversion rate","Sessions/mo","+0.1pp","Per year"],
 [["1.0%","63,450","£28,122","£337,460"],["1.45% — measured","44,132","£19,242","£230,899"],
  ["2.0%","31,725","£14,061","£168,730"],["2.5%","25,380","£11,249","£134,984"]],
 [1.9,1.4,1.2,1.4],hi=(1,),rowh=0.3)
para(s,ML,y+1.9,lw,0.5,[[("Measured at 1.45% across the eleven clean months before the bot anomaly, ranging 1.05% to 2.08%.",{"color":MUT,"size":9.6})]],gap=0)
cy=y+2.5; card(s,ML,cy,lw,1.6,fill=C(0x0B,0x2A,0x24),edge=MINT)
para(s,ML+0.26,cy+0.22,lw-0.5,1.2,[[("Every 0.1 of a point is worth about £19,250 a month — £231,000 a year. ",M),("Closing the whole gap on conversion alone would mean moving 1.45% to 2.67%. That is a very large ask from CRO by itself, which is the honest reason the roadmap needs the new revenue lines as well as the fixes.",{"color":SEC})]],size=11,line=1.4,gap=0)
gx=ML+lw+0.3; gw=CW-lw-0.3
label(s,gx,y,gw,"Modelled monthly revenue · organic capture × conversion rate")
table(s,gx,y+0.28,gw,["Organic scenario","CR 1.50%","CR 1.65%","CR 1.80%","CR 2.00%"],
 [["Flat — no release","£281,217","£309,338","£337,460","£374,956"],
  ["1.8× — head fix, snippets","£316,670","£348,337","£380,004","£422,227"],
  ["2.7× — head terms to pos. 6","£356,555","£392,210","£427,866","£475,407"]],
 [2.2,1.2,1.2,1.2,1.2],hi=(2,),rowh=0.32)
para(s,gx,y+1.66,gw,0.4,[[("Other channels held flat. Paid restructure sits on top of this and is counted separately.",{"color":MUT,"size":9.6})]],gap=0)
cy=y+2.14; card(s,gx,cy,gw,1.95,fill=C(0x0B,0x2A,0x24),edge=MINT)
text(s,gx+0.26,cy+0.2,gw-0.5,0.3,"The most important thing this model says",size=12.5,color=MINT,bold=True)
para(s,gx+0.26,cy+0.58,gw-0.5,1.2,[[("The best realistic case for site work alone lands at about £475,000 — close to target but not over it. Fixing the site is worth roughly ",{"color":SEC}),("£147k–£194k a month",B),(" and is by far the cheapest revenue in the plan. But it does not reach £500k on its own. The two halves of the strategy are complementary, not alternatives.",{"color":SEC})]],size=11,line=1.4,gap=0)

# ---------- 09 funnel ----------
s=slide(prs)
y=header(s,"06 · The funnel, stage by stage",[("Why each fix ",{}),flourish("converts")],
  "These are trust mechanics at the decision moment, not persuasion. They remove reasons to doubt the number on the screen.",9)
cw=(CW-2*0.28)/3
stages=[[("Stage 1 · Impression → click","The head fix and the snippet",MINT,
   "610,376 impressions are served every month and 98.9% are thrown away. Restoring the head means Google reads the written title and description rather than auto-generating one, and honours the canonical so the clean collection page ranks."),
  ("Stage 2 · Click → engaged","Seven videos, streaming 31.4 MB",MINT,
   "Testimonial videos autoplayed on every product page, streaming 31.4 MB in 38 seconds without the customer scrolling. They competed for bandwidth with the size options — which is why options took 45 seconds to become usable.")],
 [("Stage 3 · Engaged → add to cart","The primary button did nothing",RED,
   "Tapping Add to cart before choosing options produced no request, no message and no change of state. A customer at maximum intent presses the main button and the site does not acknowledge it. All five recommendation cards also showed £6.68 against a configured £24.65."),
  ("Stage 4 · Add to cart → cart","The £0.00 drawer",MINT,
   "After a successful add the drawer showed a blank title, a £0.00 subtotal and “Add £50.00 to reach the £50 minimum” — while the cart itself was correct. It stayed wrong for roughly six seconds.")],
 [("Stage 5 · Cart → checkout","The minimum-order trap",RED,
   "A basket under £50 passed the whole funnel with Checkout enabled, then hit a red banner at the final step. A total loss at the highest-intent point on the site, after the customer has already invested the configuration effort."),
  ("Still upstream","The nine-second wait",MINT,
   "The configurator posts to the cart and receives three rejections before succeeding, so tap-to-drawer measures 9.6 seconds. A watchdog message turns dead time into explained time, but only replacing the configurator removes the wait.")]]
for ci,col in enumerate(stages):
    x=ML+ci*(cw+0.28)
    for ri,(lab,h,color,body) in enumerate(col):
        cy=y+ri*2.28
        card(s,x,cy,cw,2.14,edge=RED if color==RED else RULE)
        label(s,x+0.22,cy+0.18,cw-0.4,lab,color=color,size=8)
        text(s,x+0.22,cy+0.44,cw-0.4,0.3,h,size=12,color=WHITE,bold=True,space=-0.3)
        para(s,x+0.22,cy+0.8,cw-0.4,1.2,[[(body,{"color":SEC,"size":9.4})]],line=1.32,gap=0)

# ---------- 10 checkout ----------
s=slide(prs)
y=header(s,"06 · Measured loss",[flourish("£65,452"),(" a month is abandoned at checkout",{})],
  "Newly readable checkout data quantifies exactly what the funnel fixes are aimed at — and what no email is currently chasing.",10)
lw=6.3
label(s,ML,y,lw,"Abandoned checkouts by basket value · 60 days to 9 Sep 2026")
table(s,ML,y+0.28,lw,["Basket value","Abandoned","Share","Value"],
 [["Under £50 — could not check out","44","9.5%","£1,591"],["£50 – £100","116","25.0%","£9,231"],
  ["£100 – £250","177","38.1%","£26,693"],["£250 – £500","69","14.9%","£23,907"],
  ["£500 – £1,000","38","8.2%","£25,988"],["£1,000 and over","20","4.3%","£43,494"]],
 [2.6,1.2,1.0,1.3],hi=(5,),rowcolors={0:RED},rowh=0.3)
cy=y+2.32; card(s,ML,cy,lw,1.65,fill=C(0x0B,0x2A,0x24),edge=MINT)
label(s,ML+0.26,cy+0.2,4,"Abandoned at checkout, per month",color=MINT)
stat(s,ML+0.26,cy+0.46,4,"£65,452",size=34)
para(s,ML+0.26,cy+1.02,lw-0.5,0.5,[[("Recovering a tenth of it is ",{"color":SEC}),("£6,545 a month, £78,542 a year",B),(" — and abandoned-checkout email is not currently running.",{"color":SEC})]],size=11,line=1.35,gap=0)
gx=ML+lw+0.3; gw=CW-lw-0.3
for i,(h,body,edge) in enumerate([
 ("9.5% were structurally incapable of completing","Forty-four abandoned baskets sat under the £50 minimum. Those customers could not check out however much they wanted to — the rejection came at the final step. This is exactly the trap the wave 1 gate closes, and it is already built.",RED),
 ("The biggest baskets abandon most expensively","Twenty abandoned baskets over £1,000 carry £43,494 — a third of the total value from 4.3% of abandonments. These are precisely the orders most exposed to the nine-second add to cart and the £0.00 drawer.",RULE),
 ("Two fixes, both cheap","The funnel work already merged addresses the mechanical causes. The recovery email — which does not exist — addresses the rest. Together they are the clearest example in this deck of revenue that needs no new traffic, no new products and no new budget.",MINT)]):
    cy=y+i*1.42
    card(s,gx,cy,gw,1.28,fill=C(0x0B,0x2A,0x24) if edge==MINT else CARD,edge=edge)
    text(s,gx+0.26,cy+0.18,gw-0.5,0.3,h,size=12,color=MINT if edge==MINT else WHITE,bold=True)
    para(s,gx+0.26,cy+0.54,gw-0.5,0.68,[[(body,{"color":SEC,"size":9.8})]],line=1.35,gap=0)

# ---------- 11 organic ----------
s=slide(prs)
y=header(s,"07 · Lever · Organic",[("610,000 impressions a month, converting at ",{}),flourish("1.09%")],
  "Ranking fourth and taking zero clicks from thousands of impressions is not a ranking problem. It is a presentation problem.",11)
lw=5.9
label(s,ML,y,lw,"Ranking on page one, taking no clicks")
table(s,ML,y+0.28,lw,["Query","Position","Impressions","Clicks","CTR"],
 [["architrave corner mouldings","5.2","5,981","0","0.00%"],["decorative mdf mouldings","4.4","3,572","0","0.00%"],
  ["mouldings and skirtings","6.7","4,755","0","0.00%"],["mdf mouldings near me","6.6","2,082","0","0.00%"],
  ["stepped architrave","4.8","8,633","4","0.05%"],["architrave around windows","8.3","6,912","2","0.03%"]],
 [2.2,0.95,1.2,0.8,0.95],rowh=0.30)
para(s,ML,y+2.28,lw,0.45,[[("At an average position of 10.4 the expected click-through rate is roughly 2.5–3%. The site earns 1.09%.",{"color":MUT,"size":9.8})]],gap=0)
cy=y+2.8; card(s,ML,cy,lw,1.3,fill=C(0x0B,0x2A,0x24),edge=MINT)
para(s,ML+0.26,cy+0.2,lw-0.5,0.95,[[("584 keywords already sit on page one, 237 in the top three. ",M),("A further 157,400 monthly searches sit on 30 head terms stranded on page two: architrave (26,000, position 18), dado rail (25,000, position 34), window sill (25,000, position 25).",{"color":SEC})]],size=10.8,line=1.38,gap=0)
gx=ML+lw+0.3; gw=CW-lw-0.3
card(s,gx,y,gw,3.15)
label(s,gx+0.26,y+0.22,gw-0.5,"Estimated monthly organic visits · GB")
comp=[("skirting4u.co.uk",62130,MID),("mdfskirtingworld.co.uk",40484,MID),("nationalskirting.co.uk",14012,MID),
      ("wmboyle.co.uk",13591,MID),("skirtingboardsdirect.com",9345,MID),("skirtingsrus.co.uk",7953,MID),
      ("MR Mouldings",6827,MINT),("skirtingking.co.uk",6244,MID)]
bx=gx+2.1; bw=gw-2.9
for i,(n,v,col) in enumerate(comp):
    yy=y+0.58+i*0.31
    text(s,gx+0.26,yy,1.9,0.24,n,size=9.5,color=MINT if col==MINT else SEC,bold=(col==MINT))
    rect(s,bx,yy+0.04,max(bw*v/62130,0.03),0.155,col)
    text(s,bx+bw*v/62130+0.06,yy,0.85,0.24,f"{v:,}",size=8.6,color=MINT if col==MINT else MUT,bold=True)
para(s,gx,y+3.28,gw,0.75,[[("skirting4u sits on a Domain Rating of 22 against MR Mouldings' 18 — a near-identical authority profile producing nine times the traffic. skirtingboardsdirect.com outranks the site on a Domain Rating of 5. The gap is structural and on-page, not brand strength or link budget.",{"color":MUT,"size":9.8})]],line=1.4,gap=0)

# ---------- 12 organic prize ----------
s=slide(prs)
y=header(s,"07 · Lever · The prize",[("The demand is already earned. ",{}),flourish("Capture"),(" is the constraint",{})],
  "Organic clicks nearly doubled in twelve months without intervention. Closing the click-through gap is the cheapest traffic in the plan.",12)
lw=5.8
card(s,ML,y,lw,2.35)
label(s,ML+0.26,y+0.22,lw-0.5,"Organic clicks per month · Aug 2025 – Jul 2026")
clicks=[3438,3680,4090,4130,3120,4310,4530,4960,4790,4920,5500,6666]
px,py,pw,ph=ML+0.5,y+0.62,lw-1.0,1.35
rect(s,px,py+ph,pw,0.008,RULE)
for i in range(len(clicks)-1):
    x1=px+pw*i/(len(clicks)-1); x2=px+pw*(i+1)/(len(clicks)-1)
    y1=py+ph-ph*clicks[i]/7000; y2=py+ph-ph*clicks[i+1]/7000
    rect(s,x1,min(y1,y2),max(x2-x1,0.02),max(abs(y2-y1),0.03),MINT)
text(s,px,py+ph+0.06,2,0.2,"AUG 2025 · 3,438",size=8,color=MUT,bold=True,space=1.1)
text(s,px+pw-2,py+ph+0.06,2,0.2,"JUL 2026 · 6,666",size=8,color=MINT,bold=True,space=1.1,align=PP_ALIGN.RIGHT)
cy=y+2.5; card(s,ML,cy,lw,1.6)
text(s,ML+0.26,cy+0.18,lw-0.5,0.3,"Where the work goes",size=12.5,color=WHITE,bold=True)
bullets(s,ML+0.26,cy+0.52,lw-0.5,1.0,[
 "Verify the head-tag and pricing fixes, then re-request indexing on the affected collection pages",
 "Rewrite titles and meta descriptions on head terms returning auto-generated snippets",
 "Push the 30 page-two head terms onto page one — the cheapest volume in the account",
 "Resolve filtered and paginated URLs ranking in place of clean collection pages"],size=9.8)
gx=ML+lw+0.3; gw=CW-lw-0.3
label(s,gx,y,gw,"What closing the click-through gap is worth")
table(s,gx,y+0.28,gw,["Scenario","CTR","Clicks / mo","Revenue / mo"],
 [["Today — average position 10.4","1.09%","6,666","£44,231"],
  ["Defects fixed, snippets honoured","2.0%","12,208","£81,157"],
  ["Head terms to average position 6","3.0%","18,311","£121,736"],
  ["Head terms to position 4–5","5.0%","30,519","£202,894"]],
 [2.7,0.9,1.2,1.4],hi=(2,),rowh=0.34)
para(s,gx,y+1.85,gw,0.7,[[("Modelled on current impressions and a £443 average order value, at the measured 1.45–1.5% conversion rate. Impressions would also rise with position, so these are conservative on volume.",{"color":MUT,"size":9.8})]],line=1.4,gap=0)

# ---------- 13 paid ----------
s=slide(prs)
y=header(s,"08 · Lever · Paid media",[("The account is over-segmented, and the marginal pound buys ",{}),flourish("less")],
  "August 2026 actuals from the Google Ads account. The structure, not the budget, is what is capping return.",13)
lw=5.9
label(s,ML,y,lw,"Google Ads · August 2026 · 18 live campaigns")
table(s,ML,y+0.28,lw,["Campaign","Spend","Revenue","ROAS"],
 [["PMax · Shopping","£6,112","£48,334","7.91"],["Shopping · Architraves","£3,580","£15,481","4.32"],
  ["Shopping · Panel Moulds","£3,305","£13,253","4.01"],["Search · Skirting Boards","£1,646","£4,942","3.00"],
  ["Shopping · Cornices","£1,443","£10,343","7.17"],["Search · Brand","£1,183","£36,509","30.87"],
  ["Shopping · Dado & Picture Rails","£1,157","£4,487","3.88"],["Shopping · Zombie Products","£906","£1,971","2.18"],
  ["Six campaigns under £500 each","£1,551","£3,484","2.25"]],
 [2.6,1.1,1.2,0.9],hi=(5,),dim=(8,),rowh=0.275,fs=10)
para(s,ML,y+3.05,lw,0.4,[[("Remaining campaigns omitted for space. Blended account ROAS was 6.40 in August.",{"color":MUT,"size":9.6})]],gap=0)
gx=ML+lw+0.3; gw=CW-lw-0.3
card(s,gx,y,gw,1.62,fill=C(0x0B,0x2A,0x24),edge=MINT)
text(s,gx+0.26,y+0.18,gw-0.5,0.3,"Segmentation is costing roughly £45k a month in Shopping alone",size=12.5,color=MINT,bold=True)
for i,(l,v,col,sub) in enumerate([("Eight segmented Shopping campaigns","4.51×",WHITE,"on £13,075"),("One pooled PMax campaign","7.91×",MINT,"on £6,112")]):
    x=gx+0.26+i*2.9
    label(s,x,y+0.6,2.7,l,size=7.8); stat(s,x,y+0.82,2.7,v,color=col,size=22)
    text(s,x,y+1.22,2.7,0.2,sub,size=9,color=MUT)
para(s,gx+0.26,y+1.2,gw-0.5,0.3,[[("",{})]],gap=0)
cy=y+1.78
for i,(h,body,col) in enumerate([("Brand is flattering the blend","Brand search returns 30.87× on £1,183 — demand you already own. Strip it out and working media returns 5.20×, not the headline 6.40×.",WHITE),
 ("The marginal pound buys less","Spend rose 44% June to August. Revenue rose 14%. The incremental £7,704 returned 2.65× — against a 6.40× blended average.",AMBER)]):
    x=gx+i*((gw-0.25)/2+0.25); w=(gw-0.25)/2
    card(s,x,cy,w,1.15)
    label(s,x+0.22,cy+0.16,w-0.4,h,color=col)
    para(s,x+0.22,cy+0.42,w-0.4,0.65,[[(body,{"color":SEC,"size":9.6})]],line=1.32,gap=0)
cy=y+3.06; card(s,gx,cy,gw,1.4)
text(s,gx+0.26,cy+0.16,gw-0.5,0.3,"The plan, before any new budget",size=12.5,color=WHITE,bold=True)
bullets(s,gx+0.26,cy+0.5,gw-0.5,0.85,[
 "Consolidate all Shopping into one campaign; fold the six sub-£500 campaigns into their parents",
 "Restructure Search into fewer campaigns with more ad groups, so budgets and data pool",
 "Strip generic keyword insertion; pin real differentiators and mine customer reviews for copy",
 "Scale Microsoft Ads from £3.2k to its £5.4k ceiling at 7–8× ROAS"],size=9.6)

# ---------- 14 hardwood ----------
s=slide(prs)
y=header(s,"09 · Lever · Hardwood",[("Tulipwood is already selling. Nobody ",{}),flourish("searches"),(" for it",{})],
  "£26,571 in sixty days from a product with no category, no product page and no marketing at all.",14)
cw=(CW-2*0.28)/3
card(s,ML,y,cw,1.5,fill=C(0x0B,0x2A,0x24),edge=MINT)
pill(s,ML+0.22,y+0.16,"Validated by the order book")
para(s,ML+0.22,y+0.56,cw-0.4,0.85,[[("Twelve tulipwood line items across three orders. A ",{"color":SEC}),("£13,285 monthly run rate",B),(", roughly £161,000 annualised, from a product with no shop presence.",{"color":SEC})]],size=10.5,line=1.35,gap=0)
for i,(l,v,col,n) in enumerate([("Average order","£8,900",MINT,"Twenty times the £443 site average"),("Largest line","£9,145",WHITE,"18×120mm Big Bolection")]):
    x=ML+i*((cw-0.2)/2+0.2); w=(cw-0.2)/2
    card(s,x,y+1.64,w,1.0); label(s,x+0.18,y+1.78,w-0.3,l,size=8)
    stat(s,x+0.18,y+1.98,w-0.3,v,color=col,size=19)
    para(s,x+0.18,y+2.32,w-0.3,0.28,[[(n,{"color":MUT,"size":8.4})]],gap=0)
para(s,ML,y+2.78,cw,0.5,[[("The commercial case does not need testing. It has been proven by customers who found it without any help from us.",{"color":MUT,"size":9.6})]],gap=0)
x2=ML+cw+0.28
pill(s,x2,y,"Reframe required",color=AMBER,fill=C(0x2A,0x24,0x10))
label(s,x2,y+0.38,cw,"UK search volume per month")
table(s,x2,y+0.62,cw,["Search term","Volume"],
 [["tulip mouldings","0"],["tulipwood architrave","0"],["american tulipwood","10"],["tulipwood skirting","20"],
  ["oak architrave","1,000"],["oak skirting board","600"],["hardwood architrave","200"],["hardwood skirting board","150"],["solid wood skirting board","100"]],
 [2.6,1.0],hi=(4,5,6,7,8),dim=(0,1,2,3),rowh=0.265,fs=9.8)
cy=y+3.3; card(s,x2,cy,cw,1.0)
para(s,x2+0.22,cy+0.18,cw-0.4,0.7,[[("Ahrefs assigns both “hardwood skirting board” and “solid wood skirting board” the parent topic ",{"color":SEC}),("oak skirting boards",B),(". Demand is real — it lives under oak and hardwood, never tulip.",{"color":SEC})]],size=10,line=1.35,gap=0)
x3=ML+2*(cw+0.28)
label(s,x3,y,cw,"Pricing sits at roughly twice MDF")
table(s,x3,y+0.24,cw,["Type","Tulip / m","Range"],
 [["Skirting","£33.17","£20.60–£42.12"],["Dado rail","£19.27","£13.50–£26.43"],
  ["Architrave","£18.00","£10.04–£23.90"],["Panel mould","£9.74","£7.65–£14.27"]],
 [1.4,1.0,1.5],rowh=0.29)
para(s,x3,y+1.62,cw,0.5,[[("At a typical 3m length that implies roughly £15/m for MDF skirting against tulip's £33.17 — about a 2× premium.",{"color":MUT,"size":9.4})]],line=1.35,gap=0)
cy=y+2.2; card(s,x3,cy,cw,1.1,edge=MINT)
pill(s,x3+0.22,cy+0.14,"Advantage")
text(s,x3+0.22,cy+0.48,cw-0.4,0.26,"Fixed variants, not configurator products",size=11,color=WHITE,bold=True)
para(s,x3+0.22,cy+0.76,cw-0.4,0.3,[[("None of the £6.68 placeholder problem, none of the nine-second add to cart.",{"color":SEC,"size":9.6})]],gap=0)
cy=y+3.42; card(s,x3,cy,cw,0.88,fill=C(0x0B,0x2A,0x24),edge=MINT)
para(s,x3+0.22,cy+0.16,cw-0.4,0.6,[[("A top-level range in the main navigation",M),(", not a material filter inside MDF. Burying a 2× premium in an MDF listing invites comparison on price alone.",{"color":SEC})]],size=10,line=1.35,gap=0)

# ---------- 15 launch ----------
s=slide(prs)
y=header(s,"10 · Launching the range",[("Release by period, not by product ",{}),flourish("type")],
  "Seventy-nine products in a 20 × 4 matrix, all unpublished — which means every issue below can be fixed before anything goes live.",15)
lw=6.6
table(s,ML,y,lw,["Wave","Period","Products","Rationale"],
 [["1","Georgian","16","Strongest period signal — £259,921/yr in MDF. Complete four-type set"],
  ["2","Victorian","15","£195,691/yr in MDF, the period tied to the high-end renovation buyer"],
  ["3","Edwardian","28","The largest block. Hold until the first two prove the merchandising"],
  ["4","Contemporary","20","The only wave with real search volume — 3,152 impressions a month"]],
 [0.6,1.3,0.9,4.0],hi=(0,),rowh=0.48,fs=10)
cy=y+2.35; card(s,ML,cy,lw,1.75)
text(s,ML+0.26,cy+0.18,lw-0.5,0.3,"Why period, not product type",size=12.5,color=WHITE,bold=True)
para(s,ML+0.26,cy+0.54,lw-0.5,1.1,[[("The instinct is to release all the skirtings, then all the architraves. The product data argues against it. Every page reads “pair with the matching skirting, panel mould and architrave”, and the whole proposition of a 20 × 4 matrix is that a room can be specified in one profile. ",{"color":SEC}),("Release by type and every page cross-sells to three products that do not exist yet.",M)]],size=10.5,line=1.4,gap=0)
gx=ML+lw+0.3; gw=CW-lw-0.3
card(s,gx,y,gw,1.72,edge=RED)
pill(s,gx+0.24,y+0.14,"Blocking · fix before publishing",color=RED)
text(s,gx+0.24,y+0.5,gw-0.45,0.26,"The range is named after a term nobody searches",size=11.5,color=WHITE,bold=True)
para(s,gx+0.24,y+0.82,gw-0.45,0.82,[[("All 79 titles, handles and SEO titles contain “Tulip”; none contain “hardwood”. Keep the profile names — they are a genuine brand asset. Make the layer above findable: the collection is ",{"color":SEC}),("Solid Hardwood Skirting Boards",B),(". Handles are cheapest to change now — renaming after launch means redirects and lost equity.",{"color":SEC})]],size=9.8,line=1.35,gap=0)
cy=y+1.86; card(s,gx,cy,gw,1.32,edge=RED)
pill(s,gx+0.24,cy+0.14,"Blocking",color=RED)
para(s,gx+0.24,cy+0.5,gw-0.45,0.7,[[("The priming and size options are inconsistent — 59 products use “Priming / Un-Primed”, 20 use “Primed / Not Primed”. Two names for the same thing fragments the storefront filter. Size has the same split.",{"color":SEC,"size":9.8})]],line=1.35,gap=0)
cy=y+3.32; hw=(gw-0.22)/2
for i,(tag,body) in enumerate([("Check","The from_price metafield is empty on all 79. Collection cards read that metafield — check against a real product or they render with no price."),
 ("Copy","Every page compares tulip wood to softwood. This buyer is coming from MDF and deciding at twice the price. Answer that question instead.")]):
    x=gx+i*(hw+0.22)
    card(s,x,cy,hw,0.92)
    pill(s,x+0.18,cy+0.12,tag,color=AMBER,fill=C(0x2A,0x24,0x10))
    para(s,x+0.18,cy+0.44,hw-0.35,0.42,[[(body,{"color":SEC,"size":9})]],line=1.3,gap=0)

# ---------- 16 specification ----------
s=slide(prs)
y=header(s,"11 · Lever · Specification",[("Architects don't search. They ",{}),flourish("specify")],
  "Thirty-eight customers have ever spent over £5,000. This is how that number grows.",16)
lw=5.4
label(s,ML,y,lw,"Specification-intent search barely exists")
table(s,ML,y+0.28,lw,["Search term","UK volume / mo"],
 [["period mouldings","300"],["architectural mouldings","250"],["bespoke mouldings","100"],
  ["moulding specification","0"],["made to measure skirting","0"]],[3.2,1.6],dim=(0,1,2,3,4),rowh=0.31)
para(s,ML,y+2.05,lw,0.45,[[("For comparison, “torus skirting” alone takes 5,200 searches a month. The audience is not absent — it does not arrive through search.",{"color":MUT,"size":9.8})]],line=1.35,gap=0)
cy=y+2.6; card(s,ML,cy,lw,1.5,fill=C(0x0B,0x2A,0x24),edge=MINT)
para(s,ML+0.26,cy+0.22,lw-0.5,1.1,[[("Do not build SEO for this audience. ",M),("The £8,900 tulipwood orders in the order book are the proof of concept: this channel already converts when it finds you. It needs to be sold to, not ranked for.",{"color":SEC})]],size=11,line=1.4,gap=0)
gx=ML+lw+0.3; gw=CW-lw-0.3
card(s,gx,y,gw,2.6)
text(s,gx+0.26,y+0.2,gw-0.5,0.3,"What the specification channel actually needs",size=12.5,color=WHITE,bold=True)
bullets(s,gx+0.26,y+0.58,gw-0.5,1.9,[
 [("An NBS Source listing. ",B),("The platform specifiers use to write products into build documents. The highest-leverage item on the list",{"color":SEC})],
 [("Sample boxes. ",B),("A physical, branded set that sits on a studio shelf. Specifiers choose from what is in front of them",{"color":SEC})],
 [("CAD and detail drawings. ",B),("DWG profiles and NBS-ready clauses per profile. Without these the product cannot be drawn into a job",{"color":SEC})],
 [("Named outbound. ",B),("Architects and designers working on period and high-end residential, approached directly",{"color":SEC})],
 [("A trade contact route. ",B),("Somebody who answers a specification question in an hour, not a general enquiry inbox",{"color":SEC})]],size=10)
cy=y+2.76; card(s,gx,cy,gw,1.34)
label(s,gx+0.26,cy+0.18,gw-0.5,"The economics")
para(s,gx+0.26,cy+0.44,gw-0.5,0.8,[[("One specified job at the current tulipwood average of £8,900 is worth twenty ordinary orders. Three arrived in sixty days with no marketing at all. A low-volume, high-value channel where the cost of acquisition is a sample box and a conversation — and the constraint is that nobody currently owns it.",{"color":SEC,"size":10})]],line=1.38,gap=0)

# ---------- 17 builders ----------
s=slide(prs)
y=header(s,"12 · High-end renovation builders",[("Buy the content, not the ",{}),flourish("followers")],
  "Installed-in-situ proof from real jobs converts harder than reach, and costs a fraction of it.",17)
lw=5.6
card(s,ML,y,lw,2.0,fill=C(0x2A,0x24,0x10),edge=AMBER)
pill(s,ML+0.26,y+0.16,"The creator maths",color=AMBER,fill=C(0x33,0x2C,0x14))
text(s,ML+0.26,y+0.52,lw-0.5,0.3,"£1,000 for one Reel does not stand up",size=12.5,color=AMBER,bold=True)
for i,(l,v,col) in enumerate([("Followers","71,000",WHITE),("Actual views","<10,000",AMBER)]):
    x=ML+0.26+i*2.4
    label(s,x,y+0.92,2.2,l); stat(s,x,y+1.14,2.2,v,color=col,size=20)
para(s,ML+0.26,y+1.52,lw-0.5,0.4,[[("And MR Mouldings is the exclusive UK supplier of the Sunningdale Flexi she wants. Counter at £500–800 plus product, conditional on real performance data.",{"color":SEC,"size":9.8})]],line=1.32,gap=0)
cy=y+2.15; card(s,ML,cy,lw,1.35,fill=C(0x0B,0x2A,0x24),edge=MINT)
label(s,ML+0.26,cy+0.18,lw-0.5,"The better model",color=MINT)
para(s,ML+0.26,cy+0.46,lw-0.5,0.75,[[("Offer a builder ",{"color":SEC}),("50% off an order over £500",B),(" in exchange for filming access on site. It costs less than a single creator fee, and buys installed-in-situ proof from a real job — which is what the core customer responds to.",{"color":SEC})]],size=10.5,line=1.38,gap=0)
gx=ML+lw+0.3; gw=CW-lw-0.3
card(s,gx,y,gw,2.0)
text(s,gx+0.26,y+0.18,gw-0.5,0.3,"The pipeline already exists",size=12.5,color=WHITE,bold=True)
bullets(s,gx+0.26,y+0.54,gw-0.5,1.35,[
 [("Adam's home renovation. ",B),("A full before-and-after case study, filming from late September",{"color":SEC})],
 [("4C Developments, Barnes. ",B),("High-end project, end-to-end, subject to Steve granting access",{"color":SEC})],
 [("The Wimbledon project. ",B),("The site behind the £24,000 order — the natural showcase for the hardwood range",{"color":SEC})],
 [("Founder-led short form. ",B),("Adam explaining profile combinations, plus the podcast format agreed in August",{"color":SEC})]],size=10)
cy=y+2.15; card(s,gx,cy,gw,1.35)
text(s,gx+0.26,cy+0.18,gw-0.5,0.3,"Finding the right builders",size=12.5,color=WHITE,bold=True)
para(s,gx+0.26,cy+0.54,gw-0.5,0.72,[[("Build a named list: renovation specialists posting period and high-end residential work in the South East, identified from Instagram and sorted by the property they finish. Approach individually. This is an outbound motion with a content by-product, not a paid social campaign — and it feeds the same asset library the ads run on.",{"color":SEC,"size":10})]],line=1.38,gap=0)

# ---------- 18 flooring ----------
s=slide(prs)
y=header(s,"13 · Flooring",[("Big demand, a different ",{}),flourish("fight")],
  "The volume dwarfs mouldings. So does the competitive set. Worth a contained trial, judged on its own funnel.",18)
lw=5.0
label(s,ML,y,lw,"UK search volume per month")
table(s,ML,y+0.28,lw,["Category","Volume"],
 [["LVT flooring","83,000"],["laminate flooring","76,000"],["herringbone flooring","55,000"],
  ["engineered wood flooring","17,000"],["oak flooring","5,900"]],[3.0,1.6],hi=(0,1,2),rowh=0.31)
para(s,ML,y+2.05,lw,0.5,[[("For scale: the entire moulding head-term set the site is chasing is 157,400 searches a month. LVT and laminate alone are 159,000.",{"color":MUT,"size":9.8})]],line=1.35,gap=0)
gx=ML+lw+0.3; gw=CW-lw-0.3; hw=(gw-0.25)/2
for i,(tag,col,items) in enumerate([("For",MINT,["The drop-ship model removes stock risk and picking labour entirely","The supplier is across the road — fulfilment friction is close to nil","Genuine adjacency: the same renovation buyer, same moment in the job","Difficulty is low on several of the head terms"]),
 ("Against",RED,["A different competitive set, with national retailers already in it","Paid CPCs run £1.00–£2.00, well above current moulding costs","No brand equity or authority in flooring to build on","Margin is the supplier's to set, not yours"])]):
    x=gx+i*(hw+0.25)
    card(s,x,y,hw,2.35,edge=col if i else RULE)
    pill(s,x+0.22,y+0.16,tag,color=col,fill=C(0x2A,0x14,0x14) if i else RAISED)
    bullets(s,x+0.22,y+0.56,hw-0.4,1.65,items,size=9.8)
cy=y+2.55; card(s,gx,cy,gw,1.55,fill=C(0x2A,0x24,0x10),edge=AMBER)
text(s,gx+0.26,cy+0.2,gw-0.5,0.3,"Recommendation",size=12.5,color=AMBER,bold=True)
para(s,gx+0.26,cy+0.56,gw-0.5,0.9,[[("Worth a contained trial, but ",{"color":SEC}),("judged on its own funnel and its own P&L",B),(" — not folded into the moulding forecast, where it would flatter the numbers without proving anything. Decide after wave one of the hardwood launch, so it competes against a lever we know works.",{"color":SEC})]],size=10.5,line=1.4,gap=0)

# ---------- 19 roadmap ----------
s=slide(prs)
y=header(s,"14 · Twelve months",[("A sequence, not a shopping ",{}),flourish("list")],
  "Each quarter earns the right to the next. Stopping the bots and releasing the built work come first, because they make everything after them measurable.",19)
qw=(CW-3*0.22)/4
quarters=[("Q4 2026 · Oct – Dec","Foundation & structure",["Stop the bot traffic — before any budget moves","Release waves 0–4 to production","Abandoned-checkout email live","Consolidate Shopping; fold the sub-£500 tail","Microsoft Ads to its £5.4k ceiling","Hardwood wave one: Georgian, 16 products"],"£335k",True),
 ("Q1 2027 · Jan – Mar","Capture the earned demand",["Push the 30 page-two head terms onto page one","Trade account structure and email programme live","Hardwood waves two and three","NBS listing and sample boxes live","Margin data in; rebuild the model on contribution"],"£400k",False),
 ("Q2 2027 · Apr – Jun","Open the premium channel",["Specification outbound at scale","CAD and detail drawings per profile","Builder content engine running monthly","Hardwood wave four: Contemporary","CRO programme on collection and product pages","Flooring: trial or drop, on the evidence"],"£460k",False),
 ("Q3 2027 · Jul – Sep","Scale what proved out",["Double down on the levers that beat their mid case","New profile ranges, Torus first — 5,200 searches a month","Quote-to-order path for the £1,000+ job","Repeat-purchase and reactivation programme at scale"],"£500k",True)]
for i,(q,h,items,target,acc) in enumerate(quarters):
    x=ML+i*(qw+0.22)
    card(s,x,y,qw,3.65,edge=MINT if acc else RULE)
    label(s,x+0.2,y+0.18,qw-0.35,q,color=MINT if acc else MUT,size=8)
    text(s,x+0.2,y+0.44,qw-0.35,0.3,h,size=12,color=WHITE,bold=True,space=-0.3)
    bullets(s,x+0.2,y+0.82,qw-0.35,2.15,items,size=9.2,gap=5)
    rect(s,x+0.2,y+3.02,qw-0.4,0.008,RULE)
    label(s,x+0.2,y+3.15,qw-0.35,"Target exit run rate",size=7.5)
    stat(s,x+0.2,y+3.34,qw-0.35,target,size=19)
para(s,ML,y+3.82,CW,0.4,[[("The 62% baseline trend reaches roughly £320k, £380k, £430k and £485k at these four points, arriving at £500k in October 2027. The targets above sit one quarter ahead of that curve — the plan's job is to buy a quarter of time and insure against deceleration, not to invent revenue.",{"color":MUT,"size":9.6})]],line=1.35,gap=0)

# ---------- 20 budget ----------
s=slide(prs)
y=header(s,"15 · Budget & cash",[("What it costs to buy a ",{}),flourish("quarter"),(" of time",{})],
  "Media investment by quarter against both the baseline trend and the plan target, and the one piece of data still missing.",20)
lw=7.4
table(s,ML,y,lw,["Channel","Today","Q4 2026","Q1 2027","Q2 2027","Q3 2027"],
 [["Google Ads — core","£25.3k","£25k","£28k","£32k","£36k"],
  ["Microsoft Ads","£3.2k","£5.4k","£6k","£7k","£8k"],
  ["Hardwood range launch","—","£7k","£8k","£10k","£12k"],
  ["Specification outbound","—","—","—","£3k","£4k"],
  ["Total monthly media","£28.5k","£37.4k","£42k","£52k","£60k"],
  ["62% baseline trend","£285.9k","£320k","£380k","£430k","£485k"],
  ["Plan target run rate","£285.9k","£335k","£400k","£460k","£500k"],
  ["Media as % of revenue","10.0%","11.2%","10.5%","11.3%","12.0%"]],
 [2.3,1.1,1.1,1.1,1.1,1.1],hi=(4,),dim=(5,7),rowh=0.31)
para(s,ML,y+2.9,lw,0.55,[[("Google Ads is held flat through Q4 deliberately: the restructure has to prove it lifts return before more money goes in, and the bot traffic has to stop before the platforms learn from clean signal. Microsoft moves first because it already returns 7–8× and is capped, not constrained by structure.",{"color":MUT,"size":9.8})]],line=1.4,gap=0)
gx=ML+lw+0.3; gw=CW-lw-0.3
card(s,gx,y,gw,1.42,fill=C(0x0B,0x2A,0x24),edge=MINT)
label(s,gx+0.26,y+0.18,gw-0.5,"Incremental cash required over 12 months",color=MINT)
stat(s,gx+0.26,y+0.44,gw-0.5,"£232k",size=34)
para(s,gx+0.26,y+0.98,gw-0.5,0.4,[[("Cumulative additional media above today's run rate, phased. The monthly step is £8.9k in Q4 rising to £31.5k by Q3 — paid in arrears.",{"color":SEC,"size":9.6})]],line=1.32,gap=0)
cy=y+1.56; card(s,gx,cy,gw,0.95)
label(s,gx+0.26,cy+0.16,gw-0.5,"Not included — to be quoted separately")
para(s,gx+0.26,cy+0.42,gw-0.5,0.45,[[("NBS Source listing fee, sample box production and fulfilment, CAD and detail drawing production, creator fees and content day costs, photography.",{"color":SEC,"size":9.6})]],line=1.32,gap=0)
cy=y+2.65; card(s,gx,cy,gw,1.45,fill=C(0x2A,0x24,0x10),edge=AMBER)
text(s,gx+0.26,cy+0.18,gw-0.5,0.3,"The caveat that matters",size=12.5,color=AMBER,bold=True)
para(s,gx+0.26,cy+0.54,gw-0.5,0.8,[[("This table is ",{"color":SEC}),("ROAS-led, not margin-led",B),(". Product cost data by category is now the only real blocker left in the whole analysis. The moment it lands, this gets rebuilt on contribution — and the mix will change.",{"color":SEC})]],size=10.2,line=1.38,gap=0)

# ---------- 21 inputs ----------
s=slide(prs)
y=header(s,"16 · What we need",[("Three of the four gaps are now ",{}),flourish("closed")],
  "The re-authorised app on 9 September shut them at a stroke. What remains is short — and two new items came out of the analysis.",21)
lw=6.4
card(s,ML,y,lw,0.85,fill=C(0x0B,0x2A,0x24),edge=MINT)
para(s,ML+0.26,y+0.2,lw-0.5,0.5,[[("Closed since the last pull. ",M),("The MRM Agent app was re-authorised with 42 scopes on 9 September.",{"color":SEC})]],size=11,line=1.35,gap=0)
for i,(h,body) in enumerate([("Order history — closed","The Admin API is still capped at 60 days, but Shopify's analytics dataset bypasses it entirely. Twenty-four months of sales are in hand — where the 4.36× figure comes from."),
 ("Customer data — closed","All 15,582 records read. Repeat rate, lifetime value and revenue concentration are now measured, not estimated."),
 ("Conversion rate — closed","Measured at 1.45% across eleven clean months, with the bot contamination that would have corrupted it documented and quantified.")]):
    cy=y+1.0+i*1.05
    card(s,ML,cy,lw,0.95)
    text(s,ML+0.24,cy+0.14,0.4,0.22,f"0{i+1}",size=9,color=MINT,bold=True)
    text(s,ML+0.66,cy+0.13,lw-0.9,0.24,h,size=11.5,color=WHITE,bold=True)
    para(s,ML+0.66,cy+0.42,lw-0.9,0.45,[[(body,{"color":SEC,"size":9.6})]],line=1.32,gap=0)
gx=ML+lw+0.3; gw=CW-lw-0.3
card(s,gx,y,gw,1.5,edge=RED)
pill(s,gx+0.26,y+0.16,"Still open — the only real blocker",color=RED)
text(s,gx+0.26,y+0.52,gw-0.5,0.28,"Ad spend and product margin",size=12.5,color=WHITE,bold=True)
para(s,gx+0.26,y+0.84,gw-0.5,0.6,[[("No Meta access and no product cost data. Without both there is no true ROAS, no acquisition cost, and no way to convert a revenue target into a budget. ",{"color":SEC}),("Everything else needed to build the forecast is now available.",B)]],size=10,line=1.35,gap=0)
cy=y+1.64; card(s,gx,cy,gw,1.3,fill=C(0x2A,0x24,0x10),edge=AMBER)
text(s,gx+0.26,cy+0.16,gw-0.5,0.28,"Two things to add to your own list",size=12.5,color=AMBER,bold=True)
para(s,gx+0.26,cy+0.48,gw-0.5,0.7,[[("The bot traffic needs stopping before any paid budget is set",B),(", because it is corrupting the optimisation signal those platforms learn from. And the absence of any trade or email programme is the cheapest gap on the page to close.",{"color":SEC})]],size=10,line=1.35,gap=0)
cy=y+3.08; card(s,gx,cy,gw,1.02)
label(s,gx+0.26,cy+0.14,gw-0.5,"Decisions we need from you")
bullets(s,gx+0.26,cy+0.36,gw-0.5,0.6,["Approve the release of waves 0–4 to production","Sign-off on the range name: Solid Hardwood","Final product images for the 79 products in draft","Product cost data by category, and Meta access"],size=9.2,gap=2)

# ---------- 22 next ----------
s=slide(prs)
y=header(s,"17 · Next",[("The first thirty ",{}),flourish("days")],
  "Owners and dates. The first two actions cost nothing and are worth more than everything below them.",22)
lw=8.0
table(s,ML,y,lw,["","Action","Owner","When"],
 [["01","Stop the bot traffic — identify the source, block it, confirm sessions normalise","Vendo · Toby","This week"],
  ["02","Approve the release of waves 0–4 to production, then verify in Search Console","Adam · then Toby","This week"],
  ["03","Turn on abandoned-checkout email — £65,452 a month unrecovered","Vendo · Helen","w/c 29 Sep"],
  ["04","Consolidate Shopping into one campaign; fold the six sub-£500 campaigns","Vendo · Matthew","w/c 29 Sep"],
  ["05","Microsoft Ads to the £5.4k ceiling, weighted to panel moulds and cornices","Vendo · Matthew","w/c 29 Sep"],
  ["06","Content day — hardwood range, founder-led short form, podcast trial","Joint","30 Sep"],
  ["07","Design the trade account structure and first email flows to 6,028 buyers","Joint","Oct"],
  ["08","Final images; fix naming, handles, priming and size options","Adam · then Vendo","Late Sep"],
  ["09","Hardwood wave one live: Georgian set, 16 products, top-level range","Joint","Oct"],
  ["10","Product cost data and Meta access, then rebuild the budget on contribution","Adam · then Vendo","Oct"]],
 [0.4,4.6,1.5,1.1],hi=(0,1),rowh=0.335,fs=9.8)
gx=ML+lw+0.3; gw=CW-lw-0.3
card(s,gx,y,gw,4.05,fill=C(0x0B,0x2A,0x24),edge=MINT)
label(s,gx+0.3,y+0.28,gw-0.6,"The headline",color=MINT)
para(s,gx+0.3,y+0.6,gw-0.6,3.2,[
 [("£500,000 a month is roughly ",{"color":BODY,"size":13}),("where the current trajectory already arrives",{"color":WHITE,"bold":True,"size":13}),(" — about 14 months out on the last six months' rate, which is your own timeline.",{"color":BODY,"size":13})],
 [("The business has grown 4.36× year on year. This roadmap's job is insurance against deceleration plus the upside that beats trend, not the invention of 1.76× from nothing.",{"color":SEC,"size":11.5})],
 [("Three things are cheaper than anything new: ",{"color":SEC,"size":11.5}),("releasing the five waves already built",B),(", ",{"color":SEC,"size":11.5}),("stopping the bot traffic",B),(" that makes 92% of sessions fictional, and ",{"color":SEC,"size":11.5}),("building the trade and email programmes that do not exist",B),(", in a business where repeat buyers are worth 3.7× and 38 customers carry a tenth of all revenue.",{"color":SEC,"size":11.5})]],
 size=11.5,line=1.42,gap=13)

prs.save("MR Mouldings - Roadmap to 500k.pptx")
print("saved:", len(prs.slides.__iter__.__self__._sldIdLst), "slides")
