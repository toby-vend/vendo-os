# Channels — Mobile Access to Your AI OS

> This guide explains how to access your AI OS from your phone via Telegram or Discord. Channels are the bridge between your AI OS and your daily life — ask questions, get briefs, search data, and make decisions from anywhere.

---

## The Vision

Your AI OS sits on your computer. But you're not always at your computer. You're in meetings, on the move, or away from your desk when a question hits you:

- "What was the close rate last week?"
- "Give me today's brief."
- "Search my meeting notes for what we discussed about pricing."
- "Log a decision: I'm hiring a second account manager."

**Channels** let you message your AI OS from Telegram or Discord, and get intelligent responses powered by your full project — your CLAUDE.md, your context files, your data connections, everything. It's not a chatbot with canned responses. It's Claude Code, with your entire AI OS loaded, responding to natural language.

---

## What Channels Are

Claude Code Channels are a feature that connects messaging apps (Telegram, Discord) to a running Claude Code session. When you send a message to your Telegram bot, it arrives inside your Claude Code session. Claude processes it with full access to your project, then sends the response back to Telegram.

**Key distinction:** This is not a separate app or a simplified version of your AI OS. It's your actual AI OS, accessed through a messaging app. Claude has access to everything it would have if you typed the same question in your terminal.

---

## Current State (March 2026)

Channels launched as a **research preview** in March 2026. Here's an honest assessment of where things stand:

**What works:**
- Telegram and Discord are both supported
- Full access to your project files, MCP servers, and tools
- Natural language — no special commands needed
- Claude can read your context, query your data, and generate outputs
- Permission relay — approve/deny tool use from your phone

**Current limitations:**
- **Requires a running session.** Claude Code must be actively running on a machine (your laptop, a VPS, or a server) for Channels to work. If the session dies, the bot goes offline.
- **No message queue.** Messages sent while the session is offline are lost. There's no "catch up" when it comes back online.
- **Research preview.** The feature is actively being developed. Expect improvements, but also expect rough edges.

**What this means practically:** Channels work well when you're at your desk with Claude Code running and want to also interact from your phone. They're not yet a reliable "always-on" mobile assistant — that requires keeping a session running 24/7 on a server, which is an advanced setup.

---

## How It Will Work

When you're ready to set up Channels, the process is straightforward:

### Step 1: Create a Telegram Bot

1. Open Telegram and message @BotFather
2. Send `/newbot` and follow the prompts
3. Choose a name (e.g., "My AI OS")
4. Copy the bot token you receive

### Step 2: Save the Token

Add your bot token to `.env.local`:

```bash
TELEGRAM_BOT_TOKEN=your_token_here
```

### Step 3: Install the Telegram Plugin

In Claude Code:

```
/plugin install telegram@claude-plugins-official
```

### Step 4: Configure

```
/telegram:configure your_token_here
```

### Step 5: Launch with Channels

Start Claude Code with the Channels flag:

```bash
claude --channels plugin:telegram@claude-plugins-official
```

### Step 6: Pair Your Account

Send any message to your bot in Telegram. Claude Code will show a pairing code. Run the pairing command to link your Telegram account.

After pairing, your Telegram bot is your AI OS. Ask it anything.

---

## What This Unlocks

With Channels active, you interact with your AI OS through natural conversation:

**Instead of hardcoded commands**, you use natural language:
- "What's happening across the business today?" → Claude reads your context and data, generates a summary
- "Find all meetings from last week about client onboarding" → Claude searches your meeting data
- "Draft a follow-up email to the team about the pricing decision" → Claude drafts using your communication style from context
- "/decide I'm switching our CRM from HubSpot to Close" → Claude logs the decision with full context

**The power is that Claude has your entire AI OS loaded.** Your context files tell it who you are and what matters. Your MCP connections give it live data. Your decision history gives it your thinking patterns. The response isn't generic — it's tailored to your business.

---

## The Roadmap

Anthropic is developing Claude Code at a rapid pace. Based on the trajectory:

**Near-term (likely):**
- Improved stability and reconnection handling
- Message queuing (catch up on messages sent while offline)
- Better permission handling for mobile approval flows

**Medium-term (possible):**
- Cloud-hosted Channels (no local machine needed — similar to Cloud Scheduled Tasks)
- Multi-project routing (one bot for multiple AI OS projects)
- Richer message formatting (tables, charts, file attachments)

**The pattern to watch:** Cloud Scheduled Tasks already run on Anthropic's servers without your machine. When Channels gets the same treatment, you'll have a truly always-on AI OS accessible from your phone. The architecture you build today will carry forward.

---

## What to Do Now

Even if you're not ready to set up Channels today, you can prepare:

1. **Create a Telegram bot** via @BotFather — it takes 30 seconds. Save the token in your `.env.local`. You'll need it when you're ready.

2. **Build your Context layer** — The better your context files, the better Channels will be when you enable it. A well-built AI OS gives intelligent, business-specific responses. A bare one gives generic answers.

3. **Connect data via MCP** — Every MCP connection you set up now is automatically available through Channels later. Connect Airtable today, query it from Telegram tomorrow.

4. **Watch for updates** — Channels is in active development. Check Claude Code release notes for improvements to stability, queuing, and hosting.

The foundation you build now — context, data connections, decision history — is what makes Channels powerful when you turn it on. The AI OS does the heavy lifting. Channels is just the access point.

---

_Channels are the future of how you'll interact with your AI OS daily. Build the foundation now. The access layer is catching up fast._
