#!/bin/bash
# Render the harness pages with headless Chrome and crop each artboard. Serves on port 8776.
set -e
cd "$(dirname "$0")"
python3 build.py
python3 -m http.server 8776 >/dev/null 2>&1 &
SRV=$!
trap "kill $SRV" EXIT
sleep 1
CH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
shot() { # page width height
  "$CH" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 --virtual-time-budget=6000 \
    --window-size=$2,$3 --screenshot="renders/$1-full.png" "http://localhost:8776/$1.html" 2>/dev/null
}
mkdir -p renders
shot mark-1x1 3560 1240
shot mark-9x16 3560 2080
shot mark-landscape 3920 788
for i in 0 1 2; do
  ffmpeg -loglevel error -y -i renders/mark-1x1-full.png -vf "crop=1080:1080:$((80+i*1160)):80" -q:v 2 renders/mark-1x1-$((i+1)).jpg
  ffmpeg -loglevel error -y -i renders/mark-9x16-full.png -vf "crop=1080:1920:$((80+i*1160)):80" -q:v 2 renders/mark-9x16-$((i+1)).jpg
  ffmpeg -loglevel error -y -i renders/mark-landscape-full.png -vf "crop=1200:628:$((80+i*1280)):80" -q:v 2 renders/mark-landscape-$((i+1)).jpg
done
ls renders
