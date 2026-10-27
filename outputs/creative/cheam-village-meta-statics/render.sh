#!/bin/zsh
# Render QA: headless Chrome at half scale, then crop each artboard. Usage: ./render.sh <persona> [n_boards]
# Needs the folder served on :8795 (python3 -m http.server 8795).
p=$1; n=${2:-3}; cd ${0:a:h}; mkdir -p renders
CH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
for size in 1x1 9x16 landscape; do
  case $size in 1x1) w=1080; h=1080; step=1160;; 9x16) w=1080; h=1920; step=1160;; landscape) w=1200; h=628; step=1280;; esac
  "$CH" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=0.5 --window-size=$((80 + n*step)),$((h+160)) \
    --virtual-time-budget=6000 --screenshot=renders/$p-$size.png http://localhost:8795/$p-$size.html 2>/dev/null
  for i in $(seq 1 $n); do
    ffmpeg -loglevel error -y -i renders/$p-$size.png -vf "crop=$((w/2)):$((h/2)):$(( (80+(i-1)*step)/2 )):40" -q:v 3 renders/$p-$size-$i.jpg
  done
done
echo rendered $p
