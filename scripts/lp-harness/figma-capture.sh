#!/bin/bash
# Run one Figma capture in a throwaway headless Chrome (no focus stealing, Toby's browser untouched).
#   ./figma-capture.sh <client-folder> <page-type>/<file.html> <captureId> [port] [seconds]
# Get the captureId from the Figma MCP first: generate_figma_design with the target fileKey (and page nodeId,
# so the frames land on the right page). The page already loads capture.js; the hash tells it where to submit.
# Captures keep the brand font on text (use_figma can't: it only has Google fonts). CSS outline is dropped,
# so use borders. After capturing: strip auto layout, lift artboards out of the wrapper, check names (see the
# "Figma finishing" section of /client-meta-statics).
set -e
DIR=$(cd "$1" && pwd); FILE=$2; ID=$3; PORT=${4:-8861}; WAIT=${5:-75}
(cd "$DIR" && python3 -m http.server "$PORT" >/dev/null 2>&1) & SRV=$!
trap 'kill $SRV 2>/dev/null' EXIT
sleep 1
U="http://localhost:$PORT/$FILE#figmacapture=$ID&figmaendpoint=https%3A%2F%2Fmcp.figma.com%2Fmcp%2Fcapture%2F$ID%2Fsubmit%3FbindVariables%3Dtrue&figmadelay=3000"
D=$(mktemp -d)
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --user-data-dir="$D" \
  --window-size=1600,1200 --remote-debugging-port=0 "$U" >/dev/null 2>&1 &
PID=$!; sleep "$WAIT"; kill $PID 2>/dev/null || true; rm -rf "$D"
echo "submitted $FILE (capture $ID); poll the capture status in the Figma MCP"
