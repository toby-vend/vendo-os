#!/bin/bash
# Render a built page to PNG with headless Chrome, for QA before any Figma capture.
#   ./render.sh <client-folder> <page-type> [height] [port]
# Writes <client-folder>/renders/<page-type>-{desktop,mobile,ty-desktop,ty-mobile}.png
# Artboards sit inside 80px of #2a2a2a padding (the capture canvas), so the PNG is 1600 / 550 wide.
# Pick a height taller than the page (default 16000); the bottom is canvas colour, crop it when reviewing.
set -e
DIR=$(cd "$1" && pwd); T=$2; H=${3:-16000}; PORT=${4:-8860}
C="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
mkdir -p "$DIR/renders"
(cd "$DIR" && python3 -m http.server "$PORT" >/dev/null 2>&1) & SRV=$!
trap 'kill $SRV 2>/dev/null' EXIT
sleep 1
shot() { "$C" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 --window-size="$1,$2" \
           --virtual-time-budget=8000 --screenshot="$DIR/renders/$T-$3.png" "http://localhost:$PORT/$T/$4#static" 2>/dev/null; }
shot 1600 "$H" desktop lp-desktop.html
shot 550 "$((H * 3 / 2))" mobile lp-mobile.html
shot 1600 1800 ty-desktop ty-desktop.html
shot 550 2000 ty-mobile ty-mobile.html
echo "rendered $T into $DIR/renders"
