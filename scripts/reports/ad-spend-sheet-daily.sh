#!/bin/zsh
# Daily launchd entry point (com.vendodigital.ad-spend-sheet, 10:00).
#
# Cheap check first: only when a completed month is missing from the Paid
# Social Clients tab does it start Claude with Chrome to read Ads Reporting
# and fill it. Daily rather than "on the 1st" so a closed lid on the 1st just
# delays the run to the next day the Mac is awake.
set -u
cd /Users/Toby_1/Vendo-OS || exit 1
export PATH="/opt/homebrew/bin:/Users/Toby_1/.local/bin:/usr/bin:/bin"

echo "=== $(date '+%Y-%m-%d %H:%M') ==="

missing=$(npm run -s sheet:ad-spend -- --missing 2>/dev/null)
if [[ $? -ne 0 ]]; then
  echo "Could not read the sheet — will retry tomorrow"
  exit 1
fi
if [[ -z "$missing" ]]; then
  echo "Nothing to do"
  exit 0
fi

echo "Missing: ${missing//$'\n'/, }"
claude --chrome -p "/ad-spend-sheet" \
  --allowedTools "mcp__claude-in-chrome__*,ToolSearch,Read,Write(data/ad-spend/*),Bash(npm run -s sheet:ad-spend:*)"
