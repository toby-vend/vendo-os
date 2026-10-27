#!/bin/bash
# Usage: ./render.sh <persona> (renders from file://, no server needed)  -> renders/<persona>-<size>-<n>.jpg (one per artboard, half scale)
P=$1; OUT=renders; mkdir -p $OUT
CH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
N=$(grep -o 'class="ab"' $P-1x1.html | wc -l | tr -d ' ')
for spec in "1x1:1080:1080:1160" "9x16:1080:1920:1160" "landscape:1200:628:1280"; do
  IFS=: read S W H STEP <<< "$spec"
  WW=$((80 + N*STEP)); WH=$((H + 160))
  "$CH" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=0.5 --virtual-time-budget=6000 \
    --screenshot=$OUT/$P-$S.png --window-size=$WW,$WH --allow-file-access-from-files "file://$PWD/$P-$S.html" 2>/dev/null
  for i in $(seq 0 $((N-1))); do
    ffmpeg -loglevel error -y -i $OUT/$P-$S.png -vf "crop=$((W/2)):$((H/2)):$(( (80 + i*STEP)/2 )):40" -q:v 3 $OUT/$P-$S-$((i+1)).jpg
  done
done
