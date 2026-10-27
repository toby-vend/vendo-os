"""Extract headline + primary text per concept from copy-<persona>.md as JSON (for the Figma copy row).
Usage: python3 copy_cards.py amy"""
import json, re, sys
from pathlib import Path

md = (Path(__file__).parent / f'copy-{sys.argv[1]}.md').read_text()
out = []
for block in re.split(r'\n## ', md)[1:]:
    if block.startswith('Notes'):
        continue
    title = block.splitlines()[0].strip()
    head = re.search(r'\*\*Headline:\*\* (.+)', block).group(1).strip()
    prim = re.search(r'\*\*Primary text:\*\*\n(.+?)(?:\n---|\Z)', block, re.S).group(1).strip()
    out.append({'title': title, 'headline': head, 'primary': prim})
print(json.dumps(out))
