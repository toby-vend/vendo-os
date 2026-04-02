import initSqlJs, { type Database } from 'sql.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '../..');
const DB_PATH = resolve(PROJECT_ROOT, 'data/vendo.db');

let _db: Database | null = null;

export async function getDb(): Promise<Database> {
  if (_db) return _db;

  const SQL = await initSqlJs();
  const dbDir = dirname(DB_PATH);
  if (!existsSync(dbDir)) mkdirSync(dbDir, { recursive: true });

  if (existsSync(DB_PATH)) {
    const buffer = readFileSync(DB_PATH);
    _db = new SQL.Database(buffer);
  } else {
    _db = new SQL.Database();
  }

  _db.run('PRAGMA journal_mode = WAL');
  _db.run('PRAGMA foreign_keys = ON');
  return _db;
}

export function saveDb(): void {
  if (!_db) return;
  const data = _db.export();
  const buffer = Buffer.from(data);
  writeFileSync(DB_PATH, buffer);
}

export function closeDb(): void {
  if (_db) {
    saveDb();
    _db.close();
    _db = null;
  }
}

export async function initSchema(): Promise<void> {
  const db = await getDb();

  db.run(`
    CREATE TABLE IF NOT EXISTS meetings (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      date TEXT NOT NULL,
      duration_seconds INTEGER,
      url TEXT,
      summary TEXT,
      transcript TEXT,
      attendees TEXT,
      raw_action_items TEXT,
      synced_at TEXT NOT NULL,
      processed_at TEXT,
      category TEXT,
      client_name TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS action_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      meeting_id TEXT NOT NULL REFERENCES meetings(id),
      description TEXT NOT NULL,
      assignee TEXT,
      completed INTEGER DEFAULT 0,
      created_at TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      xero_contact_id TEXT,
      email TEXT,
      aliases TEXT,
      vertical TEXT,
      status TEXT DEFAULT 'active',
      source TEXT DEFAULT 'xero',
      total_invoiced REAL DEFAULT 0,
      outstanding REAL DEFAULT 0,
      first_invoice_date TEXT,
      last_invoice_date TEXT,
      first_meeting_date TEXT,
      last_meeting_date TEXT,
      meeting_count INTEGER DEFAULT 0
    )
  `);

  // Migrate: add new columns if upgrading from old schema
  try { db.run('ALTER TABLE clients ADD COLUMN xero_contact_id TEXT'); } catch { /* already exists */ }
  try { db.run('ALTER TABLE clients ADD COLUMN email TEXT'); } catch { /* already exists */ }
  try { db.run('ALTER TABLE clients ADD COLUMN source TEXT DEFAULT \'xero\''); } catch { /* already exists */ }
  try { db.run('ALTER TABLE clients ADD COLUMN total_invoiced REAL DEFAULT 0'); } catch { /* already exists */ }
  try { db.run('ALTER TABLE clients ADD COLUMN outstanding REAL DEFAULT 0'); } catch { /* already exists */ }
  try { db.run('ALTER TABLE clients ADD COLUMN first_invoice_date TEXT'); } catch { /* already exists */ }
  try { db.run('ALTER TABLE clients ADD COLUMN last_invoice_date TEXT'); } catch { /* already exists */ }

  // Migrate: waterfall matcher columns on meetings
  try { db.run('ALTER TABLE meetings ADD COLUMN match_method TEXT'); } catch { /* already exists */ }
  try { db.run('ALTER TABLE meetings ADD COLUMN match_confidence TEXT'); } catch { /* already exists */ }
  try { db.run('ALTER TABLE meetings ADD COLUMN calendar_invitees TEXT'); } catch { /* already exists */ }
  try { db.run('ALTER TABLE meetings ADD COLUMN invitee_domains_type TEXT'); } catch { /* already exists */ }
  try { db.run('ALTER TABLE meetings ADD COLUMN needs_review INTEGER DEFAULT 0'); } catch { /* already exists */ }

  db.run(`
    CREATE TABLE IF NOT EXISTS key_decisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      meeting_id TEXT NOT NULL REFERENCES meetings(id),
      description TEXT NOT NULL,
      context TEXT,
      created_at TEXT NOT NULL
    )
  `);

  // --- Waterfall matcher tables ---

  db.run(`
    CREATE TABLE IF NOT EXISTS contact_email_domains (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      domain TEXT NOT NULL,
      client_name TEXT NOT NULL,
      source TEXT NOT NULL,
      contact_email TEXT,
      created_at TEXT NOT NULL,
      UNIQUE(domain, client_name)
    )
  `);

  db.run('CREATE INDEX IF NOT EXISTS idx_ced_domain ON contact_email_domains(domain)');

  db.run(`
    CREATE TABLE IF NOT EXISTS meeting_match_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      meeting_id TEXT NOT NULL REFERENCES meetings(id),
      client_name TEXT,
      method TEXT NOT NULL,
      confidence TEXT NOT NULL,
      evidence TEXT,
      created_at TEXT NOT NULL,
      UNIQUE(meeting_id)
    )
  `);

  db.run('CREATE INDEX IF NOT EXISTS idx_mml_meeting ON meeting_match_log(meeting_id)');

  db.run(`
    CREATE TABLE IF NOT EXISTS sync_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      meetings_fetched INTEGER DEFAULT 0,
      meetings_new INTEGER DEFAULT 0,
      meetings_updated INTEGER DEFAULT 0,
      status TEXT DEFAULT 'running',
      error TEXT,
      last_cursor TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS meeting_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT UNIQUE NOT NULL,
      label TEXT NOT NULL,
      keywords TEXT
    )
  `);

  // --- Xero tables ---

  db.run(`
    CREATE TABLE IF NOT EXISTS xero_invoices (
      id TEXT PRIMARY KEY,
      invoice_number TEXT,
      type TEXT NOT NULL,
      contact_id TEXT,
      contact_name TEXT,
      date TEXT,
      due_date TEXT,
      status TEXT,
      subtotal REAL,
      total_tax REAL,
      total REAL,
      amount_due REAL,
      amount_paid REAL,
      currency TEXT,
      reference TEXT,
      updated_at TEXT,
      synced_at TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS xero_contacts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT,
      is_customer INTEGER DEFAULT 0,
      is_supplier INTEGER DEFAULT 0,
      status TEXT,
      outstanding_receivable REAL DEFAULT 0,
      overdue_receivable REAL DEFAULT 0,
      outstanding_payable REAL DEFAULT 0,
      overdue_payable REAL DEFAULT 0,
      updated_at TEXT,
      synced_at TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS xero_pnl_monthly (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      period_start TEXT NOT NULL,
      period_end TEXT NOT NULL,
      total_income REAL,
      total_cost_of_sales REAL,
      gross_profit REAL,
      total_expenses REAL,
      net_profit REAL,
      raw_report TEXT,
      synced_at TEXT NOT NULL,
      UNIQUE(period_start, period_end)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS xero_bank_summary (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_name TEXT NOT NULL,
      opening_balance REAL,
      closing_balance REAL,
      period_start TEXT,
      period_end TEXT,
      synced_at TEXT NOT NULL
    )
  `);

  db.run('CREATE INDEX IF NOT EXISTS idx_xero_invoices_date ON xero_invoices(date)');
  db.run('CREATE INDEX IF NOT EXISTS idx_xero_invoices_status ON xero_invoices(status)');
  db.run('CREATE INDEX IF NOT EXISTS idx_xero_invoices_type ON xero_invoices(type)');
  db.run('CREATE INDEX IF NOT EXISTS idx_xero_invoices_contact ON xero_invoices(contact_name)');
  db.run('CREATE INDEX IF NOT EXISTS idx_xero_contacts_customer ON xero_contacts(is_customer)');
  db.run('CREATE INDEX IF NOT EXISTS idx_xero_pnl_period ON xero_pnl_monthly(period_start)');

  // --- Meta Ads tables ---

  db.run(`
    CREATE TABLE IF NOT EXISTS meta_ad_accounts (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      name TEXT,
      account_status INTEGER,
      currency TEXT,
      timezone_name TEXT,
      synced_at TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS meta_insights (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      account_id TEXT NOT NULL,
      account_name TEXT,
      level TEXT NOT NULL,
      campaign_id TEXT,
      campaign_name TEXT,
      adset_id TEXT,
      adset_name TEXT,
      ad_id TEXT,
      ad_name TEXT,
      impressions INTEGER DEFAULT 0,
      clicks INTEGER DEFAULT 0,
      spend REAL DEFAULT 0,
      cpc REAL,
      cpm REAL,
      ctr REAL,
      reach INTEGER,
      frequency REAL,
      conversions TEXT,
      conversion_values TEXT,
      actions TEXT,
      cost_per_action TEXT,
      synced_at TEXT NOT NULL,
      UNIQUE(date, account_id, level, campaign_id, adset_id, ad_id)
    )
  `);

  db.run('CREATE INDEX IF NOT EXISTS idx_meta_insights_date ON meta_insights(date)');
  db.run('CREATE INDEX IF NOT EXISTS idx_meta_insights_account ON meta_insights(account_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_meta_insights_level ON meta_insights(level)');
  db.run('CREATE INDEX IF NOT EXISTS idx_meta_insights_campaign ON meta_insights(campaign_id)');

  // --- Meta Ad Library (competitor research) ---

  db.run(`
    CREATE TABLE IF NOT EXISTS meta_ad_library (
      id TEXT PRIMARY KEY,
      page_id TEXT NOT NULL,
      page_name TEXT NOT NULL,
      body TEXT,
      link_title TEXT,
      link_description TEXT,
      link_caption TEXT,
      ad_delivery_start TEXT,
      ad_delivery_stop TEXT,
      snapshot_url TEXT,
      languages TEXT,
      platforms TEXT,
      audience_lower INTEGER,
      audience_upper INTEGER,
      search_term TEXT,
      synced_at TEXT NOT NULL
    )
  `);

  db.run('CREATE INDEX IF NOT EXISTS idx_meta_adlib_page ON meta_ad_library(page_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_meta_adlib_start ON meta_ad_library(ad_delivery_start)');
  db.run('CREATE INDEX IF NOT EXISTS idx_meta_adlib_search ON meta_ad_library(search_term)');

  // --- Google Ads tables ---

  db.run(`
    CREATE TABLE IF NOT EXISTS gads_accounts (
      id TEXT PRIMARY KEY,
      descriptive_name TEXT,
      currency_code TEXT,
      time_zone TEXT,
      manager_id TEXT,
      status TEXT,
      synced_at TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS gads_campaign_spend (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      account_id TEXT NOT NULL,
      account_name TEXT,
      campaign_id TEXT NOT NULL,
      campaign_name TEXT,
      campaign_status TEXT,
      spend_micros INTEGER DEFAULT 0,
      spend REAL DEFAULT 0,
      impressions INTEGER DEFAULT 0,
      clicks INTEGER DEFAULT 0,
      synced_at TEXT NOT NULL,
      UNIQUE(date, account_id, campaign_id)
    )
  `);

  db.run('CREATE INDEX IF NOT EXISTS idx_gads_spend_date ON gads_campaign_spend(date)');
  db.run('CREATE INDEX IF NOT EXISTS idx_gads_spend_account ON gads_campaign_spend(account_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_gads_spend_campaign ON gads_campaign_spend(campaign_id)');

  // --- GHL (GoHighLevel) tables ---

  db.run(`
    CREATE TABLE IF NOT EXISTS ghl_pipelines (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      location_id TEXT NOT NULL,
      synced_at TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS ghl_stages (
      id TEXT PRIMARY KEY,
      pipeline_id TEXT NOT NULL REFERENCES ghl_pipelines(id),
      name TEXT NOT NULL,
      position INTEGER DEFAULT 0,
      synced_at TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS ghl_opportunities (
      id TEXT PRIMARY KEY,
      name TEXT,
      monetary_value REAL DEFAULT 0,
      pipeline_id TEXT NOT NULL,
      stage_id TEXT NOT NULL,
      status TEXT NOT NULL,
      source TEXT,
      contact_id TEXT,
      contact_name TEXT,
      contact_company TEXT,
      contact_email TEXT,
      contact_phone TEXT,
      contact_tags TEXT,
      created_at TEXT,
      updated_at TEXT,
      last_stage_change_at TEXT,
      synced_at TEXT NOT NULL
    )
  `);

  db.run('CREATE INDEX IF NOT EXISTS idx_ghl_opps_pipeline ON ghl_opportunities(pipeline_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_ghl_opps_stage ON ghl_opportunities(stage_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_ghl_opps_status ON ghl_opportunities(status)');
  db.run('CREATE INDEX IF NOT EXISTS idx_ghl_opps_created ON ghl_opportunities(created_at)');
  db.run('CREATE INDEX IF NOT EXISTS idx_ghl_stages_pipeline ON ghl_stages(pipeline_id)');

  // Migrate: lead scoring columns
  try { db.run('ALTER TABLE ghl_opportunities ADD COLUMN lead_score INTEGER'); } catch { /* already exists */ }
  try { db.run('ALTER TABLE ghl_opportunities ADD COLUMN score_breakdown TEXT'); } catch { /* already exists */ }
  try { db.run('ALTER TABLE ghl_opportunities ADD COLUMN scored_at TEXT'); } catch { /* already exists */ }

  // FTS4 virtual table for full-text search (sql.js includes FTS4, not FTS5)
  db.run(`
    CREATE VIRTUAL TABLE IF NOT EXISTS meetings_fts USING fts4(
      title,
      summary,
      transcript,
      content='meetings'
    )
  `);

  // Indexes
  db.run('CREATE INDEX IF NOT EXISTS idx_meetings_date ON meetings(date)');
  db.run('CREATE INDEX IF NOT EXISTS idx_meetings_category ON meetings(category)');
  db.run('CREATE INDEX IF NOT EXISTS idx_meetings_client ON meetings(client_name)');
  db.run('CREATE INDEX IF NOT EXISTS idx_action_items_assignee ON action_items(assignee)');
  db.run('CREATE INDEX IF NOT EXISTS idx_action_items_meeting ON action_items(meeting_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_action_items_completed ON action_items(completed)');
  db.run('CREATE INDEX IF NOT EXISTS idx_key_decisions_meeting ON key_decisions(meeting_id)');

  // --- Auth tables ---

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'standard',
      must_change_password INTEGER DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS channels (
      id TEXT PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS user_channels (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
      PRIMARY KEY (user_id, channel_id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS channel_permissions (
      channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
      route_slug TEXT NOT NULL,
      PRIMARY KEY (channel_id, route_slug)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS user_oauth_tokens (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider TEXT NOT NULL DEFAULT 'google',
      access_token_enc TEXT NOT NULL,
      refresh_token_enc TEXT NOT NULL,
      token_expiry INTEGER NOT NULL,
      scopes TEXT NOT NULL,
      provider_email TEXT,
      provider_name TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (user_id, provider)
    )
  `);

  db.run('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');
  db.run('CREATE INDEX IF NOT EXISTS idx_user_channels_user ON user_channels(user_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_channel_permissions_channel ON channel_permissions(channel_id)');

  // --- Skills tables ---

  db.run(`
    CREATE TABLE IF NOT EXISTS skills (
      id INTEGER PRIMARY KEY,
      drive_file_id TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      channel TEXT NOT NULL,
      skill_type TEXT NOT NULL,
      drive_modified_at TEXT NOT NULL,
      indexed_at TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1
    )
  `);

  db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_skills_drive_file ON skills(drive_file_id) WHERE drive_file_id IS NOT NULL');

  // skills_fts omitted: FTS5 not available in sql.js; queried via web app (Turso) only

  // --- Brand hub table ---

  db.run(`
    CREATE TABLE IF NOT EXISTS brand_hub (
      id INTEGER PRIMARY KEY,
      client_id INTEGER NOT NULL,
      client_name TEXT NOT NULL,
      client_slug TEXT NOT NULL,
      content TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      drive_file_id TEXT,
      drive_modified_at TEXT,
      indexed_at TEXT NOT NULL
    )
  `);

  db.run('CREATE INDEX IF NOT EXISTS idx_brand_hub_client ON brand_hub(client_id)');

  // Migrate: add title column to brand_hub if upgrading from old schema
  try { db.run("ALTER TABLE brand_hub ADD COLUMN title TEXT NOT NULL DEFAULT ''"); } catch { /* already exists */ }

  // UNIQUE index required for ON CONFLICT(drive_file_id) upsert
  db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_brand_hub_drive_file ON brand_hub(drive_file_id)');

  // brand_hub_fts omitted: FTS5 not available in sql.js; queried via web app (Turso) only

  // --- Drive watch channels table ---

  db.run(`
    CREATE TABLE IF NOT EXISTS drive_watch_channels (
      id INTEGER PRIMARY KEY,
      channel_id TEXT NOT NULL UNIQUE,
      resource_id TEXT NOT NULL,
      expiration INTEGER NOT NULL,
      page_token TEXT,
      created_at TEXT NOT NULL,
      renewed_at TEXT
    )
  `);

  // Migrate: add user_id column to drive_watch_channels if upgrading from old schema
  try { db.run('ALTER TABLE drive_watch_channels ADD COLUMN user_id TEXT'); } catch { /* already exists */ }

  // --- Drive sync queue table ---

  db.run(`
    CREATE TABLE IF NOT EXISTS drive_sync_queue (
      id INTEGER PRIMARY KEY,
      channel_id TEXT NOT NULL,
      resource_state TEXT NOT NULL,
      received_at TEXT NOT NULL,
      processed_at TEXT,
      error TEXT
    )
  `);

  db.run('CREATE INDEX IF NOT EXISTS idx_dsq_unprocessed ON drive_sync_queue(processed_at)');

  // --- Sync errors table ---

  db.run(`
    CREATE TABLE IF NOT EXISTS sync_errors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'error',
      message TEXT NOT NULL,
      stack TEXT,
      context TEXT,
      resolved INTEGER DEFAULT 0,
      created_at TEXT NOT NULL
    )
  `);

  db.run('CREATE INDEX IF NOT EXISTS idx_sync_errors_created ON sync_errors(created_at)');
  db.run('CREATE INDEX IF NOT EXISTS idx_sync_errors_source ON sync_errors(source)');

  // --- Task runs table ---

  db.run(`
    CREATE TABLE IF NOT EXISTS task_runs (
      id INTEGER PRIMARY KEY,
      client_id INTEGER NOT NULL,
      channel TEXT NOT NULL,
      task_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'queued',
      sops_used TEXT,
      brand_context_id INTEGER,
      output TEXT,
      qa_score REAL,
      qa_critique TEXT,
      attempts INTEGER NOT NULL DEFAULT 0,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  db.run('CREATE INDEX IF NOT EXISTS idx_task_runs_client ON task_runs(client_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_task_runs_status ON task_runs(status)');
  db.run('CREATE INDEX IF NOT EXISTS idx_task_runs_created ON task_runs(created_at)');

  // --- Asana tasks table ---

  db.run(`
    CREATE TABLE IF NOT EXISTS asana_tasks (
      gid TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      assignee_gid TEXT,
      assignee_name TEXT,
      due_on TEXT,
      completed INTEGER DEFAULT 0,
      completed_at TEXT,
      section_name TEXT,
      project_gid TEXT,
      project_name TEXT,
      notes TEXT,
      permalink_url TEXT,
      created_at TEXT,
      modified_at TEXT,
      synced_at TEXT NOT NULL
    )
  `);

  db.run('CREATE INDEX IF NOT EXISTS idx_asana_tasks_assignee ON asana_tasks(assignee_name)');
  db.run('CREATE INDEX IF NOT EXISTS idx_asana_tasks_due ON asana_tasks(due_on)');
  db.run('CREATE INDEX IF NOT EXISTS idx_asana_tasks_completed ON asana_tasks(completed)');
  db.run('CREATE INDEX IF NOT EXISTS idx_asana_tasks_project ON asana_tasks(project_gid)');

  // --- LinkedIn content table ---

  db.run(`
    CREATE TABLE IF NOT EXISTS linkedin_content (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pillar TEXT NOT NULL,
      topic TEXT NOT NULL,
      draft TEXT,
      status TEXT NOT NULL DEFAULT 'idea',
      scheduled_date TEXT,
      published_at TEXT,
      engagement_likes INTEGER DEFAULT 0,
      engagement_comments INTEGER DEFAULT 0,
      engagement_reposts INTEGER DEFAULT 0,
      engagement_impressions INTEGER DEFAULT 0,
      source_meeting_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  db.run('CREATE INDEX IF NOT EXISTS idx_linkedin_status ON linkedin_content(status)');
  db.run('CREATE INDEX IF NOT EXISTS idx_linkedin_pillar ON linkedin_content(pillar)');
  db.run('CREATE INDEX IF NOT EXISTS idx_linkedin_scheduled ON linkedin_content(scheduled_date)');

  // --- Outbound campaigns table ---

  db.run(`
    CREATE TABLE IF NOT EXISTS outbound_campaigns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      prospect_name TEXT NOT NULL,
      prospect_company TEXT,
      prospect_email TEXT,
      prospect_linkedin TEXT,
      icp_match_score REAL DEFAULT 0,
      channel TEXT NOT NULL DEFAULT 'email',
      sequence_step INTEGER DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'queued',
      last_contact_at TEXT,
      response_type TEXT,
      meeting_booked INTEGER DEFAULT 0,
      converted INTEGER DEFAULT 0,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  db.run('CREATE INDEX IF NOT EXISTS idx_outbound_status ON outbound_campaigns(status)');
  db.run('CREATE INDEX IF NOT EXISTS idx_outbound_company ON outbound_campaigns(prospect_company)');

  // --- Case studies table ---

  db.run(`
    CREATE TABLE IF NOT EXISTS case_studies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_name TEXT NOT NULL,
      win_type TEXT NOT NULL,
      metric_highlight TEXT,
      client_approved INTEGER DEFAULT 0,
      anonymous INTEGER DEFAULT 0,
      draft TEXT,
      status TEXT NOT NULL DEFAULT 'identified',
      distribution TEXT,
      published_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  db.run('CREATE INDEX IF NOT EXISTS idx_case_studies_client ON case_studies(client_name)');
  db.run('CREATE INDEX IF NOT EXISTS idx_case_studies_status ON case_studies(status)');

  // --- Referrals table ---

  db.run(`
    CREATE TABLE IF NOT EXISTS referrals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      referrer_name TEXT NOT NULL,
      referrer_type TEXT NOT NULL DEFAULT 'client',
      referred_name TEXT NOT NULL,
      referred_company TEXT,
      ghl_opportunity_id TEXT,
      status TEXT NOT NULL DEFAULT 'received',
      converted INTEGER DEFAULT 0,
      reward_type TEXT,
      reward_amount REAL,
      reward_paid INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  db.run('CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_name)');
  db.run('CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals(status)');

  // --- AI audit log table ---

  db.run(`
    CREATE TABLE IF NOT EXISTS ai_audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      call_id TEXT NOT NULL UNIQUE,
      source TEXT NOT NULL,
      prompt_hash TEXT,
      model TEXT NOT NULL,
      input_tokens INTEGER,
      output_tokens INTEGER,
      duration_ms INTEGER,
      quality_score REAL,
      quality_flags TEXT,
      status TEXT NOT NULL DEFAULT 'success',
      error TEXT,
      fallback_used INTEGER DEFAULT 0,
      retry_count INTEGER DEFAULT 0,
      created_at TEXT NOT NULL
    )
  `);

  db.run('CREATE INDEX IF NOT EXISTS idx_ai_audit_created ON ai_audit_log(created_at)');
  db.run('CREATE INDEX IF NOT EXISTS idx_ai_audit_source ON ai_audit_log(source)');
  db.run('CREATE INDEX IF NOT EXISTS idx_ai_audit_status ON ai_audit_log(status)');

  // --- QA grades table ---

  db.run(`
    CREATE TABLE IF NOT EXISTS qa_grades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      deliverable_type TEXT NOT NULL,
      deliverable_ref TEXT NOT NULL,
      client_name TEXT,
      grader TEXT NOT NULL DEFAULT 'ai',
      grade TEXT NOT NULL,
      score REAL,
      criteria TEXT NOT NULL,
      feedback TEXT,
      team_member TEXT,
      ai_call_id TEXT,
      created_at TEXT NOT NULL
    )
  `);

  db.run('CREATE INDEX IF NOT EXISTS idx_qa_grades_type ON qa_grades(deliverable_type)');
  db.run('CREATE INDEX IF NOT EXISTS idx_qa_grades_grade ON qa_grades(grade)');
  db.run('CREATE INDEX IF NOT EXISTS idx_qa_grades_member ON qa_grades(team_member)');

  // --- Campaign builds table ---

  db.run(`
    CREATE TABLE IF NOT EXISTS campaign_builds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_name TEXT NOT NULL,
      campaign_name TEXT NOT NULL,
      platform TEXT,
      asana_project_gid TEXT,
      checklist TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'in_progress',
      qa_grade_id INTEGER,
      launched_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  db.run('CREATE INDEX IF NOT EXISTS idx_campaign_builds_client ON campaign_builds(client_name)');
  db.run('CREATE INDEX IF NOT EXISTS idx_campaign_builds_status ON campaign_builds(status)');

  // --- Creative reviews table ---

  db.run(`
    CREATE TABLE IF NOT EXISTS creative_reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_name TEXT NOT NULL,
      asset_name TEXT NOT NULL,
      asset_type TEXT NOT NULL,
      asana_task_gid TEXT,
      submitted_by TEXT,
      reviewer TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      revision_count INTEGER DEFAULT 0,
      feedback TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  db.run('CREATE INDEX IF NOT EXISTS idx_creative_reviews_client ON creative_reviews(client_name)');
  db.run('CREATE INDEX IF NOT EXISTS idx_creative_reviews_status ON creative_reviews(status)');

  seedCategories(db);
  saveDb();
}

function seedCategories(db: Database): void {
  const categories = [
    { slug: 'client_catchup', label: 'Client Catch-up/Update', keywords: JSON.stringify(['catch up', 'catch-up', 'catchup', 'monthly', 'bi-weekly', 'bi weekly', 'update', 'review']) },
    { slug: 'onboarding', label: 'Client Onboarding', keywords: JSON.stringify(['onboarding', 'onboard']) },
    { slug: 'discovery_sales', label: 'Discovery/Sales Call', keywords: JSON.stringify(['discovery', 'intro', 'initial', 'enquiry', 'inquiry', 'proposal']) },
    { slug: 'interview', label: 'Interview', keywords: JSON.stringify(['interview', 'hiring']) },
    { slug: 'strategy', label: 'Strategy/Audit Session', keywords: JSON.stringify(['strategy', 'audit', 'planning']) },
    { slug: 'internal', label: 'Internal Team Meeting', keywords: JSON.stringify(['team meeting', 'team call', 'management', '1 - 1', '1-1', 'catch up']) },
    { slug: 'website_design', label: 'Website/Design Review', keywords: JSON.stringify(['website', 'web design', 'design feedback', 'design review', 'pdp']) },
    { slug: 'service_specific', label: 'Service-Specific', keywords: JSON.stringify(['paid social', 'paid search', 'ppc', 'meta ads', 'google ads', 'seo']) },
    { slug: 'other', label: 'Other/Uncategorised', keywords: JSON.stringify([]) },
  ];

  const stmt = db.prepare('INSERT OR IGNORE INTO meeting_categories (slug, label, keywords) VALUES (?, ?, ?)');
  for (const cat of categories) {
    stmt.run([cat.slug, cat.label, cat.keywords]);
  }
  stmt.free();
}

// Rebuild the FTS index from the meetings table
export async function rebuildFts(): Promise<void> {
  const db = await getDb();
  db.run("INSERT INTO meetings_fts(meetings_fts) VALUES ('rebuild')");
}

// Helper: upsert a meeting
export async function upsertMeeting(meeting: {
  id: string;
  title: string;
  date: string;
  duration_seconds: number | null;
  url: string | null;
  summary: string | null;
  transcript: string | null;
  attendees: string | null;
  raw_action_items: string | null;
  calendar_invitees?: string | null;
  invitee_domains_type?: string | null;
}): Promise<'inserted' | 'updated'> {
  const db = await getDb();
  const now = new Date().toISOString();

  const existing = db.exec('SELECT id FROM meetings WHERE id = ?', [meeting.id]);
  const exists = existing.length > 0 && existing[0].values.length > 0;

  if (exists) {
    db.run(`
      UPDATE meetings SET
        title = ?, date = ?, duration_seconds = ?, url = ?,
        summary = COALESCE(?, summary),
        transcript = COALESCE(?, transcript),
        attendees = COALESCE(?, attendees),
        raw_action_items = COALESCE(?, raw_action_items),
        calendar_invitees = COALESCE(?, calendar_invitees),
        invitee_domains_type = COALESCE(?, invitee_domains_type),
        synced_at = ?
      WHERE id = ?
    `, [
      meeting.title, meeting.date, meeting.duration_seconds, meeting.url,
      meeting.summary, meeting.transcript, meeting.attendees, meeting.raw_action_items,
      meeting.calendar_invitees ?? null, meeting.invitee_domains_type ?? null,
      now, meeting.id,
    ]);
    return 'updated';
  } else {
    db.run(`
      INSERT INTO meetings (id, title, date, duration_seconds, url, summary, transcript, attendees, raw_action_items, calendar_invitees, invitee_domains_type, synced_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      meeting.id, meeting.title, meeting.date, meeting.duration_seconds, meeting.url,
      meeting.summary, meeting.transcript, meeting.attendees, meeting.raw_action_items,
      meeting.calendar_invitees ?? null, meeting.invitee_domains_type ?? null, now,
    ]);
    return 'inserted';
  }
}

export async function getLastSyncedDate(): Promise<string | null> {
  const db = await getDb();
  const result = db.exec('SELECT MAX(date) FROM meetings');
  if (result.length > 0 && result[0].values.length > 0 && result[0].values[0][0]) {
    return result[0].values[0][0] as string;
  }
  return null;
}

export function log(component: string, message: string): void {
  const ts = new Date().toISOString();
  console.log(`[${ts}] [${component}] ${message}`);
}

export function logError(component: string, message: string, err?: unknown): void {
  const ts = new Date().toISOString();
  const errMsg = err instanceof Error ? err.message : String(err || '');
  console.error(`[${ts}] [ERROR] [${component}] ${message}${errMsg ? ': ' + errMsg : ''}`);
}

// Run standalone: npx tsx scripts/utils/db.ts --init
if (process.argv.includes('--init')) {
  initSchema().then(() => {
    log('DB', 'Schema initialised successfully');
    log('DB', `Database at: ${DB_PATH}`);
    closeDb();
  }).catch((err) => {
    logError('DB', 'Failed to initialise schema', err);
    process.exit(1);
  });
}
