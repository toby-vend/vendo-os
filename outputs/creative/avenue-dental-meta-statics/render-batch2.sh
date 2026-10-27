#!/bin/bash
# Usage: ./render-batch2.sh <persona>  -> renders/<persona>-<size>-<n>.jpg (one per artboard, half scale)
# Same as render.sh but loads the pages from file:// (no local server needed).
P=$1; OUT=renders; mkdir -p $OUT; DIR=$(cd "$(dirname "$0")" && pwd)
CH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
N=$(grep -o 'class="ab"' $P-1x1.html | wc -l | tr -d ' ')
for spec in "1x1:1080:1080:1160" "9x16:1080:1920:1160" "landscape:1200:628:1280"; do
  IFS=: read S W H STEP <<< "$spec"
  WW=$((80 + N*STEP)); WH=$((H + 160))
  "$CH" --headless=new --disable-gpu --hide-scrollbars --allow-file-access-from-files --force-device-scale-factor=0.5 --virtual-time-budget=6000 \
    --screenshot=$OUT/$P-$S.png --window-size=$WW,$WH "file://$DIR/$P-$S.html" 2>/dev/null
  for i in $(seq 0 $((N-1))); do
    ffmpeg -loglevel error -y -i $OUT/$P-$S.png -vf "crop=$((W/2)):$((H/2)):$(( (80 + i*STEP)/2 )):40" -q:v 3 $OUT/$P-$S-$((i+1)).jpg
  done
done
