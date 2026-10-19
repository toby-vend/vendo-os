#!/usr/bin/env python3
"""Build a client's landing pages from their brand, facts and page recipes.

Usage:
  python3 build.py <client-folder> [page-type ...]      e.g. build.py ../../outputs/creative/siha-lp new-patient

Client folder:
  brand.json            palette roles, fonts, type, shapes, device, rhythm (see README)
  client.json           name, address, rating, review_count, cta ... ({{tokens}} in copy)
  facts.json            verified prices and claims, with sources (read by lint.py)
  pages/<type>.json     {"title", "form", "sections": [...], "thank_you": {...}}
  assets/               fonts, logos, photos, cut-outs (photos gitignored)
Writes <client-folder>/<type>/{lp-desktop,lp-mobile,ty-desktop,ty-mobile,index,thank-you}.html
"""
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from lpkit.brand import Brand  # noqa: E402
from lpkit.ui import Ctx  # noqa: E402
from lpkit import page as P  # noqa: E402


def main():
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    root = Path(sys.argv[1]).resolve()
    brand = Brand(root)
    client = json.loads((root / "client.json").read_text())
    types = sys.argv[2:] or sorted(p.stem for p in (root / "pages").glob("*.json"))
    for t in types:
        spec = json.loads((root / "pages" / f"{t}.json").read_text())
        ctx = Ctx(brand, client, spec)
        out = root / t
        files = P.build(ctx, out, t, spec["title"], spec["sections"], [dict(block="thank_you", **spec.get("thank_you", {}))])
        # pages sit one folder below the client root, so asset paths step up one level
        for f in files:
            p = out / f
            p.write_text(re.sub(r"""(url\(|src=["'])assets/""", r"\1../assets/", p.read_text()))
        print(f"{t}: wrote {', '.join(files)}")


if __name__ == "__main__":
    main()
