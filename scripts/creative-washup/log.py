"""Append one line to data/creative-washup/run.log (the scheduled run's summary).

    python3 -I scripts/creative-washup/log.py "<summary line>"
"""
import datetime
import sys

with open('data/creative-washup/run.log', 'a') as f:
    f.write(f"{datetime.datetime.now():%Y-%m-%d %H:%M} {' '.join(sys.argv[1:])}\n")
