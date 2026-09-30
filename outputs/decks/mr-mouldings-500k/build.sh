#!/bin/bash
# Assembles each .dc.html artboard from shared chrome + a body fragment.
set -e
ICON='<svg width="17" height="17" viewBox="0 0 397 384" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M258.48 128L213.199 255.664H174.281L129 128H162.102L193.748 224.386L225.574 128H258.48Z" fill="#8EFEBB"></path><path d="M267.575 246.858C267.575 251.907 263.482 256 258.433 256C253.384 256 249.291 251.907 249.291 246.858C249.291 241.809 253.384 237.716 258.433 237.716C263.482 237.716 267.575 241.809 267.575 246.858Z" fill="#8EFEBB"></path></svg>'

while IFS='|' read -r NAME NUM EYEBROW TITLE STANDFIRST; do
  [ -z "$NAME" ] && continue
  case "$NAME" in \#*) continue;; esac
  OUT="${NAME}.dc.html"
  { cat head.part
    echo '<div class="slide">'
    echo '<div class="grid"></div>'
    echo '<div class="orb" style="width:620px;height:620px;top:-260px;right:-180px;background:rgba(142,254,187,.07)"></div>'
    echo '<div class="orb" style="width:520px;height:520px;bottom:-300px;left:-220px;background:rgba(255,255,255,.035)"></div>'
    echo '<div class="hd">'
    echo "<p class=\"eyebrow\">${EYEBROW}</p>"
    echo "<h1 class=\"t\">${TITLE}</h1>"
    [ -n "$STANDFIRST" ] && echo "<p class=\"sf\">${STANDFIRST}</p>"
    echo '</div>'
    cat "bodies/${NAME}.html"
    echo '<div class="ft">'
    echo "<div class=\"l\">${ICON}<span>MR Mouldings &#215; Vendo Digital</span></div>"
    echo "<div class=\"n\">${NUM}</div>"
    echo '</div>'
    echo '</div>'
    cat tail.part
  } > "$OUT"
  echo "built $OUT"
done < manifest.txt
