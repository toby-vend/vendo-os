"""A client's brand layer for landing pages, read from <client>/brand.json.

The kit's own settings (colours, one font, one radius) are what make every client's page read as a recolour.
brand.json carries those plus the "treatments" that make a page feel like the client's: the headline style,
the graphic device that frames the hero photo, card and button shapes, and which tone each section sits in
(the light/dark rhythm). Sections never hold a hex code or a font size; they read the CSS variables and
classes written here, so one file changes the whole page.
"""
import json
import re
from pathlib import Path

ROLES = ("ink", "ink2", "muted", "bg", "panel", "card", "accent", "dark", "dark2", "on_dark", "on_dark2")


def rgba(hex_, a):
    h = hex_.lstrip("#")
    r, g, b = (int(h[i:i + 2], 16) for i in (0, 2, 4))
    return f"rgba({r},{g},{b},{a})"


class Brand:
    def __init__(self, folder):
        self.root = Path(folder)
        self.data = json.loads((self.root / "brand.json").read_text())
        self.p = self.data["palette"]
        missing = [r for r in ROLES if r not in self.p]
        if missing:
            raise SystemExit(f"brand.json palette is missing roles: {', '.join(missing)}")
        self.type = self.data["type"]
        self.shape = self.data["shape"]
        self.device = self.data.get("device", {"type": "rounded"})
        self.rhythm = self.data.get("rhythm", {})
        self.stroke = self.data.get("icons", {}).get("stroke", 1.5)

    def tone(self, block, override=None):
        return override or self.rhythm.get(block) or self.rhythm.get("default", "light")

    def logo(self, which="dark", cls="logo"):
        return self.svg(self.data["logo"][which], cls)

    def svg(self, rel, cls="logo"):
        """Inline an SVG so it takes currentColor: fills are stripped, width/height dropped (CSS sizes it)."""
        s = (self.root / rel).read_text()
        s = re.sub(r"<\?xml.*?\?>|<!DOCTYPE.*?>", "", s, flags=re.S)
        s = re.sub(r'fill:#[0-9a-fA-F]{6};?', "", s)
        s = re.sub(r'(fill|stroke)="#[0-9a-fA-F]{3,6}"', r'\1="currentColor"', s)
        s = re.sub(r'(<svg[^>]*?)\swidth="[^"]*"', r"\1", s, count=1)
        s = re.sub(r'(<svg[^>]*?)\sheight="[^"]*"', r"\1", s, count=1)
        return s.replace("<svg", f'<svg class="{cls}" fill="currentColor"', 1)

    # ------------------------------------------------------------------ CSS
    def _type_rule(self, cls, t):
        out = [f"font-weight:{t.get('weight', 400)}", f"font-size:{t['size']}px"] + ([f"line-height:{t['line']}"] if t.get("line") else [])
        if t.get("tracking"):
            out.append(f"letter-spacing:{t['tracking']}")
        if t.get("case"):
            out.append(f"text-transform:{t['case']}")
        if t.get("font"):
            out.append(f"font-family:{t['font']}")
        if t.get("style"):
            out.append(f"font-style:{t['style']}")
        rule = f".{cls} {{ {';'.join(out)}; }}"
        if t.get("bold"):  # the one emphasised word in a headline (<b>), e.g. Siha's single bold word in a light line
            b = t["bold"] if isinstance(t["bold"], dict) else {"weight": t["bold"]}
            bits = [f"font-weight:{b.get('weight', 600)}"]
            for k, prop in (("font", "font-family"), ("style", "font-style"), ("case", "text-transform")):
                if b.get(k):
                    bits.append(f"{prop}:{b[k]}")
            if b.get("color"):
                bits.append(f"color:var(--{b['color']})")
            rule += f"\n.{cls} b {{ {';'.join(bits)}; }}"
        return rule

    def css(self):
        p, t, sh = self.p, self.type, self.shape
        fonts = self.data["fonts"]
        faces = "\n".join(f"@font-face {{ font-family: '{f.get('family', fonts['family'])}'; src: url({f['file']}); "
                          f"font-weight: {f.get('weight', 400)}; font-style: {f.get('style', 'normal')}; }}" for f in fonts["faces"])
        roots = ";".join(f"--{k.replace('_', '-')}:{v}" for k, v in p.items())
        btn = self.data.get("button", {})
        field_border = p.get("field_border", rgba(p["ink"], .18))
        tones = {
            "light": dict(sbg=p["bg"], fg=p["ink"], fg2=p["ink2"], fg3=p["muted"], surface=p["card"], alt=p["panel"],
                          rule=rgba(p["ink"], .12), btn=p["ink"], btnfg=p["bg"]),
            "panel": dict(sbg=p["panel"], fg=p["ink"], fg2=p["ink2"], fg3=p["muted"], surface=p["card"], alt=p["bg"],
                          rule=rgba(p["ink"], .12), btn=p["ink"], btnfg=p["bg"]),
            "card": dict(sbg=p["card"], fg=p["ink"], fg2=p["ink2"], fg3=p["muted"], surface=p["bg"], alt=p["panel"],
                         rule=rgba(p["ink"], .12), btn=p["ink"], btnfg=p["bg"]),
            "dark": dict(sbg=p["dark"], fg=p["on_dark"], fg2=p["on_dark2"], fg3=p["on_dark2"], surface=p["dark2"], alt=p["dark2"],
                         rule=rgba(p["on_dark2"], .2), btn=p.get("btn_on_dark", p["panel"]), btnfg=p.get("btn_on_dark_fg", p["ink"]),
                         extra=(f"--accent:{p['accent_on_dark']};" if p.get("accent_on_dark") else "")
                         + (f"--fine:{p['fine_on_dark']};" if p.get("fine_on_dark") else "")),
        }
        tone_css = "\n".join(
            f".tone-{n} {{ --s-bg:{v['sbg']};--fg:{v['fg']};--fg2:{v['fg2']};--fg3:{v['fg3']};--surface:{v['surface']};"
            f"--alt:{v['alt']};--rule:{v['rule']};--btn-bg:{v['btn']};--btn-fg:{v['btnfg']};{v.get('extra', '')}color:var(--fg); }}"
            for n, v in tones.items())
        types = "\n".join(self._type_rule(k, v) for k, v in t.items() if k not in ("price",))
        price = t.get("price", {})
        return f"""
{faces}
:root {{ {roots}; --fine:{p.get('fine', rgba(p['ink'], .2))}; --card-r:{sh['card']}px; --btn-r:{sh['button']}px; --field-r:{sh['field']}px; --photo-r:{sh.get('photo', sh['card'])}px; --thumb-r:{sh.get('thumb', sh['card'])}px; }}
* {{ box-sizing: border-box; margin: 0; padding: 0; }}
body {{ background: #2a2a2a; font-family: '{fonts['family']}', {fonts.get('fallback', 'sans-serif')}; padding: 80px; color: {p['ink']}; }}
.page {{ background: {p['bg']}; overflow: hidden; }}
{tone_css}
section.tone-light, section.tone-panel, section.tone-card, section.tone-dark {{ background: var(--s-bg); }}
.logo, .icon {{ display: block; width: 100%; height: auto; }}
{types}
.price {{ font-weight:{price.get('weight', 300)}; line-height:1; {('font-family:' + price['font'] + ';') if price.get('font') else ''} }}
.fg {{ color: var(--fg); }} .fg2 {{ color: var(--fg2); }} .fg3 {{ color: var(--fg3); }} .acc {{ color: var(--accent); }}
.btn {{ display: inline-flex; align-items: center; justify-content: center; height: {btn.get('height', 52)}px; padding: 0 {btn.get('pad', 30)}px;
        border-radius: var(--btn-r); font-weight: {btn.get('weight', 600)}; font-size: {btn.get('size', 13)}px; letter-spacing: {btn.get('tracking', '.14em')};
        text-transform: {btn.get('case', 'uppercase')}; white-space: nowrap; text-decoration: none; }}
.btn.primary {{ background: var(--btn-bg); color: var(--btn-fg); }}
.btn.offer {{ background: {p.get('offer', 'var(--accent)')}; color: {p.get('on_accent', p['bg'])}; }}
.btn svg {{ flex: none; margin-left: 14px; }}
.btn.outline {{ border: 1.5px solid var(--fg); color: var(--fg); }}
.card {{ border-radius: var(--card-r); }}
.field {{ display: flex; flex-direction: column; gap: 8px; }}
.field span {{ font-weight: 500; font-size: 13px; color: {p['ink2']}; }}
.field div {{ height: 50px; border-radius: var(--field-r); border: 1px solid {field_border}; background: {p['card']}; }}
.tick {{ display: flex; gap: 12px; align-items: flex-start; }}
.tick i {{ flex: none; width: 22px; height: 22px; border-radius: 50%; background: var(--alt); display: flex; align-items: center; justify-content: center; margin-top: 1px; color: var(--fg); }}
.sframe {{ position: relative; }}
.sframe .t, .sframe .b {{ position: absolute; left: 0; width: 100%; height: 50%; background-repeat: no-repeat; }}
.sframe .t {{ top: 0; border-radius: 9999px 0 0 9999px; }}
.sframe .b {{ bottom: 0; border-radius: 0 9999px 9999px 0; }}
{self.data.get('css_extra', '')}
"""
