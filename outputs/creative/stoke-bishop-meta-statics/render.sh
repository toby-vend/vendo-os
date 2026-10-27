#!/bin/bash
# Render every artboard: headless Chrome on file:// (port 8779 was taken by another folder's server) screenshot per page, crop each board into renders/.
cd "$(dirname "$0")"
python3 build.py
C="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
mkdir -p renders
shot() { "$C" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 --window-size=$2 --virtual-time-budget=6000 --screenshot=renders/_$1.png "file://$PWD/mark-$1.html" 2>/dev/null; }
shot 1x1 3560,1240; shot 9x16 3560,2080; shot landscape 3920,788
for i in 0 1 2; do
  ffmpeg -loglevel error -y -i renders/_1x1.png -vf "crop=1080:1080:$((80+i*1160)):80" -q:v 2 renders/mark-1x1-$((i+1)).jpg
  ffmpeg -loglevel error -y -i renders/_9x16.png -vf "crop=1080:1920:$((80+i*1160)):80" -q:v 2 renders/mark-9x16-$((i+1)).jpg
  ffmpeg -loglevel error -y -i renders/_landscape.png -vf "crop=1200:628:$((80+i*1280)):80" -q:v 2 renders/mark-landscape-$((i+1)).jpg
done
rm renders/_*.png
