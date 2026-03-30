#!/bin/bash
# Vendo-OS — Local Setup Script
# Run this after cloning the repo: bash scripts/setup.sh

set -e

echo "=== Vendo-OS Setup ==="
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
  echo "ERROR: Node.js is not installed."
  echo "Install it: brew install node (Mac) or https://nodejs.org"
  exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  echo "ERROR: Node.js v18+ required. You have v$(node -v)."
  exit 1
fi
echo "[ok] Node.js $(node -v)"

# Install dependencies
echo ""
echo "Installing dependencies..."
npm install --silent
echo "[ok] Dependencies installed"

# Check .env.local
echo ""
if [ -f ".env.local" ]; then
  echo "[ok] .env.local exists"
else
  if [ -f ".env.example" ]; then
    cp .env.example .env.local
    echo "[!!] Created .env.local from template"
    echo "     Open .env.local and fill in your API keys before running scripts."
    echo "     Ask Toby or Max for the shared keys."
  else
    echo "[!!] No .env.example found — create .env.local manually"
  fi
fi

# Set Google Drive credential paths (relative to project root)
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
if grep -q '^GDRIVE_CREDENTIALS_PATH=$' .env.local 2>/dev/null; then
  sed -i '' "s|^GDRIVE_CREDENTIALS_PATH=.*|GDRIVE_CREDENTIALS_PATH=$PROJECT_DIR/.secrets/.gdrive-server-credentials.json|" .env.local
  sed -i '' "s|^GDRIVE_OAUTH_PATH=.*|GDRIVE_OAUTH_PATH=$PROJECT_DIR/.secrets/gcp-oauth.keys.json|" .env.local
  echo "[ok] Google Drive credential paths set"
fi

# Create .secrets directory if it doesn't exist
mkdir -p .secrets
echo "[ok] .secrets/ directory ready"

# Set up shell env loading for MCP servers
SHELL_RC="$HOME/.zshrc"
EXPORT_LINE="# Vendo-OS: load env vars for MCP servers"
if ! grep -q "$EXPORT_LINE" "$SHELL_RC" 2>/dev/null; then
  echo "" >> "$SHELL_RC"
  echo "$EXPORT_LINE" >> "$SHELL_RC"
  echo "[ -f \"$PROJECT_DIR/.env.local\" ] && set -a && source \"$PROJECT_DIR/.env.local\" && set +a" >> "$SHELL_RC"
  echo "[ok] Added env loader to $SHELL_RC"
  echo "     Run 'source ~/.zshrc' or open a new terminal for MCP servers to work"
else
  echo "[ok] Env loader already in $SHELL_RC"
fi

# Initialise database
echo ""
echo "Initialising database..."
npx tsx scripts/utils/db.ts --init
echo "[ok] Database ready"

# Done
echo ""
echo "=== Setup Complete ==="
echo ""
echo "Next steps:"
echo "  1. Fill in API keys in .env.local (if not already done)"
echo "  2. Run: npm run sync:meetings:backfill    (pulls all meeting data, ~10 min)"
echo "  3. Run: npm run process:meetings           (categorises and extracts)"
echo "  4. Start Claude Code: claude"
echo "  5. Inside Claude Code, run: /prime"
echo ""
