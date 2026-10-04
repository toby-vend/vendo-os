"""Export an AI edit as layers an editor can tweak in Premiere Pro or CapCut.

    python3 tools/video-edit/export_layers.py <job dir> [--out <dir>] [--no-render]

Reads the job's finished composition (public/index.html, from compose.py or a hand-built build script) and writes
<job>/export-vNN/:

    picture.mp4     footage + B-roll with the camera moves (punch-ins, reframe, end blur) baked in, voice audio
    graphics.mov    cards, full-screen text, ad-frame headline, end card and logo on transparent (ProRes 4444), SFX audio
    captions.srt    the captions exactly as shown (text, timing, hidden under full screens)
    timeline.xml    Premiere Pro sequence (File > Import): picture on V1, graphics on V2, audio on A1/A2
    extras/         the clean trimmed footage and each B-roll clip, for rebuilding a section by hand
    README.txt      how to open it in Premiere and in CapCut

Both layers are full length and start at 0:00, so stacking them reproduces the delivered video. The graphics are
pictures, not live text: an editor can move, trim or remove them, not retype them. Captions stay editable (SRT).
"""
import html as htmllib
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

PICTURE_KEEP = (".grain", "#adframe", "#vw", ".broll")  # under the graphics; everything else is graphics


def tc(t):
    ms = int(round(t * 1000))
    return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"


def captions(page, duration):
    """Captions as they appear: text from the cap divs, times from cap(...) calls, hidden windows from #caps fades."""
    texts = {}
    for m in re.finditer(r'<div class="cap[^"]*" id="cap(\d+)">(.*?)</div>', page, re.S):
        words = re.sub(r"<[^>]+>", " ", m.group(2))
        texts[int(m.group(1))] = re.sub(r"\s+", " ", htmllib.unescape(words)).strip()
    times = {int(m.group(1)): (float(m.group(2)), float(m.group(3)))
             for m in re.finditer(r"cap\((\d+),\s*([\d.]+),\s*([\d.]+)", page)}
    offs, ons = [], []
    for m in re.finditer(r'fromTo\("#caps",\s*\{\s*opacity:\s*([01])\s*\}.*?\},\s*([\d.]+)\);', page):
        (offs if m.group(1) == "1" else ons).append(float(m.group(2)))
    windows = []
    for a in sorted(offs):
        b = min([x for x in ons if x > a] or [duration])
        windows.append((a, b))
    out = []
    for i in sorted(times):
        if i not in texts or not texts[i]:
            continue
        s, e = times[i]
        hidden = next(((a, b) for a, b in windows if a <= s + 0.05 < b), None)
        if hidden:
            if e <= hidden[1] + 0.3:
                continue
            s = hidden[1]
        cut = next((a for a, b in windows if s < a < e), None)
        if cut:
            e = cut
        if e - s >= 0.2:
            out.append((s, e, texts[i]))
    return out


def layer_pages(page):
    style_picture = ("<style>#root > *:not(" + "):not(".join(PICTURE_KEEP) + ") { opacity: 0 !important; }"
                     " #caps { opacity: 0 !important; }</style>")
    picture = re.sub(r'<audio id="sfx[^"]*"[^>]*></audio>', "", page)  # voice only
    picture = picture.replace("</head>", style_picture + "</head>", 1)

    style_graphics = ("<style>html, body, #root { background: transparent !important; }"
                      " " + ", ".join(PICTURE_KEEP + ("#caps",)) + " { opacity: 0 !important; }</style>")
    graphics = re.sub(r"<video\b[^>]*>\s*</video>", "", page)  # no footage, no voice: SFX only
    graphics = graphics.replace("</head>", style_graphics + "</head>", 1)
    return picture, graphics


def premiere_xml(name, fps, frames, has_sfx):
    def clip(cid, file_id, fname, kind, track_media):
        media = (f"<media><video><samplecharacteristics><width>1080</width><height>1920</height></samplecharacteristics></video>"
                 f"<audio><channelcount>2</channelcount></audio></media>") if kind == "video" else ""
        return (f'<clipitem id="{cid}"><name>{fname}</name><duration>{frames}</duration>'
                f"<rate><timebase>{fps}</timebase><ntsc>FALSE</ntsc></rate><start>0</start><end>{frames}</end><in>0</in><out>{frames}</out>"
                f'<file id="{file_id}"><name>{fname}</name><pathurl>{fname}</pathurl>'
                f"<rate><timebase>{fps}</timebase><ntsc>FALSE</ntsc></rate><duration>{frames}</duration>{media}</file>"
                f"<sourcetrack><mediatype>{track_media}</mediatype><trackindex>1</trackindex></sourcetrack></clipitem>")
    v1 = clip("v-picture", "f-picture", "picture.mp4", "video", "video")
    v2 = clip("v-graphics", "f-graphics", "graphics.mov", "video", "video")
    a1 = f'<clipitem id="a-picture"><name>picture.mp4</name><duration>{frames}</duration><rate><timebase>{fps}</timebase><ntsc>FALSE</ntsc></rate><start>0</start><end>{frames}</end><in>0</in><out>{frames}</out><file id="f-picture"/><sourcetrack><mediatype>audio</mediatype><trackindex>1</trackindex></sourcetrack></clipitem>'
    a2 = f'<clipitem id="a-graphics"><name>graphics.mov</name><duration>{frames}</duration><rate><timebase>{fps}</timebase><ntsc>FALSE</ntsc></rate><start>0</start><end>{frames}</end><in>0</in><out>{frames}</out><file id="f-graphics"/><sourcetrack><mediatype>audio</mediatype><trackindex>1</trackindex></sourcetrack></clipitem>' if has_sfx else ""
    return (f'<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE xmeml>\n<xmeml version="4"><sequence id="seq">'
            f"<name>{htmllib.escape(name)}</name><duration>{frames}</duration><rate><timebase>{fps}</timebase><ntsc>FALSE</ntsc></rate>"
            f"<media><video><format><samplecharacteristics><rate><timebase>{fps}</timebase><ntsc>FALSE</ntsc></rate>"
            f"<width>1080</width><height>1920</height><pixelaspectratio>square</pixelaspectratio></samplecharacteristics></format>"
            f"<track>{v1}</track><track>{v2}</track></video>"
            f"<audio><track>{a1}</track>{f'<track>{a2}</track>' if a2 else ''}</audio></media></sequence></xmeml>\n")


README = """{name}
Edit pack for small tweaks by hand. Made from the AI edit {version}.

What's here
  picture.mp4    the footage and B-roll with zooms and the end blur already in, plus the voice
  graphics.mov   cards, full-screen text, end card and logo on a transparent background, plus the sound effects
  captions.srt   the captions as shown in the video (editable)
  timeline.xml   a ready-made Premiere Pro sequence
  extras/        the clean trimmed footage and each B-roll clip, if you need to rebuild a section

Both videos are the full length and start at 0:00. Graphics on top of picture = the delivered video.
The graphics are pictures: you can move, trim or delete them, but not retype the words. Fix caption
wording in the captions track. To change the graphics' words, comment in Frame.io and run AI Revision first.

Premiere Pro
  1. Keep all these files in one folder.
  2. File > Import > timeline.xml. If Premiere asks where the media is, point it at this folder (Locate);
     it finds the rest.
  3. File > Import > captions.srt, then drag it onto the sequence above the video tracks.

CapCut
  1. New project, 9:16. Import picture.mp4, graphics.mov and captions.srt.
  2. Put picture.mp4 on the main track at 0:00 and graphics.mov on an overlay track above it, also at 0:00.
  3. Captions: Text > Local captions > import captions.srt.

After hand edits the AI can't revise this video any more, so do AI revisions first and hand polish last.
Export as "{name} | vNN | Internal" with the next version number and put it back on the Frame.io stack.
"""


def main():
    args = sys.argv[1:]
    if not args:
        raise SystemExit(__doc__)
    job = Path(args[0]).expanduser().resolve()
    pub = job / "public"
    page = (pub / "index.html").read_text()
    delivery = json.loads((job / "delivery.json").read_text())
    fps = int(round(json.loads((job / "base.json").read_text())["fps"]))
    duration = float(re.search(r'data-duration="([\d.]+)"', page[page.index('id="root"'):]).group(1))
    version = f"v{delivery['version']:02d}"
    name = re.sub(r"\s*\|\s*\d+s\s*\|\s*v\d+\s*\|.*$", "", delivery["name"])
    out = Path(args[args.index("--out") + 1]).resolve() if "--out" in args else job / f"export-{version}"
    (out / "extras").mkdir(parents=True, exist_ok=True)

    picture, graphics = layer_pages(page)
    (pub / "layer-picture.html").write_text(picture)
    (pub / "layer-graphics.html").write_text(graphics)
    if "--no-render" not in args:
        env_cmd = ["npx", "hyperframes", "render", str(pub), "--fps", str(fps), "--quality", "delivery"]
        subprocess.run(env_cmd + ["-c", "layer-picture.html", "-o", str(out / "picture.mp4")], check=True)
        subprocess.run(env_cmd + ["-c", "layer-graphics.html", "--format", "mov", "-o", str(out / "graphics.mov")], check=True)

    caps = captions(page, duration)
    (out / "captions.srt").write_text("".join(f"{i}\n{tc(s)} --> {tc(e)}\n{t}\n\n" for i, (s, e, t) in enumerate(caps, 1)))
    has_sfx = '<audio id="sfx' in page or "<audio id=\"sfx-" in page
    (out / "timeline.xml").write_text(premiere_xml(f"{name} | {version} | Edit Pack", fps, int(round(duration * fps)), has_sfx))
    base = next((p for p in (pub / "input-video-cut.mp4", pub / "input-video.mp4") if p.exists()), None)
    if base:
        shutil.copy2(base, out / "extras" / "clean-footage.mp4")
    for clip in sorted(set(re.findall(r'<video[^>]+src="([^"]+)"[^>]*muted', page))):
        if (pub / clip).exists():
            dest = out / "extras" / ("broll-" + Path(clip).name.replace("broll-", "").replace("broll/", ""))
            shutil.copy2(pub / clip, dest)
    (out / "README.txt").write_text(README.format(name=name, version=version))
    for f in ("layer-picture.html", "layer-graphics.html"):
        (pub / f).unlink(missing_ok=True)
    print(json.dumps({"out": str(out), "captions": len(caps), "version": version}))


if __name__ == "__main__":
    main()
