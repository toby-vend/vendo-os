#!/bin/zsh
# Open a harness page in Chrome with a Figma capture id and bring that tab to the front (background tabs never fire).
# Usage: ./capture.sh owner-all.html <captureId>
url="http://localhost:8793/$1#figmacapture=$2&figmaendpoint=https%3A%2F%2Fmcp.figma.com%2Fmcp%2Fcapture%2F$2%2Fsubmit%3FbindVariables%3Dtrue&figmadelay=3000"
open -a "Google Chrome" "$url"; sleep 2
osascript -e "tell application \"Google Chrome\"
repeat with w in windows
set i to 0
repeat with t in tabs of w
set i to i + 1
if URL of t contains \"$2\" then
set active tab index of w to i
set index of w to 1
activate
return \"focused\"
end if
end repeat
end repeat
end tell"
