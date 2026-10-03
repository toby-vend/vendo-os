#!/usr/bin/env python3
"""
Compose a HyperFrames talking-head edit from a job folder.

    python3 tools/video-edit/compose.py <job_dir>

Reads   <job_dir>/edit.json   the edit plan (cards, full-screen text, camera moves, end card)
        <job_dir>/words.json  word timings on the trimmed timeline [{text, start, end}]
        tools/video-edit/brands/<brand>/brand.json
Writes  <job_dir>/public/index.html  plus staged fonts, logos, GSAP, SFX and grain.
        (<job_dir>/public/input-video.mp4 comes from prep.py.)

This is the approved v3 recipe (Max's vox pop episode, 3 Oct 2026) turned into a
composer: the AI only writes edit.json, so every edit gets the same look and motion.
See EDIT_SPEC.md for every field.
"""
import html
import json
import shutil
import sys
from pathlib import Path

TOOL = Path(__file__).resolve().parent


def esc(s):
    return html.escape(str(s), quote=False)


def load(job):
    spec = json.loads((job / "edit.json").read_text())
    words = json.loads((job / "words.json").read_text())
    brand_dir = TOOL / "brands" / spec.get("brand", "vendo")
    brand = json.loads((brand_dir / "brand.json").read_text())
    return spec, words, brand, brand_dir


def stage_assets(job, brand, brand_dir):
    pub = job / "public"
    for sub in ("fonts", "assets/logo", "assets/sfx", "vendor"):
        (pub / sub).mkdir(parents=True, exist_ok=True)
    for f in brand["fonts"]:
        shutil.copy2(brand_dir / "fonts" / f["file"], pub / "fonts" / f["file"])
    for key in ("mark", "logo"):
        src = brand_dir / brand[key]
        shutil.copy2(src, pub / "assets/logo" / src.name)
    for wav in (TOOL / "shared/sfx").glob("*.wav"):
        shutil.copy2(wav, pub / "assets/sfx" / wav.name)
    shutil.copy2(TOOL / "shared/gsap.min.js", pub / "vendor/gsap.min.js")
    shutil.copy2(TOOL / "shared/grain.png", pub / "assets/grain.png")


def caption_groups(words, max_words=3, gap=0.35):
    """Group words into 1-3 word captions, breaking at punctuation or pauses; keep one-word tails with the previous group."""
    groups, cur = [], []
    for i, w in enumerate(words):
        cur.append(w)
        nxt = words[i + 1] if i + 1 < len(words) else None
        if len(cur) == max_words or w["text"][-1:] in ".,?!" or not nxt or nxt["start"] - w["end"] > gap:
            groups.append(cur)
            cur = []
    merged = []
    for g in groups:
        if merged and len(g) == 1 and len(merged[-1]) < 4:
            merged[-1] = merged[-1] + g
        else:
            merged.append(g)
    return merged


def main(job):
    spec, words, brand, brand_dir = load(job)
    stage_assets(job, brand, brand_dir)

    C = brand["colors"]
    DUR = float(spec["duration"])
    FPS = int(spec.get("fps", 25))
    W, H = int(spec.get("width", 1080)), int(spec.get("height", 1920))
    FX, FY = spec.get("focus", [W // 2, int(H * 0.43)])
    CARD_TOP = spec.get("card_top", 200)
    CAP_TOP = spec.get("caption_top", 1300)
    q = lambda s: round(round(float(s) * FPS) / FPS, 4)
    mark = f'assets/logo/{Path(brand["mark"]).name}'
    logo = f'assets/logo/{Path(brand["logo"]).name}'

    html_parts, js, sfx = [], [], []
    cap_off = []

    # ---------------- cards (top band) ----------------
    TICK = (f'<svg width="26" height="26" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" '
            f'stroke="{C["on_accent"]}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>')
    PIN = (f'<svg width="50" height="62" viewBox="0 0 24 30"><path d="M12 29s10-10.2 10-17A10 10 0 0 0 2 12c0 6.8 10 17 10 17z" '
           f'fill="{C["accent"]}"/><circle cx="12" cy="12" r="4" fill="{C["raised"]}"/></svg>')
    for n, card in enumerate(spec.get("cards", []), 1):
        cid = f"c{n}"
        kicker = f'<div class="kicker"><img src="{mark}" alt="" />{esc(card.get("kicker", "").upper())}</div>'
        body = ""
        kind = card["type"]
        if kind == "title":
            body = f'<div class="title" id="{cid}-t" style="font-size:{card.get("size", 70)}px">{card["title_html"]}</div>'
            js.append(f'tl.fromTo("#{cid}-t", {{ opacity: 0, x: -20 }}, {{ opacity: 1, x: 0, duration: 0.4, ease: E }}, {q(card.get("title_at", card["start"] + 0.1))});')
        elif kind == "location":
            chars = "".join(f'<span class="ch">{esc(c) if c != " " else "&nbsp;"}</span>' for c in card["text"])
            body = f'<div class="title place" style="font-size:{card.get("size", 70)}px">{PIN}<span id="{cid}-typed">{chars}</span></div>'
            js.append(f'tl.fromTo("#{cid}-typed .ch", {{ opacity: 0 }}, {{ opacity: 1, duration: 0.01, stagger: 0.045, ease: "none" }}, {q(card.get("type_at", card["start"] + 0.2))});')
        elif kind == "checklist":
            rows = []
            for k, item in enumerate(card["items"]):
                rows.append(f'<div class="row"><div class="slot"><div class="tick" id="{cid}-t{k}">{TICK}</div></div><div class="rt" id="{cid}-r{k}">{esc(item["text"])}</div></div>')
                js.append(f'tl.fromTo("#{cid}-t{k}", {{ opacity: 0, scale: 0.6 }}, {{ opacity: 1, scale: 1, duration: 0.3, ease: E }}, {q(item["at"])});')
                js.append(f'tl.fromTo("#{cid}-r{k}", {{ opacity: 0, x: -18 }}, {{ opacity: 1, x: 0, duration: 0.4, ease: E }}, {q(item["at"])});')
                sfx.append(("tick", item["at"], 0.09, 0.4))
            body = "".join(rows)
        elif kind == "bar":
            body = (f'<div class="title" style="font-size:{card.get("size", 64)}px">{card["title_html"]}</div>'
                    f'<div class="track"><div class="bar" id="{cid}-bar"></div></div>')
            fill_at, fill_dur = card.get("fill_at", card["start"] + 0.5), card.get("fill_dur", 1.8)
            js.append(f'tl.fromTo("#{cid}-bar", {{ scaleX: 0 }}, {{ scaleX: {card.get("fill_to", 1)}, duration: {fill_dur}, ease: "power1.inOut" }}, {q(fill_at)});')
            sfx.append(("fill", fill_at, 1.4, 0.28))
        elif kind == "clock":
            # A clock fast-forwarding: minute hand spins once per hour, hour hand 30deg per hour, counter ticks up.
            hours = card.get("hours", 24)
            spin_at, spin_dur = card.get("spin_at", card["start"] + 0.5), card.get("spin_dur", 2.2)
            ticks = "".join(f'<line x1="60" y1="8" x2="60" y2="{18 if k % 3 == 0 else 14}" stroke="{C["muted"]}" stroke-width="{4 if k % 3 == 0 else 2}" '
                            f'stroke-linecap="round" transform="rotate({k * 30} 60 60)"/>' for k in range(12))
            face = (f'<svg class="clockface" width="150" height="150" viewBox="0 0 120 120"><circle cx="60" cy="60" r="56" fill="{C["raised"]}" stroke="{C["accent"]}" stroke-width="3"/>{ticks}'
                    f'<line id="{cid}-hr" x1="60" y1="60" x2="60" y2="32" stroke="{C["text"]}" stroke-width="6" stroke-linecap="round"/>'
                    f'<line id="{cid}-mn" x1="60" y1="60" x2="60" y2="16" stroke="{C["accent"]}" stroke-width="4" stroke-linecap="round"/>'
                    f'<circle cx="60" cy="60" r="5" fill="{C["accent"]}"/></svg>')
            body = (f'<div class="clockrow">{face}<div><div class="title" style="font-size:{card.get("size", 60)}px;margin-top:0">{card["title_html"]}</div>'
                    f'<div class="clockcount"><span id="{cid}-n">0</span> {esc(card.get("unit", "hours"))}</div></div></div>')
            js.append(f'tl.fromTo("#{cid}-mn", {{ rotation: 0, svgOrigin: "60 60" }}, {{ rotation: {360 * hours}, svgOrigin: "60 60", duration: {spin_dur}, ease: "power2.inOut" }}, {q(spin_at)});')
            js.append(f'tl.fromTo("#{cid}-hr", {{ rotation: 0, svgOrigin: "60 60" }}, {{ rotation: {30 * hours}, svgOrigin: "60 60", duration: {spin_dur}, ease: "power2.inOut" }}, {q(spin_at)});')
            js.append(f'(function () {{ const o = {{ v: 0 }}, el = document.querySelector("#{cid}-n"); '
                      f'tl.fromTo(o, {{ v: 0 }}, {{ v: {hours}, duration: {spin_dur}, ease: "power2.inOut", onUpdate: function () {{ if (el) el.textContent = String(Math.round(o.v)); }} }}, {q(spin_at)}); }})();')
            sfx.append(("fill", spin_at, 1.4, 0.28))
        elif kind == "question":
            # A patient's question as a message bubble that types itself out.
            chars = "".join(f'<span class="ch">{esc(c) if c != " " else "&nbsp;"}</span>' for c in card["text"])
            who = esc(card.get("from", "Patient"))
            body = (f'<div class="msg"><div class="msg-who">{who}</div><div class="bubble" id="{cid}-b"><span id="{cid}-typed">{chars}</span></div></div>')
            at = card.get("type_at", card["start"] + 0.3)
            js.append(f'tl.fromTo("#{cid}-b", {{ opacity: 0, scale: 0.9, y: 10 }}, {{ opacity: 1, scale: 1, y: 0, duration: 0.35, ease: E }}, {q(at - 0.15)});')
            js.append(f'tl.fromTo("#{cid}-typed .ch", {{ opacity: 0 }}, {{ opacity: 1, duration: 0.01, stagger: {card.get("stagger", 0.035)}, ease: "none" }}, {q(at)});')
        else:
            raise SystemExit(f"unknown card type: {kind}")
        style = f' style="top:{int(card["y"])}px"' if "y" in card else ""
        html_parts.append(f'<div class="vcard" id="{cid}"{style}>{kicker}{body}</div>')
        js.append(f'card("#{cid}", {q(card["start"])}, {q(card["end"])});')

    # ---------------- full-screen text ----------------
    screens_html = []
    for n, s in enumerate(spec.get("screens", []), 1):
        sid = f"s{n}"
        start, end = q(s["start"]), q(s["end"])
        cap_off.append((start, end))
        inner = []
        if s["style"] == "kinetic":
            for b, beat in enumerate(s["beats"]):
                lines = []
                for k, line in enumerate(beat["lines"]):
                    lid = f"{sid}-b{b}l{k}"
                    color = f';color:{C["accent"]}' if line.get("accent") else ""
                    lines.append(f'<div class="kin" id="{lid}" style="font-size:{line.get("size", 128)}px{color}">{esc(line["text"])}</div>')
                    at = q(line["at"])
                    move = ("{ opacity: 0, scale: 1.3 }", "{ opacity: 1, scale: 1, duration: 0.3, ease: \"power4.out\" }") if line.get("accent") else \
                           ("{ opacity: 0, scaleY: 0.2 }", "{ opacity: 1, scaleY: 1, duration: 0.3, ease: \"power4.out\" }") if k % 2 == 0 else \
                           ("{ opacity: 0, x: -220 }", "{ opacity: 1, x: 0, duration: 0.3, ease: \"power4.out\" }")
                    js.append(f'tl.fromTo("#{lid}", {move[0]}, {move[1]}, {at});')
                    if line.get("accent"):
                        sfx.append(("snap", line["at"], 0.16, 0.35))
                inner.append(f'<div class="stack" id="{sid}-b{b}">{"".join(lines)}</div>')
                if beat.get("exit_at"):
                    js.append(f'tl.fromTo("#{sid}-b{b}", {{ opacity: 1, y: 0 }}, {{ opacity: 0, y: -70, duration: 0.18, ease: "power2.in", immediateRender: false }}, {q(beat["exit_at"])});')
        elif s["style"] == "statement":
            lines = []
            for k, line in enumerate(s["lines"]):
                lid = f"{sid}-l{k}"
                cls = "ser it" if line.get("accent") else "ser"
                lines.append(f'<div class="{cls}" id="{lid}" style="font-size:{line.get("size", 150)}px">{esc(line["text"])}</div>')
                js.append(f'blurIn("#{lid}", {q(line["at"])}, {line.get("dur", 0.7)});')
            if s.get("sub"):
                lines.append(f'<div class="fs-sub" id="{sid}-sub">{esc(s["sub"]["text"].upper())}</div>')
                js.append(f'tl.fromTo("#{sid}-sub", {{ opacity: 0, y: 14 }}, {{ opacity: 1, y: 0, duration: 0.5, ease: E }}, {q(s["sub"]["at"])});')
            inner.append(f'<div class="stack">{"".join(lines)}</div>')
        else:
            raise SystemExit(f'unknown screen style: {s["style"]}')
        screens_html.append(f'<div class="fs clip" id="{sid}" data-start="{start}" data-duration="{round(end - start, 4)}" data-track-index="4">'
                            f'<div class="grain" style="opacity:{brand["grain"]["screens"]}"></div>{"".join(inner)}</div>')
        js.append(f'fsIn("#{sid}", {start});')
        js.append(f'fsOut("#{sid}", {round(end - 0.35, 4)});')

    def covered(t):
        return any(q(s["start"]) <= t - 0.3 and q(s["end"]) > t for s in spec.get("screens", []))

    # ---------------- camera (footage wrapper) ----------------
    state = {"scale": 1, "y": 0, "borderRadius": 0}
    reframe_html = ""

    def cam(to, t, d, ease):
        frm = dict(state)
        state.update(to)
        js.append(f'vw({json.dumps(frm)}, {json.dumps(dict(state))}, {q(t)}, {d}, "{ease}");')

    for ev in sorted(spec.get("camera", []), key=lambda e: e["at"]):
        kind = ev["type"]
        if kind == "punch":
            cam({"scale": ev.get("scale", 1.12)}, ev["at"], 0.3, "power3.out")
            cam({"scale": 1}, ev["out"], 0.04, "none")
        elif kind == "push":
            cam({"scale": ev.get("scale", 1.07)}, ev["at"], ev.get("dur", 0.6), "power3.inOut" if ev.get("dur", 0.6) <= 1 else "sine.inOut")
        elif kind == "reset":
            cam({"scale": 1}, ev["at"], ev.get("dur", 0.04), "none" if ev.get("dur", 0.04) < 0.1 else "power3.inOut")
        elif kind == "reframe":
            cap_off.append((q(ev["at"]) - 0.05, q(ev["until"])))
            S, DY = 0.52, 150
            cam({"scale": S, "y": DY, "borderRadius": 70}, ev["at"], 0.8, "power3.inOut")
            # Where the shrunk footage lands (scale around the focus point, then shifted down by DY).
            bx, by = FX - FX * S, FY - FY * S + DY
            bw, bh = W * S, H * S
            fr = ev.get("frame", {})
            overlay = fr.get("cta_overlay", False)
            avatar = '<div class="av"></div>'
            if fr.get("logo"):
                src = job / fr["logo"]
                shutil.copy2(src, job / "public/assets" / f"frame-logo{src.suffix}")
                avatar = f'<div class="av av-logo"><img src="assets/frame-logo{src.suffix}" alt="" /></div>'
            cta = f'<span>{esc(fr.get("cta", "Learn more"))}</span><span>&rsaquo;</span>'
            fy0, fh = by - 82, bh + 82 + (24 if overlay else 90)
            reframe_html = (f'<div id="adframe" style="left:{bx - 12:.0f}px;top:{fy0:.0f}px;width:{bw + 24:.0f}px;height:{fh:.0f}px">'
                            f'<div class="hd">{avatar}<div><div class="nm">{esc(fr.get("name", "Your practice"))}</div><div class="sp">Sponsored</div></div></div>'
                            + ("" if overlay else f'<div class="ft">{cta}</div>') + '</div>'
                            + (f'<div id="rf-cta" class="ft" style="left:{bx + 24:.0f}px;top:{by + bh - 86:.0f}px;width:{bw - 48:.0f}px">{cta}</div>' if overlay else "")
                            + f'<div id="rf-h">{ev.get("headline_html", "")}</div>')
            parts = ["#adframe", "#rf-h"] + (["#rf-cta"] if overlay else [])
            js.append(f'tl.fromTo("#adframe", {{ opacity: 0, scale: 0.96 }}, {{ opacity: 1, scale: 1, duration: 0.5, ease: E }}, {q(ev["at"] + 0.4)});')
            if overlay:
                js.append(f'tl.fromTo("#rf-cta", {{ opacity: 0, y: 24 }}, {{ opacity: 1, y: 0, duration: 0.45, ease: E }}, {q(ev["at"] + 0.9)});')
            js.append(f'tl.fromTo("#rf-h", {{ opacity: 0, y: 30 }}, {{ opacity: 1, y: 0, duration: 0.5, ease: E }}, {q(ev.get("headline_at", ev["at"] + 1.3))});')
            if covered(ev["until"]):
                js.append(f'tl.set({json.dumps(parts)}, {{ opacity: 0 }}, {q(ev["until"])});')
                cam({"scale": 1, "y": 0, "borderRadius": 0}, ev["until"], 0.04, "none")
            else:
                js.append(f'tl.to({json.dumps(parts)}, {{ opacity: 0, duration: 0.3 }}, {q(ev["until"])});')
                cam({"scale": 1, "y": 0, "borderRadius": 0}, ev["until"], 0.7, "power3.inOut")
        else:
            raise SystemExit(f"unknown camera event: {kind}")

    # ---------------- end card over blurred footage ----------------
    end_html = ""
    if spec.get("end"):
        e = spec["end"]
        cap_off.append((q(e["at"]), DUR))
        frm = dict(state)
        frm["filter"] = "blur(0px) brightness(1)"
        if e.get("style") == "fade_black":
            # Footage fades fully to black as the speaker finishes; the closing line and logo sit on black.
            to = dict(state, filter="blur(0px) brightness(0)")
            js.append(f'vw({json.dumps(frm)}, {json.dumps(to)}, {q(e["at"])}, {e.get("fade", 0.9)}, "power2.inOut");')
        else:
            to = dict(state, scale=round(state["scale"] + 0.05, 3), filter="blur(18px) brightness(0.38)")
            js.append(f'vw({json.dumps(frm)}, {json.dumps(to)}, {q(e["at"])}, 0.9, "power3.inOut");')
        lines = []
        for k, line in enumerate(e["lines"]):
            cls = "ser it" if line.get("accent") else "ser"
            lines.append(f'<div class="{cls}" id="e{k}" style="font-size:{line.get("size", 150)}px">{esc(line["text"])}</div>')
            js.append(f'blurIn("#e{k}", {q(line["at"])}, {0.8 if line.get("accent") else 0.7});')
        if e.get("sub"):
            lines.append(f'<div class="fs-sub" id="e-sub">{esc(e["sub"]["text"].upper())}</div>')
            js.append(f'tl.fromTo("#e-sub", {{ opacity: 0, y: 14 }}, {{ opacity: 1, y: 0, duration: 0.5, ease: E }}, {q(e["sub"]["at"])});')
        if e.get("logo_at") is not None:
            lines.append(f'<img id="end-logo" src="{logo}" alt="" />')
            js.append(f'tl.fromTo("#end-logo", {{ opacity: 0, y: 16 }}, {{ opacity: 1, y: 0, duration: 0.55, ease: E }}, {q(e["logo_at"])});')
            sfx.append(("chime", e["logo_at"], 0.95, 0.35))
        end_html = f'<div id="endtx">{"".join(lines)}</div>'

    # ---------------- B-roll cutaways (cover the speaker; his audio carries on) ----------------
    # Each clip is pre-rendered by `prep.py broll` into public/ at 1080x1920, graded, silent.
    broll_html = []
    for n, b in enumerate(spec.get("broll", []), 1):
        bid = f"br{n}"
        start, end = q(b["start"]), q(b["end"])
        broll_html.append(f'<div class="broll" id="{bid}"><video id="{bid}-v" src="{esc(b["src"])}" muted playsinline '
                          f'data-start="{start}" data-duration="{round(end - start, 4)}" data-track-index="{2 + (n % 2)}"></video></div>')
        js.append(f'tl.fromTo("#{bid}", {{ opacity: 0 }}, {{ opacity: 1, duration: {b.get("fade", 0.12)}, ease: "none" }}, {start});')
        js.append(f'tl.fromTo("#{bid}", {{ opacity: 1 }}, {{ opacity: 0, duration: {b.get("fade", 0.12)}, ease: "none", immediateRender: false }}, {round(end - b.get("fade", 0.12), 4)});')

    # ---------------- captions ----------------
    cap_html, cap_js = [], []
    if spec.get("captions", True):
        groups = caption_groups(words)
        for i, g in enumerate(groups):
            ws = "".join(f'<span class="w" id="w{i}-{j}">{esc(x["text"])}</span> ' for j, x in enumerate(g))
            cap_html.append(f'<div class="cap" id="cap{i}">{ws.strip()}</div>')
            start = q(g[0]["start"])
            nxt = groups[i + 1][0]["start"] if i + 1 < len(groups) else DUR
            end = q(min(nxt, g[-1]["end"] + 0.6, DUR))
            cap_js.append(f'cap({i}, {start}, {end}, {json.dumps([q(x["start"]) for x in g])});')
        for a, b in sorted(cap_off):
            js.append(f'tl.fromTo("#caps", {{ opacity: 1 }}, {{ opacity: 0, duration: 0.15, immediateRender: false }}, {a});')
            if b < DUR - 0.05:
                js.append(f'tl.fromTo("#caps", {{ opacity: 0 }}, {{ opacity: 1, duration: 0.15, immediateRender: false }}, {b});')

    # ---------------- sound effects ----------------
    sfx_html = ""
    if spec.get("sfx", True):
        sfx_html = "\n  ".join(
            f'<audio id="sfx{n}" src="assets/sfx/{name}.wav" data-start="{q(t)}" data-duration="{d}" data-track-index="{6 + n}" data-volume="{v}"></audio>'
            for n, (name, t, d, v) in enumerate(sorted(sfx, key=lambda x: x[1])))

    # ---------------- page ----------------
    font_faces = "\n  ".join(
        f'@font-face {{ font-family: "{f["family"]}"; src: url("fonts/{f["file"]}") format("woff2"); '
        f'font-weight: {f.get("weight", "400")}; font-style: {f.get("style", "normal")}; font-display: block; }}'
        for f in brand["fonts"])
    B, FL, K, ST, KI = brand["body"], brand["flourish"], brand["kinetic"], brand["statement"], brand["kicker"]
    R = brand.get("card_radius", 20)
    page = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>
  {font_faces}
  * {{ box-sizing: border-box; }}
  html, body {{ margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: {C["bg"]};
    font-family: "{B["family"]}", "{ST["family"]}", ui-sans-serif, system-ui, sans-serif; }}
  #root {{ position: relative; width: 100%; height: 100%; overflow: hidden; background: {C["bg_gradient"]}; }}
  .grain {{ position: absolute; inset: -64px; background: url("assets/grain.png") repeat; mix-blend-mode: overlay; pointer-events: none; }}
  #vw {{ position: absolute; left: 0; top: 0; width: {W}px; height: {H}px; overflow: hidden; transform-origin: {FX}px {FY}px; z-index: 1; }}
  #base {{ width: 100%; height: 100%; object-fit: cover; display: block; }}
  #adframe {{ position: absolute; left: 247px; top: 462px; width: 586px; height: 1170px; border-radius: 44px; z-index: 0; opacity: 0;
    background: {C["raised"]}; border: 1px solid rgba(255,255,255,0.12); box-shadow: 0 30px 80px rgba(0,0,0,0.5); }}
  #adframe .hd {{ position: absolute; left: 26px; right: 26px; top: 20px; display: flex; align-items: center; gap: 14px; }}
  #adframe .av {{ width: 42px; height: 42px; border-radius: 50%; background: {C["bg"]}; border: 2px solid {C["accent"]}; }}
  #adframe .nm {{ font-size: 22px; font-weight: 800; color: {C["text"]}; }}
  #adframe .sp {{ font-size: 18px; font-weight: 600; color: {C["muted"]}; }}
  #adframe .ft {{ position: absolute; left: 26px; right: 26px; bottom: 22px; display: flex; justify-content: space-between; align-items: center;
    font-size: 24px; font-weight: 800; color: {C["on_accent"]}; background: {C["accent"]}; border-radius: 12px; padding: 12px 20px; }}
  #adframe .av-logo {{ background: #FFFFFF; border: 2px solid {C["accent"]}; display: flex; align-items: center; justify-content: center; overflow: hidden; }}
  #adframe .av-logo img {{ width: 80%; height: 80%; object-fit: contain; }}
  #rf-cta {{ position: absolute; z-index: 3; opacity: 0; display: flex; justify-content: space-between; align-items: center;
    font-size: 26px; font-weight: 800; color: {C["on_accent"]}; background: {C["accent"]}; border-radius: 14px; padding: 16px 24px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.35); }}
  .broll {{ position: absolute; inset: 0; z-index: 1; opacity: 0; overflow: hidden; }}
  .broll video {{ width: 100%; height: 100%; object-fit: cover; display: block; }}
  .clockrow {{ display: flex; align-items: center; gap: 30px; margin-top: 18px; }}
  .clockface {{ flex: none; }}
  .clockcount {{ margin-top: 12px; font-size: 34px; font-weight: 800; color: {C["accent"]}; font-variant-numeric: tabular-nums; }}
  .msg {{ margin-top: 18px; }}
  .msg-who {{ font-size: 20px; font-weight: 700; color: {C["muted"]}; margin: 0 0 10px 6px; }}
  .bubble {{ display: inline-block; max-width: 100%; padding: 22px 30px; border-radius: 30px 30px 30px 8px; background: {C["accent"]};
    color: {C["on_accent"]}; font-size: 46px; font-weight: 800; letter-spacing: -0.02em; line-height: 1.12; }}
  .bubble .ch {{ display: inline-block; }}
  #rf-h {{ position: absolute; left: 90px; right: 90px; top: 250px; text-align: center; z-index: 3; opacity: 0;
    font-size: 78px; font-weight: {B["weight"]}; letter-spacing: -0.03em; color: {C["text"]}; }}
  .vcard {{ position: absolute; left: 140px; width: 800px; top: {CARD_TOP}px; padding: 28px 38px 30px; z-index: 3; opacity: 0;
    background: {C["card"]}; border: 1px solid {C["card_border"]}; border-radius: {R}px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.04); color: {C["text"]}; }}
  .kicker {{ display: flex; align-items: center; gap: 14px; font-size: 20px; font-weight: {KI["weight"]}; letter-spacing: {KI["letter_spacing"]}; color: {C[KI["color"]]}; }}
  .kicker img {{ width: 30px; height: 29px; }}
  .title {{ margin-top: 16px; font-weight: {B["weight"]}; letter-spacing: -0.03em; line-height: 1.04; }}
  em {{ font-family: "{FL["family"]}", serif; font-style: {FL["style"]}; font-weight: {FL["weight"]}; font-size: {FL["scale"]}em;
    text-transform: {FL["transform"]}; letter-spacing: {FL["letter_spacing"]}; color: {C["accent"]}; }}
  .place {{ display: flex; align-items: center; gap: 16px; }}
  .place .ch {{ display: inline-block; }}
  .row {{ display: flex; align-items: center; gap: 20px; margin-top: 18px; font-size: 40px; font-weight: 700; letter-spacing: -0.015em; }}
  .slot {{ position: relative; width: 46px; height: 46px; flex: none; border-radius: 50%; border: 2px solid rgba(255,255,255,0.18); }}
  .tick {{ position: absolute; left: -2px; top: -2px; width: 46px; height: 46px; border-radius: 50%; background: {C["accent"]};
    display: flex; align-items: center; justify-content: center; }}
  .track {{ margin-top: 26px; height: 16px; border-radius: 8px; background: rgba(255,255,255,0.10); overflow: hidden; }}
  .bar {{ height: 16px; width: 724px; border-radius: 8px; background: {C["accent"]}; transform-origin: left center; }}
  #caps {{ position: absolute; inset: 0; z-index: 2; pointer-events: none; }}
  .cap {{ position: absolute; left: 90px; right: 90px; top: {CAP_TOP}px; text-align: center; opacity: 0;
    font-size: 70px; font-weight: {B["weight"]}; letter-spacing: -0.02em; line-height: 1.12; color: {C["text"]};
    text-shadow: 0 4px 20px rgba(0,0,0,0.55), 0 1px 3px rgba(0,0,0,0.6); }}
  .cap .w {{ display: inline-block; }}
  .fs {{ position: absolute; inset: 0; z-index: 5; background: {C["bg_gradient"]}; }}
  .fs .stack {{ position: absolute; left: 70px; right: 70px; top: 0; bottom: 0; display: flex; flex-direction: column;
    align-items: center; justify-content: center; text-align: center; }}
  .kin {{ font-family: "{K["family"]}", sans-serif; font-weight: {K["weight"]}; text-transform: {K["transform"]}; letter-spacing: {K["letter_spacing"]}; line-height: 0.95; color: {C["text"]}; }}
  .ser {{ font-family: "{ST["family"]}", serif; font-weight: {ST["weight"]}; text-transform: {ST["transform"]}; line-height: 1.0; letter-spacing: {ST["letter_spacing"]}; color: {C["text"]}; }}
  .ser.it {{ font-style: {"italic" if ST.get("accent_style") == "italic" else "normal"}; color: {C["accent"]}; }}
  .fs-sub {{ margin-top: 40px; font-family: "{B["family"]}", sans-serif; font-size: 28px; font-weight: 700; letter-spacing: 0.2em; color: {C["soft"]}; }}
  #endtx {{ position: absolute; left: 70px; right: 70px; top: 0; bottom: 0; z-index: 4; display: flex; flex-direction: column;
    align-items: center; justify-content: center; text-align: center; }}
  #end-logo {{ width: {brand.get("logo_width", 380)}px; margin-top: 70px; }}
</style>
</head>
<body>
<div id="root" data-composition-id="edit" data-start="0" data-duration="{DUR}" data-fps="{FPS}" data-width="{W}" data-height="{H}">
  <div class="grain" style="opacity:0.14"></div>
  {reframe_html}
  <div id="vw"><video id="base" src="input-video.mp4" playsinline data-has-audio="true" data-start="0" data-duration="{DUR}" data-track-index="1"></video></div>
  {''.join(broll_html)}
  {''.join(html_parts)}
  <div id="caps">{''.join(cap_html)}</div>
  {end_html}
  {''.join(screens_html)}
  <div class="grain" style="opacity:{brand["grain"]["footage"]};z-index:9"></div>
  {sfx_html}
  <script src="vendor/gsap.min.js"></script>
  <script>
  (function () {{
    const tl = gsap.timeline({{ paused: true }});
    const E = "power3.out";
    const MINT = "{C["accent"]}", WHITE = "{C["text"]}";
    function card(id, tIn, tOut) {{
      tl.fromTo(id, {{ opacity: 0, y: 24 }}, {{ opacity: 1, y: 0, duration: 0.45, ease: E }}, tIn);
      tl.fromTo(id, {{ opacity: 1, y: 0 }}, {{ opacity: 0, y: -12, duration: 0.3, ease: "power2.in", immediateRender: false }}, tOut - 0.3);
    }}
    function cap(i, tIn, tOut, wordTimes) {{
      const el = "#cap" + i;
      tl.fromTo(el, {{ opacity: 0, y: 10 }}, {{ opacity: 1, y: 0, duration: 0.12, ease: E }}, tIn);
      wordTimes.forEach(function (t, j) {{
        tl.fromTo("#w" + i + "-" + j, {{ color: WHITE }}, {{ color: MINT, duration: 0.06 }}, t);
        if (j > 0) tl.to("#w" + i + "-" + (j - 1), {{ color: WHITE, duration: 0.06 }}, t);
      }});
      tl.to(el, {{ opacity: 0, duration: 0.08 }}, Math.max(tIn + 0.2, tOut - 0.08));
    }}
    function fsIn(id, t) {{ tl.fromTo(id, {{ opacity: 0 }}, {{ opacity: 1, duration: 0.4, ease: "power2.out" }}, t); }}
    function fsOut(id, t) {{ tl.fromTo(id, {{ opacity: 1 }}, {{ opacity: 0, duration: 0.35, ease: "power2.in", immediateRender: false }}, t); }}
    function blurIn(sel, t, d) {{ tl.fromTo(sel, {{ opacity: 0, filter: "blur(22px)", y: 20 }}, {{ opacity: 1, filter: "blur(0px)", y: 0, duration: d || 0.7, ease: E }}, t); }}
    function vw(from, to, t, d, ease) {{ tl.fromTo("#vw", from, Object.assign({{ duration: d, ease: ease, immediateRender: false }}, to), t); }}
    tl.set("#vw", {{ scale: 1, x: 0, y: 0, borderRadius: 0, filter: "blur(0px) brightness(1)" }}, 0);
    tl.fromTo(".grain", {{ x: 0, y: 0 }}, {{ x: -61, y: 47, duration: 0.08, ease: "steps(1)", repeat: {int(DUR / 0.08) - 1}, yoyo: true }}, 0);
    {chr(10).join('    ' + s for s in js)}
    {chr(10).join('    ' + s for s in cap_js)}
    window.__timelines["edit"] = tl;
  }})();
  </script>
</div>
</body>
</html>
"""
    (job / "public" / "index.html").write_text(page)
    print(f"composed {job / 'public/index.html'}: {len(spec.get('cards', []))} cards, {len(spec.get('screens', []))} screens, "
          f"{len(spec.get('camera', []))} camera moves, {len(sfx)} sfx")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("usage: compose.py <job_dir>")
    main(Path(sys.argv[1]).resolve())
