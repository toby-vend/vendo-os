# Integrations

> This file maps every external service, tool, and data source your business uses. The AI OS uses this to understand what data is available, what can be connected, and what to build sync scripts for.

---

## How This Connects

- **companies.md** describes the businesses these tools serve
- **current-data.md** tracks metrics that come from these integrations
- **This file** maps the data landscape and connection status
- **scripts/README.md** guides you on building sync scripts for these services
- **reference/mcp-guide.md** explains how to connect services via MCP (zero-code alternative to scripts)

---

## Integration Status

### CRM & Sales

| Service | Purpose | Connection Type | Status | Priority |
|---------|---------|----------------|--------|----------|
| GoHighLevel | CRM, pipeline, client comms, automations | MCP | **Connected** | High |

### Project Management

| Service | Purpose | Connection Type | Status | Priority |
|---------|---------|----------------|--------|----------|
| Asana | Task management, team workload | API / MCP | Not connected | Medium |

### Communication

| Service | Purpose | Connection Type | Status | Priority |
|---------|---------|----------------|--------|----------|
| Slack | Internal team communication | MCP | Not connected | Medium |
| Loom | Video walkthroughs, client updates | Manual | Not connected | Low |

### Finance

| Service | Purpose | Connection Type | Status | Priority |
|---------|---------|----------------|--------|----------|
| Xero | Invoicing, P&L, cash flow | API | Not connected | High |

### Ad Platforms

| Service | Purpose | Connection Type | Status | Priority |
|---------|---------|----------------|--------|----------|
| Meta Ads | Paid social campaign management | API | Not connected | High |
| Google Ads | Paid search campaign management | API | Not connected | High |
| Microsoft Ads | Paid search campaign management | API | Not connected | Medium |

### Reporting & Analytics

| Service | Purpose | Connection Type | Status | Priority |
|---------|---------|----------------|--------|----------|
| Looker Studio | Client dashboards, reporting | Manual | Not connected | Medium |
| Agency Analytics | Client reporting platform | API | Not connected | Medium |
| Triple Whale | Ecommerce attribution and analytics | API | Not connected | Medium |

### AI & Productivity

| Service | Purpose | Connection Type | Status | Priority |
|---------|---------|----------------|--------|----------|
| Fathom | Meeting transcription and notes | MCP | **Connected** | Medium |
| Motion | AI scheduling and task prioritisation | Manual | Not connected | Low |

### SEO

| Service | Purpose | Connection Type | Status | Priority |
|---------|---------|----------------|--------|----------|
| Ahrefs | SEO research, backlink analysis, rank tracking | API | Not connected | Medium |

### Ecommerce

| Service | Purpose | Connection Type | Status | Priority |
|---------|---------|----------------|--------|----------|
| Shopify | Ecommerce client stores | API | Not connected | Medium |

### Web / Hosting

| Service | Purpose | Connection Type | Status | Priority |
|---------|---------|----------------|--------|----------|
| Frame (Framer) | Website design and hosting | Manual | Not connected | Low |
| SiteGround | Web hosting | Manual | Not connected | Low |

---

## Connection Priority Order

1. **Xero** — Revenue and profit data feeds directly into the £2M / 25% margin targets
2. **GoHighLevel** — Pipeline and client data, sales function being built
3. **Meta Ads / Google Ads** — Core delivery platforms, performance data
4. **Slack** — MCP connection available, team communication context
5. **Asana** — Team workload and project status
6. **Ahrefs** — SEO team delivery data
7. **Everything else** — Connect as data layer matures

---

## Environment Variables

Store API keys in `.env.local` (gitignored, never committed):

```bash
# Finance
XERO_CLIENT_ID=
XERO_CLIENT_SECRET=

# CRM
GHL_API_KEY=

# Ad Platforms
META_ACCESS_TOKEN=
GOOGLE_ADS_DEVELOPER_TOKEN=
MICROSOFT_ADS_CLIENT_ID=

# Reporting
AGENCY_ANALYTICS_API_KEY=
TRIPLE_WHALE_API_KEY=

# SEO
AHREFS_API_KEY=

# Ecommerce
SHOPIFY_API_KEY=

# Communication
SLACK_BOT_TOKEN=

# AI
ANTHROPIC_API_KEY=
```

---

_Update this as you add or change tools. This is the roadmap for your Data layer._
