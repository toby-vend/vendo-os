# Connecting Data Sources with MCP

> This guide explains how to plug external services directly into your AI OS — no code required. MCP is the fastest way to build your Data layer.

---

## What Is MCP?

MCP (Model Context Protocol) is a standard way to connect external services to Claude Code. Think of it like plugging a USB cable between your AI OS and your business tools. Once connected, Claude can read your CRM data, search your Slack messages, query your database, and pull from your Google Drive — all without you writing a single line of code.

Before MCP, connecting a service meant writing a sync script: authenticate, pull data, store it, handle errors. MCP replaces that with a JSON configuration file. You tell Claude Code where the service is and how to authenticate. Claude handles the rest.

---

## How It Works

MCP connections are configured in a file called `.mcp.json` in your project root. Each entry defines a service, its address, and how to authenticate.

**The pattern:**

```json
{
  "mcpServers": {
    "service-name": {
      "url": "https://mcp.service.com/endpoint",
      "headers": {
        "Authorization": "Bearer ${YOUR_API_TOKEN}"
      }
    }
  }
}
```

API tokens and credentials go in your `.env.local` file (which is gitignored — never committed to version control). The `${YOUR_API_TOKEN}` syntax tells Claude Code to read the value from your environment.

**That's it.** Create the file, add your tokens, and Claude can talk to the service directly.

---

## Common Services for Agency Owners

These services have MCP servers available. You don't need all of them — start with the ones you actually use.

### Team Communication
| Service | What It Gives Your AI OS | Setup |
|---------|------------------------|-------|
| **Slack** | Team messages, client channels, communication patterns | Easy — official connector |

### SOP & Knowledge Library
| Service | What It Gives Your AI OS | Setup |
|---------|------------------------|-------|
| **Google Drive** | SOPs, documents, meeting transcripts, shared files | Moderate — requires OAuth |
| **Notion** | Knowledge bases, wikis, project docs | Easy — official MCP server |

### CRM & Sales
| Service | What It Gives Your AI OS | Setup |
|---------|------------------------|-------|
| **Airtable** | CRM data, pipeline, client records, sales tracking | Easy — official MCP server |

### Scheduling
| Service | What It Gives Your AI OS | Setup |
|---------|------------------------|-------|
| **Google Calendar** | Meetings, scheduling, availability | Moderate — requires OAuth |

### External Brains
| Service | What It Gives Your AI OS | Setup |
|---------|------------------------|-------|
| **AgencyOSX** | 15 AI employees for agency operations | Easy — see `reference/architecture.md` |

**Don't see your tool?** MCP is one of three ways to connect data. For services without MCP (Zoom, GoHighLevel, Stripe, Calendly), ask Claude to build a sync script. For files (spreadsheets, transcript exports), drop them into your project. See `scripts/README.md` for those approaches.

**Note:** The MCP ecosystem is growing fast. If your tool isn't listed here, search for "[tool name] MCP server" — there's a good chance one exists or is coming soon.

---

## Setting Up Your First MCP Connection

Let's connect Airtable as an example — most agency owners use it or something similar for CRM/project data.

### Step 1: Get Your API Token

Log in to your service and generate an API token:
- **Airtable:** https://airtable.com/create/tokens → Create personal access token with `data.records:read` scope
- **Supabase:** Project Settings → API → Copy the `service_role` key
- **Slack:** https://api.slack.com/apps → Create app → OAuth & Permissions → Bot User OAuth Token

### Step 2: Add the Token to `.env.local`

Create a `.env.local` file in your project root (if it doesn't exist) and add your token:

```bash
# .env.local — never commit this file
AIRTABLE_API_KEY=pat_xxxxxxxxxxxx
```

### Step 3: Create `.mcp.json`

Create a `.mcp.json` file in your project root:

```json
{
  "mcpServers": {
    "airtable": {
      "url": "https://mcp.airtable.com/v2",
      "headers": {
        "Authorization": "Bearer ${AIRTABLE_API_KEY}"
      }
    }
  }
}
```

### Step 4: Restart Claude Code

MCP servers connect when Claude Code starts. After creating or changing `.mcp.json`, restart your session. Run `/mcp` to verify the connection — you should see your service listed.

### Step 5: Use It

Now you can ask Claude things like:
- "Show me all deals in my Airtable pipeline from this month"
- "What's my close rate for the last 30 days?"
- "Find all clients who haven't been contacted in 2 weeks"

Claude reads your Context layer (it knows your business), queries the service via MCP (it has your data), and gives you an intelligent answer. That's the Data layer working.

---

## Adding Multiple Services

Your `.mcp.json` can hold as many services as you need:

```json
{
  "mcpServers": {
    "airtable": {
      "url": "https://mcp.airtable.com/v2",
      "headers": {
        "Authorization": "Bearer ${AIRTABLE_API_KEY}"
      }
    },
    "supabase": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@supabase/mcp-server", "--supabase-url", "${SUPABASE_URL}", "--supabase-key", "${SUPABASE_SERVICE_ROLE_KEY}"]
    },
    "agencyosx": {
      "url": "https://app.agencyosx.ai/api/mcp",
      "headers": {
        "Authorization": "Bearer ${AGENCYOSX_API_TOKEN}"
      }
    }
  }
}
```

Each service needs its own token in `.env.local`. Add services one at a time — test each one works before adding the next.

---

## How MCP Feeds Your Data Layer

MCP doesn't replace your Data layer — it *is* one way to build it. Here's how it fits the architecture:

```
Your AI OS asks a question
    |
    Claude reads your CONTEXT (knows your business)
    |
    Claude queries your services via MCP (gets real DATA)
    |
    Claude synthesises an intelligent answer (FUNCTION)
```

**Without MCP**, you'd need sync scripts to pull data into a local database, then query that database. MCP skips the middleman — Claude queries the service directly, in real time.

**The trade-off:** MCP gives you live access but no local copy. Sync scripts give you a local database you can search, embed, and process. Both approaches build your Data layer. See the comparison below.

---

## MCP vs Other Methods — When to Use Which

| | MCP (Zero-Code) | Ask Claude to Build It | Manual Upload |
|---|---|---|---|
| **Setup time** | Minutes | One session | Instant |
| **Coding required** | None | None — Claude writes it | None |
| **Data access** | Live queries to the service | Local copy in your database | Files on disk |
| **Best for** | Services with MCP servers | Any service with an API | Spreadsheets, exports, files |
| **Examples** | Airtable, Slack, Google, Notion | Zoom, Stripe, GoHighLevel, Calendly | CSVs, transcript files, reports |

**The recommended path:**

1. **Use MCP where available** — Connect services that have MCP servers. Get data flowing immediately.
2. **Ask Claude for everything else** — For services without MCP, tell Claude what data you want and it builds the integration for you. You don't need to know how APIs work.
3. **Drop files in when it's simplest** — CSV exports, spreadsheet downloads, transcript files. Just put them in your project and tell Claude they're there.
4. **Mix and match** — Use MCP for live Airtable queries, a Claude-built script for Zoom transcripts, and manual upload for your P&L spreadsheet. Whatever works.

---

## Troubleshooting

**"Server not connecting"**
- Check your `.mcp.json` syntax — it must be valid JSON
- Verify your API token is correct in `.env.local`
- Restart Claude Code after any `.mcp.json` changes
- Run `/mcp` to see connection status

**"Permission denied" or "Unauthorized"**
- Check your API token has the right scopes/permissions
- Some services need specific permissions enabled (e.g., Airtable needs `data.records:read`)
- Regenerate the token if it's expired

**"Can't find the MCP server for my tool"**
- Search: "[tool name] MCP server"
- Check https://modelcontextprotocol.io for the official directory
- If none exists, you'll need the sync script approach — ask Claude to help you build one

---

_MCP is the fastest way to build your Data layer. Start with one service, prove it works, then expand. Every connection makes your AI OS smarter._
