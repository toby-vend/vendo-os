"""4a Chat, Discovery as an iMessage-style static (Toby, 23 Oct 2026: "make it look exactly like Apple iMessage").

Same conversation as the Claude Design 4a, on the iOS Messages look: white canvas, #E9E9EB incoming and #0A84FF
outgoing bubbles with tails, status bar, contact header, rich link preview, "Delivered", input bar. Inter stands in
for SF Pro (not installed, and Apple licenses SF Pro for Apple-platform mock-ups only). Offer: First Time Pass,
6 classes for £60. Copy card text comes from the live copy sheet via the same offer rewrite as the other sets.

Usage: python3 build_imessage.py  ->  imessage.html (4a + four variations from imessage_variants.py, columns 6 to 10 of the "Existing · 4 Chat statics" page)
"""
import html
import importlib.util
from pathlib import Path

HERE = Path(__file__).parent
spec = importlib.util.spec_from_file_location('mig', HERE / 'build_migration.py')
mig = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mig)

BLUE, GREY, INK, META, LINE = '#0A84FF', '#E9E9EB', '#000000', '#8E8E93', '#D1D1D6'



def status_bar(s, clock='17:56'):
    bars = ''.join(f'<div style="width:{6 * s}px;height:{(6 + 4 * i) * s}px;background:#000;border-radius:{1.5 * s}px"></div>' for i in range(4))
    wifi = (f'<svg width="{30 * s}" height="{22 * s}" viewBox="0 0 30 22"><path d="M15 21.5l4.6-5.1a6.6 6.6 0 0 0-9.2 0z" fill="#000"/>'
            f'<path d="M15 9.6c3.1 0 6 1.2 8.1 3.3l2.6-2.9A15 15 0 0 0 15 5.6 15 15 0 0 0 4.3 10l2.6 2.9A11.4 11.4 0 0 1 15 9.6z" fill="#000"/>'
            f'<path d="M15 1.6c5.1 0 9.8 2 13.3 5.4L30 5.1A20.5 20.5 0 0 0 15-.6 20.5 20.5 0 0 0 0 5.1L1.7 7A18.6 18.6 0 0 1 15 1.6z" fill="#000"/></svg>')
    batt = (f'<div style="display:flex;align-items:center;gap:{2 * s}px"><div style="width:{40 * s}px;height:{20 * s}px;border:{2 * s}px solid rgba(0,0,0,.4);border-radius:{6 * s}px;padding:{2 * s}px">'
            f'<div style="width:78%;height:100%;background:#000;border-radius:{3 * s}px"></div></div><div style="width:{3 * s}px;height:{7 * s}px;background:rgba(0,0,0,.4);border-radius:0 {2 * s}px {2 * s}px 0"></div></div>')
    return (f'<div style="height:{82 * s}px;display:flex;align-items:center;justify-content:space-between;padding:0 {52 * s}px 0 {62 * s}px">'
            f'<div style="font-weight:600;font-size:{30 * s}px;letter-spacing:-.01em">{clock}</div>'
            f'<div style="display:flex;align-items:center;gap:{12 * s}px"><div style="display:flex;align-items:flex-end;gap:{3 * s}px">{bars}</div>{wifi}{batt}</div></div>')


def header(s, name):
    chev = f'<svg width="{22 * s}" height="{38 * s}" viewBox="0 0 12 21"><path d="M10.5 1.5l-9 9 9 9" stroke="{BLUE}" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>'
    avatar = (f'<div style="width:{86 * s}px;height:{86 * s}px;border-radius:50%;background:linear-gradient(180deg,#A5ABB8,#858994);'
              f'display:flex;align-items:center;justify-content:center;color:#fff;font-weight:500;font-size:{40 * s}px">{name[0]}</div>')
    return (f'<div style="position:relative;height:{150 * s}px;border-bottom:1px solid {LINE};background:rgba(249,249,249,.94)">'
            f'<div style="position:absolute;left:{26 * s}px;top:{36 * s}px;display:flex;align-items:center;gap:{8 * s}px;color:{BLUE};font-size:{34 * s}px">{chev}'
            f'<div style="background:{BLUE};color:#fff;border-radius:999px;font-size:{24 * s}px;font-weight:600;padding:{2 * s}px {12 * s}px">2</div></div>'
            f'<div style="position:absolute;left:0;right:0;top:{6 * s}px;display:flex;flex-direction:column;align-items:center;gap:{6 * s}px">{avatar}'
            f'<div style="font-size:{22 * s}px;color:{INK}">{name} <span style="color:{META}">›</span></div></div>'
            f'<svg style="position:absolute;right:{36 * s}px;top:{50 * s}px" width="{50 * s}" height="{34 * s}" viewBox="0 0 30 20"><rect x="1" y="2" width="19" height="16" rx="4" fill="none" stroke="{BLUE}" stroke-width="2"/><path d="M21 8l7-4v12l-7-4z" fill="none" stroke="{BLUE}" stroke-width="2" stroke-linejoin="round"/></svg></div>')


def bubble(kind, text, s, last_in_run, gap=6):
    out = kind == 'out'
    bg, fg = (BLUE, '#fff') if out else (GREY, INK)
    side = 'flex-end' if out else 'flex-start'
    tail = ''
    if last_in_run:
        if out:
            tail = (f'<svg style="position:absolute;right:{-7 * s}px;bottom:0" width="{22 * s}" height="{30 * s}" viewBox="0 0 22 30">'
                    f'<path d="M0 0v18c0 6 4 10 8 12 4 1 9 0 14-2-6-2-9-7-9-14V0z" fill="{BLUE}"/></svg>')
        else:
            tail = (f'<svg style="position:absolute;left:{-7 * s}px;bottom:0" width="{22 * s}" height="{30 * s}" viewBox="0 0 22 30">'
                    f'<path d="M22 0v18c0 6-4 10-8 12-4 1-9 0-14-2 6-2 9-7 9-14V0z" fill="{GREY}"/></svg>')
    return (f'<div style="display:flex;justify-content:{side};margin-top:{gap * s}px">'
            f'<div style="position:relative;max-width:{700 * s}px;background:{bg};color:{fg};font-size:{36 * s}px;line-height:1.28;'
            f'padding:{16 * s}px {28 * s}px;border-radius:{40 * s}px">{html.escape(text)}{tail}</div></div>')


def link_card(s, gap=8):
    img = 'assets/photos/crops/lp-link-2x1.jpg'
    return (f'<div style="display:flex;justify-content:flex-start;margin-top:{gap * s}px"><div style="width:{600 * s}px;border-radius:{36 * s}px;overflow:hidden;background:{GREY}">'
            f'<div style="height:{300 * s}px;overflow:hidden"><img src="{img}" style="width:100%;height:100%;object-fit:cover;display:block"></div>'
            f'<div style="padding:{18 * s}px {26 * s}px {20 * s}px"><div style="font-size:{29 * s}px;font-weight:600;line-height:1.25;color:{INK}">First Time Pass · 6 classes for £60 | Studio Glide Oxted</div>'
            f'<div style="font-size:{25 * s}px;color:{META};margin-top:{4 * s}px">lp.studioglidepilates.com</div></div></div></div>')


def input_bar(s):
    return (f'<div style="display:flex;align-items:center;gap:{18 * s}px;padding:{18 * s}px {26 * s}px">'
            f'<div style="width:{64 * s}px;height:{64 * s}px;border-radius:50%;background:{GREY};display:flex;align-items:center;justify-content:center;color:{META};font-size:{46 * s}px;font-weight:300;line-height:1">+</div>'
            f'<div style="flex:1;height:{66 * s}px;border:1px solid {LINE};border-radius:999px;display:flex;align-items:center;justify-content:space-between;padding:0 {26 * s}px;color:{META};font-size:{32 * s}px">iMessage'
            f'<svg width="{26 * s}" height="{38 * s}" viewBox="0 0 14 21"><rect x="3.5" y="1" width="7" height="12" rx="3.5" fill="{META}"/><path d="M1 10a6 6 0 0 0 12 0M7 16v4" stroke="{META}" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg></div></div>')


def board(v, H):
    tall = H > 1080
    s = 1.0 if tall else .9
    x = 80 + v['col'] * 1160
    msgs = v['thread'] + v.get('tall_extra', []) if tall else [m for m in v['thread'] if m[0] != 'link']  # square has no room for the link preview
    body = f'<div style="text-align:center;color:{META};font-size:{24 * s}px;margin:{26 * s}px 0 {14 * s}px"><b style="font-weight:600">Today</b> {v["time"]}</div>'
    prev = None
    for i, (k, t) in enumerate(msgs):
        nxt = msgs[i + 1][0] if i + 1 < len(msgs) else None
        who = 'in' if k == 'link' else k
        gap = 0 if prev is None else (8 if prev == who else 26)
        prev = who
        if k == 'link':
            body += link_card(s, gap)
            continue
        same = nxt == k or (k == 'in' and nxt == 'link')
        body += bubble(k, t, s, not same, gap)
    last_out = [m for m in msgs if m[0] != 'link'][-1][0] == 'out'
    if last_out:
        body += f'<div style="text-align:right;color:{META};font-size:{22 * s}px;margin-top:{8 * s}px;padding-right:{8 * s}px">{"Read " + v["read"] if not tall else "Delivered"}</div>'
    return (f'<div class="board" style="left:{x}px;top:{80 if not tall else 2560}px;width:1080px;height:{H}px;background:#fff;display:flex;flex-direction:column;font-family:Inter,sans-serif;color:{INK}">'
            f'<div>{status_bar(s, v['read'])}{header(s, v["name"])}</div>'
            f'<div style="flex:1;padding:0 {30 * s}px;display:flex;flex-direction:column;justify-content:flex-end;padding-bottom:{14 * s}px;overflow:hidden">{body}</div>'
            f'{input_bar(s)}</div>')


def card(v):
    rows = [('Primary text', v['primary']), ('Headline', v['headline']), ('Description · CTA', 'First Time Pass: 6 classes for £60 · Sign Up')]
    body = ''.join(f'<div class="k">{k}</div><div class="{"p" if k == "Primary text" else "v"}">{html.escape(t).replace(chr(10), "<br>")}</div>' for k, t in rows)
    return (f'<div class="card" style="left:{80 + v["col"] * 1160}px;top:1240px"><div class="t">{v["code"]} · {html.escape(v["title"])}</div>'
            f'<div class="f" style="background:#1C1B19">iMessage style · Offer: First Time Pass, 6 classes for £60</div>{body}</div>')


from imessage_variants import VARIANTS  # noqa: E402  (threads + copy live in their own file)

css = mig.CSS + '.board{position:absolute;overflow:hidden}'
page = f'''<!doctype html><html><head><meta charset="utf-8"><title>Studio Glide · iMessage chats</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Playfair+Display:ital@0;1&family=Lato:wght@400;700&display=swap" rel="stylesheet">
<script src="https://mcp.figma.com/mcp/html-to-design/capture.js" async></script>
<style>{css}</style></head><body><div class="canvas" style="width:{80 + (max(v["col"] for v in VARIANTS) + 1) * 1160}px;height:4560px">{''.join(board(v, 1080) + card(v) + board(v, 1920) for v in VARIANTS)}</div></body></html>'''
(HERE / 'imessage.html').write_text(page)
print('imessage.html')
