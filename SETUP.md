# Setting Up Vendo-OS on Your Machine

This guide gets you from zero to a working Vendo-OS environment. Follow it step by step.

---

## Prerequisites

You need these installed before starting:

| Tool | Why | Install |
|------|-----|---------|
| **Node.js** (v18+) | Runs the sync and query scripts | [nodejs.org](https://nodejs.org) or `brew install node` |
| **Git** | Syncs code between team members | [git-scm.com](https://git-scm.com) or `brew install git` |
| **Claude Code** | The AI interface to the OS | [claude.ai/code](https://claude.ai/code) — needs an Anthropic account |

Check they're installed:
```bash
node --version    # Should be 18+
git --version     # Any recent version
claude --version  # Confirms Claude Code is installed
```

---

## Step 1: Clone the Repository

```bash
git clone git@github.com:toby-vend/vendo-os.git
cd vendo-os
```

Or if you prefer HTTPS:
```bash
git clone https://github.com/toby-vend/vendo-os.git
cd vendo-os
```

---

## Step 2: Run the Setup Script

```bash
bash scripts/setup.sh
```

This will:
- Install Node dependencies
- Create your `.env.local` from the template (if it doesn't exist)
- Initialise the database schema

---

## Step 3: Add Your API Keys

Open `.env.local` in any text editor and fill in the values. Ask Toby or Max for the shared keys.

The keys that matter right now:
- `FATHOM_API_KEY` — needed for meeting intelligence
- `GHL_API_KEY` + `GHL_LOCATION_ID` — needed for pipeline data
- `SLACK_BOT_TOKEN` + `SLACK_TEAM_ID` — needed for Slack MCP

The setup script automatically:
- Sets `GDRIVE_CREDENTIALS_PATH` and `GDRIVE_OAUTH_PATH` to point to your local `.secrets/` directory
- Adds an env loader to your `~/.zshrc` so MCP servers can read these variables

Leave the rest blank until those integrations are built.

---

## Step 3b: Set Up MCP Servers

MCP servers (Slack, GoHighLevel, Google Drive) are configured in `.mcp.json` and shared via git. They read API keys from your shell environment, which the setup script loads from `.env.local`.

**After setup, reload your shell:**
```bash
source ~/.zshrc
```

**For Google Drive access**, you also need credential files in `.secrets/`:
1. Get the credential files from Toby (two JSON files)
2. Place them in `.secrets/`:
   - `.secrets/.gdrive-server-credentials.json`
   - `.secrets/gcp-oauth.keys.json`
3. The `.secrets/` directory is gitignored — credentials stay on your machine only

**To verify MCP servers are working**, start Claude Code and check that Slack, GoHighLevel, and Google Drive tools appear in the tool list.

---

## Step 4: Populate the Meeting Database

This pulls all historical meetings from Fathom into your local database. Takes about 10 minutes on first run.

```bash
npm run sync:meetings:backfill
npm run process:meetings
```

After this, you can search meeting history:
```bash
npm run query -- --stats              # Overview
npm run query -- --search "pricing"   # Search transcripts
npm run query -- --client "APS"       # Client history
```

---

## Step 5: Start Using Claude Code

```bash
claude
```

Once inside, run `/prime` to initialise your session. Claude will read all context files and tell you the current state of the system.

---

## Daily Workflow

```bash
git pull                   # Get latest changes from the team
claude                     # Start your session
# ... do your work ...
git add .                  # Stage your changes
git commit -m "description of what you did"
git push                   # Share with the team
```

**Always pull before you start working.** This avoids merge conflicts.

---

## Keeping Data Fresh

Your meeting database is local to your machine. To pull new meetings:

```bash
npm run sync:meetings       # Pulls meetings since last sync
npm run process:meetings    # Categorises and extracts action items
```

Run this weekly or fortnightly — or whenever you want the latest data.

---

## Useful Commands

| Command | What it does |
|---------|-------------|
| `npm run sync:meetings` | Pull new meetings from Fathom |
| `npm run sync:meetings:backfill` | Pull ALL meetings (first-time setup) |
| `npm run process:meetings` | Categorise meetings, extract action items |
| `npm run query -- --stats` | Database overview |
| `npm run query -- --search "term"` | Search across all meeting content |
| `npm run query -- --client "Name"` | View client meeting history |
| `npm run query -- --action-items --assignee "Name" --open` | View someone's action items |
| `npm run query -- --clients` | List all clients |
| `npm run db:init` | Recreate database schema (if needed) |

---

## Troubleshooting

**"FATHOM_API_KEY not set"** — Your `.env.local` is missing or the key is empty. Check the file exists and has values.

**"npm: command not found"** — Node.js isn't installed. Run `brew install node` (Mac) or download from nodejs.org.

**Database is empty after sync** — Check your Fathom API key is correct. Try `npm run sync:meetings:backfill` for a full pull.

**Merge conflict on a context file** — This happens when two people edit the same file. Open the file, look for `<<<<<<<` markers, pick the right version, commit.

---

## Encrypted Files (git-crypt)

Some files in this repo are encrypted at rest — they appear as binary gibberish on GitHub and to anyone without an authorised GPG key. This protects financial data, briefs, and strategic analyses.

### Encrypted files:
- `context/current-data.md` — revenue metrics and KPIs
- `outputs/briefs/` — daily briefs
- `outputs/analyses/` — strategic analyses
- `outputs/decisions/` — decision outcomes
- `data/decisions/` — decision journal

### If Toby has granted you access:

1. **Install git-crypt and GPG:**
   ```bash
   brew install git-crypt gnupg
   ```

2. **Generate your GPG key** (if you don't have one):
   ```bash
   gpg --full-generate-key
   ```
   Choose RSA 4096-bit, enter your name and work email.

3. **Send Toby your public key:**
   ```bash
   gpg --export --armor your@email.com > my-key.pub
   ```
   Send `my-key.pub` to Toby via Slack or email.

4. **Once Toby adds you**, pull and unlock:
   ```bash
   git pull
   git-crypt unlock
   ```
   This is a one-time step — files stay decrypted in your working copy from then on.

### If you do NOT have access:

Everything else in the repo works normally. You just won't be able to read the encrypted files — they'll appear as binary data. This doesn't affect scripts, commands, or other context files.

### Granting access (Toby only):

```bash
# Import the team member's public key
gpg --import their-key.pub

# Trust it
gpg --edit-key their@email.com   # then type: trust > 5 > quit

# Add them to git-crypt
git-crypt add-gpg-user their@email.com

# Push the change
git push
```

### Revoking access:

git-crypt doesn't support direct revocation. If someone leaves:
1. Rotate the git-crypt key: `git-crypt lock && git-crypt init`
2. Re-add all remaining authorised users
3. Rotate any API keys they had access to

---

## What NOT to Do

- **Don't edit `.env.local` on someone else's machine** — each person manages their own
- **Don't commit `.env.local`** — it contains API keys and is gitignored for a reason
- **Don't share the `data/vendo.db` file via git** — it's gitignored; each person builds their own
- **Don't force-push to main** — always pull first, resolve conflicts locally
