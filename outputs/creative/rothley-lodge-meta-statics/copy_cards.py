"""Write copycards-<persona>.html: one white card per concept (headline + primary text) for the Figma copy row."""
import html, json, subprocess, sys

CSS = """@font-face { font-family: Manrope; src: url('assets/fonts/Manrope[wght].ttf'); font-weight: 200 800; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: #e5e5e5; font-family: Manrope, sans-serif; display: flex; gap: 80px; padding: 80px; align-items: stretch; }
.card { width: 1080px; flex: none; background: #fff; border-radius: 16px; padding: 44px 48px 48px; color: #15192C; }
.k { font-size: 18px; font-weight: 500; color: #737580; }
.l { font-size: 14px; font-weight: 600; letter-spacing: .12em; color: #737580; margin-top: 28px; }
.h { font-size: 30px; font-weight: 600; margin-top: 8px; }
.p { font-size: 21px; line-height: 1.5; margin-top: 10px; }
.p + .p { margin-top: 16px; }"""

for key in sys.argv[1:]:
    d = json.loads(subprocess.check_output(["python3", "copy_json.py", f"copy-{key}.md"]))
    cards = "".join(
        f'<div class="card" data-name="Copy | {c["id"]} | {html.escape(c["title"])}"><div class="k">{c["id"]} &middot; {html.escape(c["title"])}</div>'
        f'<div class="l">HEADLINE</div><div class="h">{html.escape(c["headline"])}</div><div class="l">PRIMARY TEXT</div>'
        + "".join(f'<div class="p">{html.escape(p)}</div>' for p in c["primary"].split("\n\n")) + "</div>" for c in d)
    open(f"copycards-{key}.html", "w").write(
        f"<!doctype html><html lang='en-GB'><head><meta charset='utf-8'><title>Rothley | {key} | copy</title><style>{CSS}</style>"
        f"<script src='https://mcp.figma.com/mcp/html-to-design/capture.js' async></script></head><body>{cards}</body></html>")
    print(key, len(d))
