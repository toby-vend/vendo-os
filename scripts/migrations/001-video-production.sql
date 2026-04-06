-- Video Production Module — database tables
-- Run: sqlite3 data/vendo.db < scripts/migrations/001-video-production.sql

-- Core project record (one per shoot / content day)
CREATE TABLE IF NOT EXISTS video_projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  shoot_date TEXT,                         -- ISO date YYYY-MM-DD
  shoot_time TEXT,                         -- e.g. "09:00"
  shoot_end_time TEXT,                     -- e.g. "17:00"
  location TEXT,
  contact_on_day TEXT,
  treatments_planned TEXT,                 -- JSON array of treatment names
  video_types TEXT,                        -- JSON array e.g. ["UGC","Talking Head"]
  num_videos INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'shoot_booked',
  -- status enum: shoot_booked | shoot_plan_in_progress | shoot_plan_approved
  --   | content_day_complete | raw_files_shared | in_editing
  --   | qa_review | revisions | client_review | live
  priority TEXT NOT NULL DEFAULT 'normal', -- high | normal | low
  assigned_editor_id TEXT,                 -- references users.id
  assigned_editor_name TEXT,
  deadline TEXT,                           -- ISO date
  revision_round INTEGER NOT NULL DEFAULT 0,
  client_status TEXT DEFAULT 'awaiting',   -- awaiting | confirmed | approved | changes_requested
  raw_files_confirmed_at TEXT,
  client_approved_at TEXT,
  publish_date TEXT,
  publish_platforms TEXT,                   -- JSON array e.g. ["Instagram","TikTok"]
  publish_link TEXT,
  internal_notes TEXT,
  archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (client_id) REFERENCES clients(id)
);

CREATE INDEX IF NOT EXISTS idx_video_projects_client ON video_projects(client_id);
CREATE INDEX IF NOT EXISTS idx_video_projects_status ON video_projects(status);
CREATE INDEX IF NOT EXISTS idx_video_projects_editor ON video_projects(assigned_editor_id);
CREATE INDEX IF NOT EXISTS idx_video_projects_shoot_date ON video_projects(shoot_date);
CREATE INDEX IF NOT EXISTS idx_video_projects_archived ON video_projects(archived);

-- Shoot plan (structured brief per project, version-tracked)
CREATE TABLE IF NOT EXISTS video_shoot_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  treatments TEXT,                         -- JSON array of { name, videoTypes[], numVideos }
  run_order TEXT,                          -- JSON array of time-block objects
  shot_list TEXT,                          -- rich text / markdown
  equipment_notes TEXT,
  talent_requirements TEXT,
  status TEXT NOT NULL DEFAULT 'draft',    -- draft | ready_for_review | approved | changes_requested
  client_comments TEXT,                    -- client feedback text
  approved_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES video_projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_video_shoot_plans_project ON video_shoot_plans(project_id);

-- Files (raw footage links + edit file links)
CREATE TABLE IF NOT EXISTS video_files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  type TEXT NOT NULL,                      -- raw | edit
  url TEXT NOT NULL,                       -- Google Drive link or Frame link
  label TEXT,                              -- e.g. "Implants — UGC Hook — Take 3"
  treatment TEXT,
  video_type TEXT,
  version INTEGER DEFAULT 1,              -- for edit files: v1, v2, etc.
  uploaded_by TEXT,                        -- user name
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES video_projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_video_files_project ON video_files(project_id);
CREATE INDEX IF NOT EXISTS idx_video_files_type ON video_files(type);

-- QA reviews (checklist per review round)
CREATE TABLE IF NOT EXISTS video_qa_reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  round INTEGER NOT NULL DEFAULT 1,
  reviewer_id TEXT,
  reviewer_name TEXT,
  -- checklist items (1 = pass, 0 = fail, NULL = not checked)
  matches_brief INTEGER,
  captions_accurate INTEGER,
  brand_correct INTEGER,
  compliance_ok INTEGER,
  audio_ok INTEGER,
  hook_ok INTEGER,
  cta_present INTEGER,
  result TEXT,                             -- pass | fail
  notes TEXT,
  reviewed_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES video_projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_video_qa_reviews_project ON video_qa_reviews(project_id);

-- Comments / revision notes (from QA or client)
CREATE TABLE IF NOT EXISTS video_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  source TEXT NOT NULL,                    -- qa | client | internal
  round INTEGER DEFAULT 0,
  author_name TEXT,
  body TEXT NOT NULL,
  timestamp_ref TEXT,                      -- optional video timestamp reference
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES video_projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_video_comments_project ON video_comments(project_id);

-- Audit log (every action timestamped)
CREATE TABLE IF NOT EXISTS video_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  action TEXT NOT NULL,                    -- e.g. status_change, file_upload, qa_submit, client_approval
  from_value TEXT,
  to_value TEXT,
  user_id TEXT,
  user_name TEXT,
  details TEXT,                            -- JSON for extra context
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES video_projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_video_audit_log_project ON video_audit_log(project_id);
CREATE INDEX IF NOT EXISTS idx_video_audit_log_action ON video_audit_log(action);
