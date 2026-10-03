#!/bin/zsh
# usage: ./render.sh <persona>  -> renders/<persona>-1x1.png, -9x16.png and per-board crops
cd "$(dirname "$0")"; p=$1; mkdir -p renders
CH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
"$CH" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=0.5 --window-size=5960,1240 --virtual-time-budget=10000 --screenshot=renders/$p-1x1.png http://localhost:8766/$p-1x1.html 2>/dev/null
"$CH" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=0.5 --window-size=5960,2080 --virtual-time-budget=10000 --screenshot=renders/$p-9x16.png http://localhost:8766/$p-9x16.html 2>/dev/null
ffmpeg -loglevel error -y -i renders/$p-1x1.png -vf "crop=2880:540:40:40,scale=1800:-1" renders/$p-1x1-row.png
ffmpeg -loglevel error -y -i renders/$p-9x16.png -vf "crop=2880:960:40:40,scale=1800:-1" renders/$p-9x16-row.png
echo rendered $p
