#!/bin/zsh
# Build, render each set with headless Chrome (half scale) and crop artboards into renders/ (gitignored).
# Usage: ./render.sh
cd "${0:A:h}"
python3 build.py || exit 1
lsof -i :8797 >/dev/null || (python3 -m http.server 8797 >/dev/null 2>&1 &)
sleep 1
CH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
TMP=$(mktemp -d)
mkdir -p renders
shoot() {  # set, size, count, height
  perl -e 'alarm 90; exec @ARGV' "$CH" --headless=new --disable-gpu --hide-scrollbars --user-data-dir=$TMP --virtual-time-budget=9000 \
    --force-device-scale-factor=0.5 --window-size=$((160 + $3 * 1160)),$(($4 + 160)) --screenshot=renders/$1-$2.png http://localhost:8797/$1-$2.html 2>/dev/null
  local h=$(($4 / 2)) parts=()
  for i in $(seq 0 $(($3 - 1))); do
    ffmpeg -loglevel error -y -i renders/$1-$2.png -vf "crop=540:$h:$((40 + i * 580)):40" renders/$1-$2-$((i + 1)).png
    parts+=(-i renders/$1-$2-$((i + 1)).png)
  done
  ffmpeg -loglevel error -y $parts -filter_complex hstack=$3 renders/sheet-$1-$2.png
}
shoot open-day 1x1 5 1080; shoot open-day 9x16 5 1920
rm -rf $TMP
echo rendered
