"""Builds the new Compound thank-you page from the live page + the 21 Oct Claude Design export.

Only the middle section changes: new headline, lead line, booking card and a
"Prefer not to book now?" fallback carrying the per-audience subhead.
Usage: python3 build_preview.py <live.html>  -> preview-<audience>.html + booking-section.html
"""
import re, sys

BOOKING_URL = "https://calendar.app.google/TGDWbCr58VZ5qugVA"
EASE = "cubic-bezier(.16,1,.3,1)"

AUDIENCES = {
    "employer": ("Request received", "A member of the Compound team will be in touch within one working day to look at your current setup."),
    "accountants": ("Enquiry received", "A member of the Compound team will email you within one working day to walk through how introducing clients works and answer anything on fees or process."),
    "payroll-bureau": ("Enquiry received", "A member of the Compound team will email you within one working day to look at your payroll stack and how Compound would sit alongside it."),
}

SECTION = f"""<h1 style="font-family:'Archivo Black',sans-serif;font-size:clamp(34px,8.6cqw,68px);line-height:1.02;letter-spacing:-0.025em;margin:0;text-wrap:balance;background-image:linear-gradient(100deg,#fff 0%,#fff 38%,#FFE4FB 50%,#fff 62%,#fff 100%);background-size:240% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:tyIn .9s {EASE} .2s both, sheen 9s ease-in-out 1.4s infinite">Thanks. Now book your call.</h1>

      <p style="font-size:clamp(16.5px,4.6cqw,19px);line-height:1.55;font-weight:500;margin:0;max-width:500px;opacity:0.94;animation:tyIn .9s {EASE} .32s both">Skip the back-and-forth. Pick a time that suits you and it goes straight into our calendar.</p>

      <div data-slot="booking" style="width:100%;max-width:520px;box-sizing:border-box;background:#fff;color:#0A0A0A;border-radius:28px;padding:clamp(22px,5cqw,32px);display:flex;flex-direction:column;gap:18px;text-align:left;box-shadow:0 34px 70px -24px rgba(10,10,10,0.55),0 0 0 8px rgba(255,255,255,0.14);margin-top:4px;animation:tyIn .9s {EASE} .44s both">
        <div style="display:flex;align-items:center;gap:14px">
          <div style="width:52px;height:52px;border-radius:16px;background:linear-gradient(135deg,#C400D7,#6C1AF9);display:flex;align-items:center;justify-content:center;flex-shrink:0">
            <svg width="24" height="24" viewBox="0 0 20 20" fill="none" aria-hidden="true"><rect x="3" y="4.5" width="14" height="12" rx="2.5" stroke="#fff" stroke-width="1.8"/><path d="M3 8.5h14M7 2.8v3.4M13 2.8v3.4" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/></svg>
          </div>
          <div style="display:flex;flex-direction:column;gap:3px;min-width:0">
            <div style="font-size:12px;font-weight:800;letter-spacing:0.09em;text-transform:uppercase;color:#C400D7">Your next step</div>
            <div style="font-family:'Archivo Black',sans-serif;font-size:clamp(20px,4.6cqw,24px);letter-spacing:-0.015em;line-height:1.15">Book a 15-minute call</div>
          </div>
        </div>
        <a class="compound-ty-book" href="{BOOKING_URL}" target="_blank" rel="noopener" style="position:relative;display:flex;align-items:center;justify-content:center;gap:12px;background:linear-gradient(135deg,#C400D7,#6C1AF9);color:#fff;text-decoration:none;border-radius:999px;padding:20px 28px;font-family:'Archivo',sans-serif;font-size:clamp(17px,4.4cqw,19px);font-weight:900;letter-spacing:-0.01em;box-shadow:0 18px 36px -14px rgba(196,0,215,0.7);transition:transform .25s {EASE},filter .25s">
          <span style="position:absolute;inset:0;border-radius:999px;border:2px solid #C400D7;animation:ringPulse 2.8s ease-out 1.4s infinite;pointer-events:none"></span>
          <span>Choose a time</span>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M4 10h11M11 5.5l4.5 4.5-4.5 4.5" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </a>
        <div style="display:flex;flex-wrap:wrap;justify-content:center;gap:8px 18px;font-size:13.5px;font-weight:600;color:#555">
          <span>15 minutes</span><span>Google Meet</span><span>No obligation</span>
        </div>
      </div>

      <p style="font-size:14.5px;line-height:1.55;margin:0;max-width:480px;opacity:0.86;animation:tyIn .9s {EASE} .56s both">Prefer not to book now? {{{{subhead}}}}</p>"""

# Design's style-hover on the button; append to assets/css/thank-you.css.
HOVER_CSS = ".compound-ty-book:hover{color:#fff;transform:translateY(-2px);filter:brightness(1.08)}"

live = open(sys.argv[1], encoding="utf-8").read()
# Live middle = <h1>...</h1> through the empty booking slot div.
pattern = re.compile(r'<h1 .*?<div data-slot="booking"[^>]*></div>', re.S)
assert len(pattern.findall(live)) == 1, "live markup changed; re-check the template"
open("booking-section.html", "w").write(SECTION + "\n\n<style>" + HOVER_CSS + "</style>\n")
for key, (eyebrow, subhead) in AUDIENCES.items():
    page = pattern.sub(lambda m: SECTION.replace("{{subhead}}", subhead), live)
    page = re.sub(r'(breathe 5s ease-in-out 1s infinite">)[^<]*(</div>)', lambda m: m.group(1) + eyebrow + m.group(2), page, count=1)
    page = page.replace("</head>", f"<style>{HOVER_CSS}</style></head>", 1)
    open(f"preview-{key}.html", "w", encoding="utf-8").write(page)
    print("wrote preview", key)
