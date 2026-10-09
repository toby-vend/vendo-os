#!/bin/zsh
# launchd entry point (com.vendodigital.creative-washup, Fridays 09:00).
# Watch a run live with: tmux attach -t claude  (then pick the washup window)
#
# Wash-ups are every other Friday from 9 Oct 2026, so the cheap date check
# skips the off weeks without starting Claude. If the Mac was asleep at 09:00,
# launchd runs this on wake; after the 11:15 call has started it is too late
# to help, so it skips. Claude then confirms the call is on the calendar
# before doing the work (step 1 of /creative-washup).
#
#   scripts/creative-washup/run.sh --force   # run now regardless of date
set -u
cd /Users/Toby_1/Vendo-OS || exit 1
export PATH="/opt/homebrew/bin:/Users/Toby_1/.local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
mkdir -p data/creative-washup

echo "=== $(date '+%Y-%m-%d %H:%M') ==="

if [[ "${1:-}" != "--force" ]]; then
  anchor=$(date -j -f '%Y-%m-%d' '2026-10-09' '+%s')
  today=$(date -j -f '%Y-%m-%d' "$(date '+%Y-%m-%d')" '+%s')
  days=$(( (today - anchor + 43200) / 86400 ))  # round, so clock changes cannot shift the day
  if (( days % 14 != 0 )); then
    echo "Not a wash-up Friday — skipping"
    exit 0
  fi
  if (( $(date '+%H%M') > 1115 )); then
    echo "Too late for today's call — skipping"
    exit 0
  fi
  if [[ -f "data/creative-washup/runs/$(date '+%Y-%m-%d')/site/index.html" ]]; then
    echo "Already built today"
    exit 0
  fi
fi

# Interactive Claude in a tmux window, not `claude -p`: headless sessions do not
# get the Artifact tool, so they cannot republish the page. The window stays
# open afterwards for inspection and is replaced on the next run.
# The prompt must come before --allowedTools, which swallows later arguments.
TMUXBIN=/opt/homebrew/bin/tmux
$TMUXBIN has-session -t claude 2>/dev/null || $TMUXBIN new-session -d -s claude
$TMUXBIN kill-window -t claude:washup 2>/dev/null
$TMUXBIN new-window -d -t claude -n washup -c /Users/Toby_1/Vendo-OS \
  "claude '/creative-washup' --allowedTools 'mcp__claude_ai_Motion_Creative_Analytics__*,mcp__fathom__*,mcp__claude_ai_Google_Calendar__search_events,mcp__claude_ai_Google_Calendar__list_events,Artifact,ToolSearch,Read,Write,Edit,Glob,Grep,Bash(python3 -I scripts/creative-washup/*),Bash(node --env-file=.env.local --import tsx/esm scripts/creative-washup/*),Bash(ls:*),Bash(jq:*),Bash(date:*)'"
echo "Started Claude in tmux window claude:washup"
