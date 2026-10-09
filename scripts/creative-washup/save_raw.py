"""Save one Motion get_creative_insights response into the run folder.

    python3 -I scripts/creative-washup/save_raw.py <run-dir> <slug> <saved-response-file>

Large Motion replies are written to a tool-results file by Claude Code; this
copies it to <run-dir>/raw/<slug>.json after checking it is a finished report.
Kept as a script so the scheduled run needs no general file-copy permission.
"""
import json
import os
import shutil
import sys

run, slug, src = sys.argv[1], sys.argv[2], sys.argv[3]
data = json.load(open(src))
status = data.get('status')
insights = data['data']['data']['insightsResult'].get('data', {}).get('insights')
if status != 'success' or insights is None:
    sys.exit(f'{slug}: not a finished report (status {status}); call Motion again')
os.makedirs(os.path.join(run, 'raw'), exist_ok=True)
dst = os.path.join(run, 'raw', f'{slug}.json')
shutil.copyfile(src, dst)
print(f'{slug}: {len(insights)} creatives saved')
