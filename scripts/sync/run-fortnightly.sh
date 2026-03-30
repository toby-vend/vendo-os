#!/bin/bash
# Fortnightly Fathom meeting sync and processing
# Runs via macOS launchd every 2 weeks

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
LOG_FILE="$PROJECT_DIR/data/sync.log"

cd "$PROJECT_DIR"

# Load environment
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
while IFS='=' read -r key value; do
  # Skip empty lines and comments
  [[ -z "$key" || "$key" =~ ^# ]] && continue
  # Strip leading/trailing whitespace
  key="$(echo "$key" | xargs)"
  # Export only if key is a valid variable name and value is non-empty
  if [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ && -n "$value" ]]; then
    export "$key=$value"
  fi
done < "$PROJECT_DIR/.env.local"

echo "=== Fathom Sync: $(date -u '+%Y-%m-%dT%H:%M:%SZ') ===" >> "$LOG_FILE"

# Step 1: Sync new meetings from Fathom
echo "[1/2] Syncing meetings..." >> "$LOG_FILE"
npx tsx scripts/sync/sync-meetings.ts >> "$LOG_FILE" 2>&1

# Step 2: Process and generate report
echo "[2/2] Processing meetings..." >> "$LOG_FILE"
npx tsx scripts/analysis/process-meetings.ts >> "$LOG_FILE" 2>&1

echo "=== Complete: $(date -u '+%Y-%m-%dT%H:%M:%SZ') ===" >> "$LOG_FILE"
echo "" >> "$LOG_FILE"
