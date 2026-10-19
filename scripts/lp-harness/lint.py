#!/usr/bin/env python3
"""Content check for built landing pages. Run before every Figma capture and before the client review pack.

  python3 lint.py <client-folder> [page-type ...]
  python3 lint.py --html <file.html> [--facts facts.json] [--client client.json]   (check any page, e.g. a live LP)

Fails (exit 1) on:
  - template leftovers and banned phrases (data/playbooks/landing-pages/template-leftovers.txt)
  - "clinics" plural or "nearest/whichever clinic" when client.json says single_site
  - phone links, tel: or WhatsApp on the landing page itself (thank-you page only)
  - a price that isn't in facts.json "prices"
  - monthly figures next to finance wording (FCA): "£x a month" within a finance sentence
  - CTA wording outside the SOP list
Warnings are listed for Toby to confirm with the client; they don't block. Once the client confirms one, add the
phrase to facts.json "confirmed" (with its source) and it stops being listed.
"""
import html as H
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LEFTOVERS = ROOT / "data/playbooks/landing-pages/template-leftovers.txt"
CTAS = {"Book Now", "Book Appointment", "Book Consultation"}


def visible_text(src):
    src = re.sub(r"<(script|style)\b.*?</\1>", " ", src, flags=re.S | re.I)
    src = re.sub(r"<[^>]+>", " ", src)
    return re.sub(r"\s+", " ", H.unescape(src))


def rules():
    out = []
    for line in LEFTOVERS.read_text().splitlines():
        if line.strip() and not line.startswith("#"):
            sev, rest = line.split("|", 1)
            rx, why = rest.rsplit("|", 1)  # the regex itself may contain |
            out.append((sev, re.compile(rx, re.I if sev == "warn" else 0), why))
    return out


def snippet(text, m, n=50):
    a, b = max(0, m.start() - n), min(len(text), m.end() + n)
    return "…" + text[a:b].strip() + "…"


def check(path, facts, client, is_ty=False):
    src = path.read_text()
    text = visible_text(src)
    fails, warns = [], []
    confirmed = [c.lower() for c in facts.get("confirmed", [])]  # client-confirmed phrases that silence a warning
    for sev, rx, why in rules():
        for m in rx.finditer(text):
            near = text[max(0, m.start() - 40):m.end() + 40].lower()
            if sev == "warn" and any(c in near for c in confirmed):
                continue
            (fails if sev == "fail" else warns).append(f"{why}: {snippet(text, m)}")
    if client.get("single_site"):
        for m in re.finditer(r"\bclinics\b|\b(nearest|whichever|every|all our) clinic\b|\bacross (all )?our clinics\b", text, re.I):
            fails.append(f"Single-site client but copy implies several clinics: {snippet(text, m)}")
    if not is_ty:
        for m in re.finditer(r'href=["\'](tel:|https?://(wa\.me|api\.whatsapp))', src, re.I):
            fails.append(f"Phone/WhatsApp link on the landing page (form is the only CTA): {src[m.start():m.start() + 60]}")
        for m in re.finditer(r"\bWhatsApp\b|\bcall us\b|\bor call\b", text, re.I):
            fails.append(f"Call/WhatsApp wording on the landing page (form is the only CTA): {snippet(text, m)}")
        for m in re.finditer(r'class="btn[^"]*"[^>]*>([^<]+)<', src):
            label = H.unescape(m.group(1)).strip()
            if label and label not in CTAS:
                fails.append(f"CTA wording outside the SOP list ({', '.join(sorted(CTAS))}): '{label}'")
    allowed = {p.replace(",", "") for p in facts.get("prices", [])}
    for m in re.finditer(r"£\s?\d[\d,]*(\.\d\d)?", text):
        p = m.group(0).replace(" ", "").replace(",", "")
        if p not in allowed:
            fails.append(f"Price not in facts.json: {snippet(text, m)}")
    for m in re.finditer(r"[^.]*\bfinance\b[^.]*£\s?\d[\d,.]*\s*(a|per|/)\s*month[^.]*|[^.]*£\s?\d[\d,.]*\s*(a|per|/)\s*month[^.]*\bfinance\b[^.]*", text, re.I):
        fails.append(f"Monthly figure in finance wording (FCA): {m.group(0).strip()[:120]}")
    return sorted(set(fails)), sorted(set(warns))


def main():
    a = sys.argv[1:]
    if not a:
        raise SystemExit(__doc__)
    targets = []
    if a[0] == "--html":
        opts = dict(zip(a[2::2], a[3::2]))
        facts = json.loads(Path(opts["--facts"]).read_text()) if "--facts" in opts else {}
        client = json.loads(Path(opts["--client"]).read_text()) if "--client" in opts else {}
        targets = [(Path(a[1]), False)]
    else:
        root = Path(a[0])
        facts = json.loads((root / "facts.json").read_text())
        client = json.loads((root / "client.json").read_text())
        for t in a[1:] or sorted(p.stem for p in (root / "pages").glob("*.json")):
            targets += [(root / t / "lp-desktop.html", False), (root / t / "lp-mobile.html", False),
                        (root / t / "ty-desktop.html", True), (root / t / "ty-mobile.html", True)]
    total = 0
    for path, ty in targets:
        fails, warns = check(path, facts, client, ty)
        total += len(fails)
        status = "FAIL" if fails else "ok"
        print(f"{status:4}  {path}")
        for f in fails:
            print(f"      ✗ {f}")
        for w in warns:
            print(f"      ? {w}")
    print(f"\n{total} failure(s)")
    sys.exit(1 if total else 0)


if __name__ == "__main__":
    main()
