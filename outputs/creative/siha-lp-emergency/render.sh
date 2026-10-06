#!/bin/bash
# Render desktop + mobile full-page screenshots (needs: python3 -m http.server 8855 in this folder)
cd "$(dirname "$0")"; mkdir -p renders
H=${1:-1200}
C="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
"$C" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 --window-size=1600,$H --virtual-time-budget=8000 --screenshot=renders/desktop.png http://localhost:8855/lp-desktop.html 2>/dev/null
"$C" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 --window-size=550,$H --virtual-time-budget=8000 --screenshot=renders/mobile.png http://localhost:8855/lp-mobile.html 2>/dev/null
