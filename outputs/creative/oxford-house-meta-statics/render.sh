#!/bin/zsh
# Build all harness pages, render each set with headless Chrome (half scale) and crop artboards into renders/.
# Usage: ./render.sh [set ...]   (default: open-day amy dan michelle)
cd "${0:A:h}"
python3 build.py && python3 personas.py || exit 1
lsof -i :8766 >/dev/null || (python3 -m http.server 8766 >/dev/null 2>&1 &)
sleep 1
CH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
mkdir -p renders
sets=(${@:-open-day amy dan michelle})
for s in $sets; do
  "$CH" --headless=new --disable-gpu --hide-scrollbars --virtual-time-budget=9000 --force-device-scale-factor=0.5 --window-size=6000,1240 --screenshot=renders/$s-1x1.png http://localhost:8766/$s-1x1.html 2>/dev/null
  "$CH" --headless=new --disable-gpu --hide-scrollbars --virtual-time-budget=9000 --force-device-scale-factor=0.5 --window-size=6000,2080 --screenshot=renders/$s-9x16.png http://localhost:8766/$s-9x16.html 2>/dev/null
  for i in 0 1 2 3 4; do
    ffmpeg -loglevel error -y -i renders/$s-1x1.png -vf "crop=540:540:$((40+i*580)):40" renders/$s-a$((i+1)).png
    ffmpeg -loglevel error -y -i renders/$s-9x16.png -vf "crop=540:960:$((40+i*580)):40" renders/$s-b$((i+1)).png
  done
  ffmpeg -loglevel error -y -i renders/$s-a1.png -i renders/$s-a2.png -i renders/$s-a3.png -i renders/$s-a4.png -i renders/$s-a5.png -filter_complex hstack=5 renders/sheet-$s-1x1.png
  ffmpeg -loglevel error -y -i renders/$s-b1.png -i renders/$s-b2.png -i renders/$s-b3.png -i renders/$s-b4.png -i renders/$s-b5.png -filter_complex hstack=5 renders/sheet-$s-9x16.png
done
echo rendered $sets
