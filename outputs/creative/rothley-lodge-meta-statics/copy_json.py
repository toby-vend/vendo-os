"""Extract concept id, title, headline and primary text from a copy-<persona>.md file as JSON."""
import json, re, sys
t = open(sys.argv[1]).read()
out = []
for block in re.split(r"\n---\n", t):
    m = re.search(r"^## (\w\d) \| (.+)$", block, re.M)
    if not m:
        continue
    h = re.search(r"\*\*Headline:\*\* (.+)", block).group(1).strip()
    p = block.split("**Primary text:**", 1)[1]
    p = re.split(r"\n\*\*Note:\*\*", p)[0].strip()
    out.append({"id": m.group(1), "title": m.group(2).strip(), "headline": h, "primary": p})
print(json.dumps(out))
