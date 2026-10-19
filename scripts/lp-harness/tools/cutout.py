#!/usr/bin/env python3
"""Background removal for hero break-outs: python3 cutout.py <in.jpg> <out.png>  (Apple Vision, macOS 14+)."""
import subprocess
import sys

from team_crop import tool

if len(sys.argv) != 3:
    raise SystemExit(__doc__)
subprocess.run([tool("cutout"), sys.argv[1], sys.argv[2]], check=True)
