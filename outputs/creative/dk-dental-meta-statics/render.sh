#!/bin/zsh
# Render harness pages to _qa/<page>.png at 0.5x and crop each artboard.
# Usage: ./render.sh mark 3   (serves this folder on :18773 first)
CH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
p=$1; n=${2:-5}
mkdir -p _qa renders
for s in 1x1 9x16 landscape; do
  case $s in
    1x1) W=$((80+n*1160)); H=1240; bw=1080; bh=1080; step=1160;;
    9x16) W=$((80+n*1160)); H=2080; bw=1080; bh=1920; step=1160;;
    landscape) W=$((80+n*1280)); H=788; bw=1200; bh=628; step=1280;;
  esac
  "$CH" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=0.5 --window-size=$W,$H \
    --virtual-time-budget=8000 --screenshot=_qa/$p-$s.png "http://localhost:18773/$p-$s.html" 2>/dev/null
  for i in $(seq 0 $((n-1))); do
    x=$(( (80+i*step)/2 )); ffmpeg -loglevel error -y -i _qa/$p-$s.png -vf "crop=$((bw/2)):$((bh/2)):$x:40" -q:v 3 renders/$p-$s-$((i+1)).jpg
  done
done
ls renders | grep "^$p" | wc -l
