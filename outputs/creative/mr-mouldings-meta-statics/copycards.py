"""Extract concept, headline and primary text from a copy-<persona>.md file as JSON for Figma copy cards."""
import json, re, sys
src = open(sys.argv[1]).read()
out = []
for block in re.split(r"\n## ", src)[1:]:
    title = block.split("\n", 1)[0].strip()
    if title.startswith("Notes"):
        continue
    hl = re.search(r"\*\*Headline:\*\* (.+)", block).group(1).strip()
    pt = block.split("**Primary text:**", 1)[1].split("\n---", 1)[0].strip()
    labels = re.search(r"\*\*Awareness:\*\*(.+)", block).group(0).replace("**", "")
    out.append(dict(title=title, labels=labels, headline=hl, primary=pt))
print(json.dumps(out))
