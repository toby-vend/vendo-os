#!/bin/zsh
# Build the harness, render each page with headless Chrome (half scale) and crop artboards into renders/.
# Usage: ./render.sh
cd "${0:A:h}"
python3 build.py || exit 1
lsof -i :8781 >/dev/null || (python3 -m http.server 8781 >/dev/null 2>&1 &)
sleep 1
CH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
mkdir -p renders
shot() { "$CH" --headless=new --disable-gpu --hide-scrollbars --virtual-time-budget=9000 --force-device-scale-factor=0.5 --window-size=$2 --screenshot=renders/$1.png http://localhost:8781/$1.html 2>/dev/null }
shot suite-1x1 15200,1240
shot suite-9x16 15200,2080
shot carousel 6000,1240
n=11
for i in $(seq 0 $((n-1))); do
  ffmpeg -loglevel error -y -i renders/suite-1x1.png -vf "crop=540:540:$((40+i*580)):40" renders/a$((i+1)).png
  ffmpeg -loglevel error -y -i renders/suite-9x16.png -vf "crop=540:960:$((40+i*580)):40" renders/b$((i+1)).png
done
for i in 0 1 2 3 4; do ffmpeg -loglevel error -y -i renders/carousel.png -vf "crop=540:540:$((40+i*580)):40" renders/c$((i+1)).png; done
echo rendered
