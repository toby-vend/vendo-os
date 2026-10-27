#!/bin/zsh
# Render every board to renders/<persona>-<size>-<n>.jpg via headless Chrome against the local server on :8777.
cd "$(dirname "$0")"; mkdir -p renders
CH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
for p in ${@:-nina}; do
  for spec in "1x1 1080 1080" "9x16 1080 1920" "landscape 1200 628"; do
    set -- ${=spec}; s=$1; w=$2; h=$3; n=$(grep -o 'class="ab"' $p-$s.html | wc -l | tr -d ' ')
    W=$((80 + n * (w + 80))); H=$((h + 160))
    "$CH" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 --window-size=$W,$H --virtual-time-budget=8000 \
      --screenshot=renders/_$p-$s.png "http://localhost:8777/$p-$s.html" 2>/dev/null
    for ((i=0;i<n;i++)); do ffmpeg -loglevel error -y -i renders/_$p-$s.png -vf "crop=$w:$h:$((80 + i * (w + 80))):80" -q:v 3 renders/$p-$s-$((i+1)).jpg; done
    rm renders/_$p-$s.png
  done
done
ls renders
