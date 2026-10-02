#!/bin/zsh
# Render both harness pages with headless Chrome and crop each artboard (half scale) into renders/.
cd "${0:A:h}"
python3 build.py
lsof -i :8766 >/dev/null || (python3 -m http.server 8766 >/dev/null 2>&1 &)
sleep 1
CH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
mkdir -p renders
"$CH" --headless=new --disable-gpu --hide-scrollbars --virtual-time-budget=8000 --force-device-scale-factor=0.5 --window-size=6000,1240 --screenshot=renders/od-1x1.png http://localhost:8766/open-day-1x1.html 2>/dev/null
"$CH" --headless=new --disable-gpu --hide-scrollbars --virtual-time-budget=8000 --force-device-scale-factor=0.5 --window-size=6000,2080 --screenshot=renders/od-9x16.png http://localhost:8766/open-day-9x16.html 2>/dev/null
cd renders
for i in 0 1 2 3 4; do
  ffmpeg -loglevel error -y -i od-1x1.png -vf "crop=540:540:$((40+i*580)):40" od1-$((i+1)).png
  ffmpeg -loglevel error -y -i od-9x16.png -vf "crop=540:960:$((40+i*580)):40" od9-$((i+1)).png
done
ffmpeg -loglevel error -y -i od1-1.png -i od1-2.png -i od1-3.png -filter_complex hstack=3 sheet1a.png
ffmpeg -loglevel error -y -i od1-4.png -i od1-5.png -filter_complex hstack=2 sheet1b.png
ffmpeg -loglevel error -y -i od9-1.png -i od9-2.png -i od9-3.png -i od9-4.png -i od9-5.png -filter_complex hstack=5 sheet9.png
