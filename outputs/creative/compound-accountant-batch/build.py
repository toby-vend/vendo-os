"""Build the Compound accountant batch (RiskSave review, 6 Oct 2026) from the Claude Design sources.

1. Render src/cq-series.dc.html and src/l-series.dc.html with the dc runtime in headless Chrome (--dump-dom).
2. Lift every artboard (div id="p-...") out of the rendered DOM.
3. Write harness.html (one row per concept, four ratios side by side) for the Figma capture,
   and render one QA PNG per artboard into qa/.

Run from anywhere:  python3 outputs/creative/compound-accountant-batch/build.py [--no-png]
"""
import http.server
import re
import subprocess
import sys
import threading
from functools import partial
from pathlib import Path

HERE = Path(__file__).resolve().parent
SRC = HERE / "src"
QA = HERE / "qa"
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
PORT = 8765

FONTS = ('<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800;900'
         '&family=Archivo+Black&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">')
RATIOS = [("45", "Portrait 4x5", 1080, 1350), ("11", "Square 1x1", 1080, 1080),
          ("916", "Story 9x16", 1080, 1920), ("191", "Landscape 1.91x1", 1200, 628)]

# Ref, file slug, concept name, status after the 8 Oct amends
CONCEPTS = [
    ("CQ-01", "cq-01", "Accountants · 20+ Clients on Nest", "Amended · CTA now See how it works"),
    ("CQ-02", "cq-02", "Accountants · 50+ Payroll Clients", "Approved"),
    ("CQ-03", "cq-03", "Accountants · Default Pension Scheme", "Approved"),
    ("CQ-04", "cq-04", "Practice Owners · No Pension Partner", "Approved"),
    ("CQ-05", "cq-05", "Accountants · Inherited Auto Enrolment", "Approved"),
    ("CQ-06", "cq-06", "Accountants · Four Pension Providers", "Approved"),
    ("CQ-07", "cq-07", "Accountants · The Pension Questions", "Approved"),
    ("CQ-08", "cq-08", "Payroll Bureaus · 50+ Client Companies", "Approved"),
    ("CQ-09", "cq-09", "Payroll Bureaus · Five Pension Portals", "Approved"),
    ("CQ-10", "cq-10", "Payroll Bureaus · Uploading by Hand", "Approved"),
    ("CQ-11", "cq-11", "Payroll Bureaus · 500+ Payslips a Month", "Approved"),
    ("CQ-12", "cq-12", "Payroll Bureaus · 20+ Clients on Nest", "Amended · CTA now See how it works"),
    ("L-01", "l-01", "Set Up in 2019", "Amended · illustrative card, full risk warning"),
    ("L-02", "l-02", "Same Sitting as Payroll", "Amended · one-hour claim removed"),
    ("L-03", "l-03", "Less Pension Admin", "Amended · one-hour claim removed"),
    ("L-04", "l-04", "You Never Chose It", "Approved"),
    ("L-05", "l-05", "Your Name Is On It", "Approved"),
]


def serve():
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a):
            pass
    handler = partial(Quiet, directory=str(SRC))
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


def chrome(*args):
    subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", *args],
                   check=True, capture_output=True, timeout=120)


def dump(name):
    out = subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--window-size=1600,2000",
                          "--virtual-time-budget=20000", "--dump-dom", f"http://127.0.0.1:{PORT}/{name}"],
                         check=True, capture_output=True, text=True, timeout=120)
    return out.stdout


def lift(dom):
    """Return {id: outerHTML} for every artboard div id="p-..."."""
    boards = {}
    for m in re.finditer(r'<div[^>]*?\bid="(p-[a-z0-9-]+)"', dom):
        depth, i = 0, m.start()
        for t in re.finditer(r"<div\b|</div>", dom[m.start():]):
            depth += 1 if t.group(0) == "<div" else -1
            if depth == 0:
                i = m.start() + t.end()
                break
        boards[m.group(1)] = dom[m.start():i]
    return boards


def main():
    srv = serve()
    boards = {}
    for name in ("cq-series.dc.html", "l-series.dc.html"):
        boards.update(lift(dump(name)))

    expected = [f"p-{slug}-{k}" for _, slug, _, _ in CONCEPTS for k, *_ in RATIOS]
    missing = [b for b in expected if b not in boards]
    if missing:
        sys.exit(f"Missing artboards: {missing}")

    rows = []
    for ref, slug, name, status in CONCEPTS:
        cells = "".join(
            f'<div class="cell"><div class="lbl">{ref} · {label} · {w}×{h}</div>'
            f'{boards[f"p-{slug}-{k}"]}</div>' for k, label, w, h in RATIOS)
        rows.append(f'<div class="row"><div class="head"><b>{ref}</b> {name}<span>{status}</span></div>'
                    f'<div class="cells">{cells}</div></div>')

    css = ("body{margin:0;background:#E9E6EE;font-family:'Archivo',sans-serif;color:#0E0716;-webkit-font-smoothing:antialiased}"
           ".wrap{padding:80px;display:flex;flex-direction:column;gap:120px}"
           ".row{display:flex;flex-direction:column;gap:24px}"
           ".head{font-family:'Archivo Black',sans-serif;font-size:40px;letter-spacing:-0.02em;display:flex;gap:20px;align-items:baseline}"
           ".head b{font-family:'JetBrains Mono',monospace;color:#A400B5;font-weight:500}"
           ".head span{font-family:'Archivo',sans-serif;font-size:22px;font-weight:600;color:#4F4858}"
           ".cells{display:flex;gap:80px;align-items:flex-start}"
           ".cell{display:flex;flex-direction:column;gap:12px;flex-shrink:0}"
           ".lbl{font-family:'JetBrains Mono',monospace;font-size:18px;color:#4F4858}")
    head = (f'<!DOCTYPE html><html lang="en-GB"><head><meta charset="utf-8"><title>Compound Accountant Batch</title>'
            f'{FONTS}<style>{css}</style>'
            '<script src="https://mcp.figma.com/mcp/html-to-design/capture.js" async></script></head>')
    (SRC / "harness.html").write_text(head + '<body><div class="wrap">' + "".join(rows) + "</div></body></html>")
    print(f"harness.html: {len(expected)} artboards")

    if "--no-png" in sys.argv:
        return
    QA.mkdir(exist_ok=True)
    for bid in expected:
        k = bid.rsplit("-", 1)[1]
        _, _, w, h = next(r for r in RATIOS if r[0] == k)
        page = SRC / f"_qa-{bid}.html"
        page.write_text(f'<!DOCTYPE html><html><head><meta charset="utf-8">{FONTS}'
                        "<style>body{margin:0;font-family:'Archivo',sans-serif;-webkit-font-smoothing:antialiased}</style>"
                        f'</head><body>{boards[bid]}</body></html>')
        chrome(f"--window-size={w},{h}", "--virtual-time-budget=8000",
               f"--screenshot={QA / (bid + '.png')}", f"http://127.0.0.1:{PORT}/{page.name}")
        page.unlink()
    print(f"qa/: {len(expected)} PNGs")


if __name__ == "__main__":
    main()
