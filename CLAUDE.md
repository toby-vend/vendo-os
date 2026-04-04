# CLAUDE.md — AI OS Blueprint

This file is automatically loaded at the start of every Claude Code session. It is the foundation of your AI Operating System.

---

## What This Is

This is an **AI Operating System** — a structured Claude Code project that progressively automates your business operations. It is not a chatbot. It is not a web app. It is the infrastructure layer that sits at the centre of your business, connects to every data source, and builds toward autonomous decision-making.

The goal: **maximise revenue, minimise your personal time investment.** Every system, tool, and decision within this project is evaluated against that filter.

This project is built on **Claude Code** — the most capable AI coding agent available. Combined with the right architecture, it becomes an entirely different beast: a system that understands your business, analyses your data, and progressively earns the autonomy to act on your behalf.

---

## The Architecture — 4 Layers

Your AI OS is built in layers. Each layer depends on the one below it. **You cannot skip layers.**

```
        +-------------------------+
        |       FUNCTION          |  Systems that act
        +-------------------------+
        |         DATA            |  Where you actually are
        +-------------------------+
        |       CONTEXT           |  Who you are / what you do / where you're going
        +-------------------------+
        |        AI OS            |  The foundation (this project)
        +-------------------------+
```

### Layer 1: AI OS (Foundation)
This project. The CLAUDE.md, the commands, the workspace structure. The engine everything else runs on. **You are here.**

### Layer 2: Context
The brain of the system. A set of documents in `context/` that tell the AI everything about your business — your role, your companies, your team, your strategy, your metrics. **This is the most important layer. It is also the one most people skip.**

The founder must build the Context layer themselves. You cannot hand this to a developer or a VA. The system needs to think like you. Your motivations, your decision-making logic, your way of evaluating trade-offs. If you delegate this, you build a system that thinks like someone else.

### Layer 3: Data
Once the system knows who you are and where you're going, you feed it everything. Call transcripts, Slack messages, emails, CRM data, financial data, community posts. All flowing into a searchable database. The AI doesn't just store this data — it understands it. It can search across everything simultaneously, by meaning, not just keywords.

### Layer 4: Function
Systems that do things. A Daily Brief that lands on your phone every morning. A content pipeline. Automated outreach. A decision engine that learns how you think. These are built on top of Context and Data. Without those foundations, functions are just party tricks.

You don't have to build every function from scratch. External tools can plug into your AI OS as specialised brains, and their outputs feed back as data. See `reference/architecture.md` for examples, including how to connect tools via MCP.

**Critical rule: build from the ground up.** Most people jump straight to Function ("I want to automate this task"). But without Context, the system doesn't know why. Without Data, it can't measure if it worked.

---

## The Build Path

Follow this order. Do not skip ahead.

### Phase 1: Context (Start here)
1. Run `/build-context` to populate your context files with Claude's help
2. Or manually fill in each file in `context/` — see guidance in each file
3. **Minimum viable context:** `personal-info.md` and `companies.md` filled in
4. **Full context:** All 6 files populated with real, specific information

### Phase 2: Data
1. Identify your data sources (see `context/integrations.md`)
2. **MCP (zero-code):** Connect services like Airtable, Slack, Supabase, and Google with a JSON config. Claude queries them directly. See `reference/mcp-guide.md`.
3. **Ask Claude to build it:** For services without MCP (Zoom, Stripe, GoHighLevel, etc.), tell Claude what data you want and it will write the sync script for you. See `scripts/README.md`.
4. **Manual upload:** Drop files (CSVs, spreadsheets, transcript exports) into your project and Claude can read them immediately.
5. Start with the highest-value data: meeting transcripts, CRM/sales data, financials

### Phase 3: Function
1. Build systems that act on your Context + Data
2. Start with a Daily Brief — the single most valuable function
3. **Use Cloud Scheduled Tasks** to automate functions (daily briefs, weekly reviews) on Anthropic's infrastructure — no server needed. See `reference/scheduling.md`.
4. **Use Channels** to access your AI OS from Telegram or Discord — talk to your system from your phone. See `reference/channels.md`.
5. Add more functions as your data layer matures
6. See `reference/architecture.md` for the full framework

### Phase 4: Autonomy
1. Start logging decisions with `/decide` from day one
2. The Decision Engine learns how you think over time
3. Progress through the Autonomy Ladder: Inform → Recommend → Confirm → Autonomous
4. See `reference/autonomy-ladder.md` for the framework

---

## Workspace Structure

```
ai-os-blueprint/
├── CLAUDE.md                          # This file — the AI OS brain
├── .claude/
│   ├── commands/                      # Slash commands
│   │   ├── prime.md                   # /prime — session initialisation
│   │   ├── create-plan.md            # /create-plan — plan before building
│   │   ├── implement.md             # /implement — execute a plan
│   │   ├── decide.md                # /decide — log a decision
│   │   └── build-context.md         # /build-context — guided context builder
│   └── skills/                       # Extensible capabilities
│       ├── skill-creator/            # Create custom skills
│       └── mcp-integration/          # Connect external services
├── context/                           # LAYER 2: Context
│   ├── personal-info.md              # Your role, goals, philosophy
│   ├── companies.md                  # Your business(es)
│   ├── team.md                       # Your people
│   ├── strategy.md                   # Your priorities and decision filters
│   ├── current-data.md              # Your metrics and KPIs
│   └── integrations.md              # Your connected services
├── data/                              # LAYER 3: Data
│   └── decisions/                    # Decision journal (created by /decide)
├── scripts/                           # Data sync and function scripts
│   └── README.md                     # Build-path guide
├── plans/                             # Implementation plans
├── outputs/                           # LAYER 4: Function outputs
│   ├── briefs/                       # Daily briefs
│   ├── analyses/                     # Strategic analyses
│   └── decisions/                    # Decision outcome tracking
└── reference/                         # Framework documentation
    ├── architecture.md               # The 4-layer pyramid explained
    ├── autonomy-ladder.md            # Progressive autonomy (4 phases)
    ├── decision-engine.md            # Decision Learning Engine (5 steps)
    ├── mcp-guide.md                  # Connecting data sources (zero-code)
    ├── scheduling.md                 # Automating functions (cloud tasks)
    └── channels.md                   # Mobile access (Telegram/Discord)
```

### Key Directories

| Directory | Layer | Purpose |
|-----------|-------|---------|
| `context/` | Context | Who you are, what you do, where you're going. Read by `/prime`. |
| `data/` | Data | Business data and decision journal. Grows over time. |
| `scripts/` | Data + Function | Sync scripts (pull data in) and function scripts (act on it). |
| `outputs/` | Function | Generated deliverables — briefs, analyses, decisions. |
| `plans/` | — | Implementation plans. Created by `/create-plan`, executed by `/implement`. |
| `reference/` | — | Framework documentation. Read when building new layers. |

---

## Commands

| Command | Purpose | When to Use |
|---------|---------|-------------|
| `/prime` | Initialise session, check layer completion, recommend next action | Start of every session |
| `/build-context` | Guided wizard to populate your context files | When building Layer 2 |
| `/decide [question]` | Log a decision to the decision journal | Any significant business decision |
| `/create-plan [request]` | Create a detailed implementation plan | Before building anything significant |
| `/implement [plan-path]` | Execute a plan step by step | After a plan is approved |

---

## Accessing Your AI OS

Your AI OS lives in Claude Code on your machine. As it matures, you'll want to access it beyond your desk and have it run automatically. There are three ways to interact:

| Method | What It Is | Always-on? | Setup |
|--------|-----------|-----------|-------|
| **Claude Code (terminal/VS Code)** | The primary interface. Full access to everything. | While your session is open | Already done |
| **Channels (Telegram/Discord)** | Message your AI OS from your phone. Claude responds with full access to your project. | Needs a session running | See `reference/channels.md` |
| **Cloud Scheduled Tasks** | Automated functions (daily briefs, syncs) running on Anthropic's cloud. No machine needed. | Yes — Anthropic's servers | See `reference/scheduling.md` |

**The progression:**
1. **Start here:** Claude Code on your machine — build Context, connect Data, create Functions
2. **When you want automation:** Add Cloud Scheduled Tasks — your Daily Brief generates automatically every morning
3. **When you want mobile access:** Add Channels — talk to your AI OS from Telegram on your phone

Each step builds on the last. You don't need all three on day one.

---

## The Decision Engine

From day one, start logging decisions with `/decide`. Every significant business decision — hiring, pricing, strategy shifts, tool choices — gets logged with:

1. **What** the decision was
2. **Why** you chose it (options considered, reasoning)
3. **What you expect** to happen
4. **What actually happened** (reviewed at 30 days)

Over time, patterns emerge. The system learns how you think. This is the foundation for progressive autonomy. See `reference/decision-engine.md` for the full framework.

---

## The Autonomy Ladder

Your AI OS progresses through 4 phases of autonomy:

| Phase | Mode | Description |
|-------|------|-------------|
| 1 | **Inform** | Collect, analyse, present. You read and act. |
| 2 | **Recommend** | Suggest specific actions with rationale. You decide. |
| 3 | **Confirm** | Draft and queue actions. You approve or reject. |
| 4 | **Autonomous** | Execute within guardrails. You oversee. |

**Guardrails (always, even in Phase 4):**
- Financial transactions: ALWAYS require your approval
- External communications to clients/customers: Require approval
- Internal team messages: Can auto-send routine items
- Data queries and analysis: Always autonomous

See `reference/autonomy-ladder.md` for the full framework.

---

## AI Model Selection

Different tasks need different models. Use the right tool for the job:

| Task | Recommended Model | Rationale |
|------|-------------------|-----------|
| Strategic analysis, Daily Brief | Opus | Highest-quality reasoning |
| Meeting summaries, content drafting, communication | Sonnet | Quality/cost balance |
| Message classification, routing, tagging | Haiku | Fast, cheap, simple tasks |

Model IDs: `claude-opus-4-6`, `claude-sonnet-4-6`, `claude-haiku-4-5-20251001`

---

## Working Autonomously

Claude should **always complete tasks itself**. Never tell the user to do something manually that Claude has the tools and access to do. This includes running scripts, querying databases, generating analyses, and executing plans.

If Claude lacks access or credentials for something, ask the user to **grant access** so Claude can do it.

---

## Conventions

- Plans live in `plans/` with dated filenames (`YYYY-MM-DD-descriptive-name.md`)
- Outputs are organised by type in `outputs/`
- Decision logs live in `data/decisions/` with dated filenames
- Keep context files current — stale context limits the system's effectiveness
- Always maintain this file (CLAUDE.md) when making structural changes

---

## Session Workflow

1. **Start**: Run `/prime` to load context and check system status
2. **Build**: Use `/build-context` to populate context files (if incomplete)
3. **Plan**: Use `/create-plan` before significant additions
4. **Execute**: Use `/implement` to execute plans
5. **Decide**: Use `/decide` to log business decisions
6. **Maintain**: Update CLAUDE.md and context files as the workspace evolves

---

## Multi-User Access

This project is shared across the Vendo admin team via a private GitHub repository. Each team member clones the repo and runs their own Claude Code sessions locally.

### How It Works

- **Code, context, and config** are version-controlled in git — changes sync when you push/pull
- **The database** (`data/vendo.db`) is local to each machine — it's rebuilt from APIs (Fathom, GHL) using the sync scripts. It is gitignored.
- **API keys** live in `.env.local` on each machine — never committed. See `.env.example` for the template.

### Git Workflow

```
git pull                    # Always pull first
claude                      # Work in Claude Code
git add <files>             # Stage changes
git commit -m "description" # Commit
git push                    # Share with team
```

- Work on `main` — no branches needed for routine work
- Pull before you start, push when you're done
- If two people edit the same file, git will flag a merge conflict — resolve it and commit

### Meeting Intelligence

Each person has their own local database. To populate or update it:

```bash
npm run sync:meetings:backfill   # First time: pull all history (~10 min)
npm run sync:meetings            # Subsequent: pull new meetings only
npm run process:meetings         # Categorise and extract action items
```

Query the database:
```bash
npm run query -- --stats
npm run query -- --search "lead quality"
npm run query -- --client "Kana Health Group"
npm run query -- --action-items --assignee "Sam Franks" --open
```

### Setup for New Team Members

See `SETUP.md` for full instructions. Quick version:
1. Clone the repo
2. Run `bash scripts/setup.sh`
3. Fill in `.env.local` with API keys (ask Toby or Max)
4. Run `npm run sync:meetings:backfill` to populate the database
5. Start Claude Code and run `/prime`

---

## Getting Started

If this is your first session:

1. Run `/prime` — Claude will read everything and tell you where you stand
2. Run `/build-context` — Claude will walk you through populating your context files
3. Read `reference/architecture.md` to understand the full framework
4. Start logging decisions with `/decide` immediately

The Context layer is your foundation. Everything else is built on top of it. Start there.


---

## RuFlo V3 — Multi-Agent Orchestration

RuFlo is initialised in this project. It provides multi-agent swarm coordination, self-learning hooks, and 99+ specialised agents.

### Key Config Files

| File | Purpose |
|------|---------|
| `.claude/settings.json` | Hooks, permissions, agent config |
| `.claude/agents/` | 99 agent definitions |
| `.claude/skills/` | 30 skills |
| `.claude-flow/config.yaml` | Runtime config |
| `.mcp.json` | MCP server config |

### Swarm Orchestration

- Use hierarchical topology for coding swarms
- Keep maxAgents at 6-8 for tight coordination
- Use specialised strategy for clear role boundaries
- Use `raft` consensus for hive-mind coordination

### CLI Quick Reference

```bash
# Daemon
npx @claude-flow/cli@latest daemon start

# Swarm
npx @claude-flow/cli@latest swarm init --topology hierarchical --max-agents 8 --strategy specialized

# Memory
npx @claude-flow/cli@latest memory search --query "pattern"
npx @claude-flow/cli@latest memory store --key "key" --value "value" --namespace ns

# Health check
npx @claude-flow/cli@latest doctor --fix
```

### 3-Tier Model Routing

| Tier | Handler | Use Cases |
|------|---------|-----------|
| 1 | Agent Booster (WASM) | Simple transforms — skip LLM |
| 2 | Haiku | Simple tasks, low complexity (<30%) |
| 3 | Sonnet/Opus | Complex reasoning, architecture (>30%) |

### Execution Rules

- Use `run_in_background: true` for agent Task calls
- Put ALL agent Task calls in ONE message for parallel execution
- After spawning, STOP — do not poll or check status
- Review ALL results before proceeding
