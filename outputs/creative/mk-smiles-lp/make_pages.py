"""MK Smiles page recipes for the shared LP harness.

Phase 1 (brand spec): the new patient hero, the USP strip, the pricing panel and the mid-page form band, built
first so Toby can sign off the brand layer before full pages are written.
Copy comes from Toby's Meta draft lp.mksmiles.co.uk/new-patients-offer-meta (read 20 Oct 2026; the £50 hero price
stands) and mksmiles.co.uk/prices + /membership-plan. Every price is in facts.json. Photos are Joe Goodchild's
July 2026 shoot (Frame.io "KANA PROCESSED PHOTOS / MK SMILES"), 1800px copies in assets/photos (gitignored).
Run: python3 make_pages.py, then build.py from scripts/lp-harness.
"""
import json
from pathlib import Path

P = "assets/photos/"
# Dr Gizel Pereira (named on her scrubs) at the MK reception wall; rows = source rows that fill the frame
GIZEL = {"src": P + "26.jpg", "w": 1800, "h": 1012, "rows": [96, 1012], "cx": 1180}

FORM = {"fields": [{"label": "Full name", "full": True}, "Email", "Mobile"]}
NP_FORM = {"label": "New patient offer", "title": "Book your check-up",
           "sub": "New patients welcome, adults and children.",
           "note": "£50 new patient check-up, usually £76.70."}
TY = {"text": "Thank you. Our team will be in touch to confirm your check-up. If you’d rather pick a time yourself, you can book online now.",
      "buttons": [{"label": "Choose a time online", "href": "{{booking_url}}", "style": "primary"}]}
USP = {"block": "usp_text", "hide_m": False, "label": "Why families choose MK Smiles", "items": [
    ["calendar", "Evenings to 7pm Monday and Wednesday, and Saturdays to 4:30pm"],
    ["scan", "A complimentary 3D digital scan instead of messy impressions"],
    ["person", "Seven GDC-registered dentists in one modern practice"],
    ["pin", "Inside Brooklands Health Centre, MK10"]]}


def page(title, form, sections, ty=TY, cta=None):
    out = {"title": title, "form": {**FORM, **form}, "sections": sections, "thank_you": ty}
    if cta:
        out["cta"] = cta
    return out


brand_spec = page("Brand spec", NP_FORM, [
    {"block": "header"},
    {"block": "hero_form", "eyebrow": "New patients welcome · Brooklands, Milton Keynes",
     "title": "New patient check-up, <b>now £50.</b>",
     "tagline": "Usually £76.70. Evenings and Saturdays available.",
     "sub": "A detailed examination, digital X-rays where needed and a complimentary 3D scan, with a personalised care plan for you and your family.",
     "ticks": ["Detailed dental examination", "Digital X-rays where required", "Complimentary 3D digital scan", "Personalised care plan"],
     "ticks_m": ["Detailed dental examination", "Complimentary 3D digital scan"],
     "stats": [["{{rating}}", "Google rating"], ["{{review_count}}", "Google reviews"], ["Sat", "Open to 4:30pm"]],
     "photo": GIZEL, "device_gap_m": 130},
    USP,
    {"block": "pricing", "layout": "panel", "eyebrow": "Pricing", "title": "Clear pricing, <b>explained upfront.</b>",
     "sub": "No hidden costs. If you need any treatment after your check-up, we explain the options and the price before anything goes ahead.",
     "price_label": "New patient check-up", "price": "£50", "price_note": "Usually £76.70",
     "notes": ["Hygienist appointment: £79.80.", "Membership plans from £11.25 a month."],
     "photo": {"src": P + "9.jpg", "pos": "50% 40%"},
     "get": [["A detailed dental examination", "Teeth, gums and mouth, including an oral cancer screening"],
             ["Digital X-rays where required", "Only where they’re clinically needed, explained as we go"],
             ["A complimentary 3D digital scan", "A precise scan of your teeth instead of traditional impressions"],
             ["Your personalised care plan", "With oral hygiene advice and clear prices for anything you need"]]},
    {"block": "form_band", "name": "Book your check-up (form 2)", "eyebrow": "New patient offer", "title": "Your family dentist, <b>in Brooklands.</b>",
     "sub": "Book your £50 new patient check-up at MK Smiles. Usually £76.70, with a complimentary 3D scan.",
     "ticks": ["Evenings and Saturdays", "Complimentary 3D scan", "Adults and children", "Clear pricing upfront"], "form_title": "Book your check-up"}])

pages = {"brand-spec": brand_spec}
out = Path(__file__).parent / "pages"
out.mkdir(exist_ok=True)
for name, spec in pages.items():
    (out / f"{name}.json").write_text(json.dumps(spec, indent=1, ensure_ascii=False))
    print("wrote", name)
