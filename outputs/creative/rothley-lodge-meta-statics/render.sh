#!/bin/bash
# Usage: ./render.sh <persona>   (needs: python3 -m http.server 8791 --directory <this folder>)
# Renders both sizes at 0.5x with headless Chrome and crops each artboard to renders/<id>.png.
P=$1; D=$(cd "$(dirname "$0")" && pwd); CH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
TMP=$(mktemp -d); T=$(date +%s)
"$CH" --headless=new --disable-gpu --hide-scrollbars --user-data-dir=$TMP --force-device-scale-factor=0.5 --window-size=11600,2400 --virtual-time-budget=6000 --screenshot=$D/renders/$P-1x1.png "http://localhost:8791/$P-1x1.html?t=$T" 2>/dev/null
"$CH" --headless=new --disable-gpu --hide-scrollbars --user-data-dir=$TMP --force-device-scale-factor=0.5 --window-size=11600,4160 --virtual-time-budget=6000 --screenshot=$D/renders/$P-9x16.png "http://localhost:8791/$P-9x16.html?t=$T" 2>/dev/null
rm -rf $TMP
ffmpeg -loglevel error -y -i $D/renders/$P-1x1.png -vf "crop=2860:540:40:40" $D/renders/$P-row1.png
ffmpeg -loglevel error -y -i $D/renders/$P-9x16.png -vf "crop=2860:960:40:40" $D/renders/$P-row9.png
