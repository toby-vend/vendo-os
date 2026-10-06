#!/bin/bash
# Render every card of carousel-1x1.html to renders/cNN.png (needs: python3 -m http.server 8847 in this folder)
cd "$(dirname "$0")"; mkdir -p renders
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=0.5 --window-size=11960,1240 --virtual-time-budget=8000 --screenshot=renders/all.png http://localhost:8847/carousel-1x1.html 2>/dev/null
for i in $(seq 0 9); do ffmpeg -loglevel error -y -i renders/all.png -vf "crop=540:540:$(( (80 + i*1160)/2 )):40" renders/c$(printf %02d $((i+1))).png; done
ffmpeg -loglevel error -y -i renders/c01.png -i renders/c02.png -i renders/c03.png -i renders/c04.png -i renders/c05.png -filter_complex hstack=5 renders/rowA.png
ffmpeg -loglevel error -y -i renders/c06.png -i renders/c07.png -i renders/c08.png -i renders/c09.png -i renders/c10.png -filter_complex hstack=5 renders/rowB.png
