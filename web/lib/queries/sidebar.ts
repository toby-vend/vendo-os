import { db, rows } from './base.js';

// --- Types ---

export interface SidebarItem {
  id: string;
  label: string;
  href: string;
  permission?: string;
  hidden?: boolean;
}

export interface SidebarGroup {
  id: string;
  label: string;
  icon?: string;
  permission?: string;
  adminOnly?: boolean;
  items: SidebarItem[];
}

export type SidebarConfig = SidebarGroup[];

// --- Default config (matches the current hardcoded sidebar) ---

export const DEFAULT_SIDEBAR_CONFIG: SidebarConfig = [
  {
    id: 'home',
    label: 'Home',
    icon: '<svg class="nav-group-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
    items: [
      { id: 'dashboard', label: 'Home', href: '/', permission: 'dashboard' },
    ],
  },
  {
    id: 'clients',
    label: 'Clients',
    icon: '<svg class="nav-group-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>',
    items: [
      { id: 'clients-overview', label: 'Clients', href: '/clients', permission: 'clients' },
      { id: 'client-onboarding', label: 'Onboarding', href: '/onboarding', permission: 'clients' },
      { id: 'pipeline', label: 'Pipeline', href: '/pipeline', permission: 'pipeline' },
      { id: 'client-mer', label: 'Client MER', href: '/dashboards/client-mer', permission: 'dashboards' },
      { id: 'reviews', label: 'Reviews', href: '/dashboards/reviews', permission: 'dashboards' },
    ],
  },
  {
    id: 'performance',
    label: 'Performance',
    icon: '<svg class="nav-group-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>',
    items: [
      { id: 'ads-dashboard', label: 'Ads Dashboard', href: '/dashboards/ads', permission: 'dashboards' },
      { id: 'reporting-hub', label: 'Reporting Hub', href: '/dashboards/reporting-hub', permission: 'dashboards' },
      { id: 'ads-manager', label: 'Ads Manager', href: '/ads', permission: 'ads' },
    ],
  },
  {
    id: 'finance',
    label: 'Finance',
    icon: '<svg class="nav-group-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>',
    permission: 'dashboards',
    items: [
      { id: 'finance-dashboard', label: 'Finance', href: '/dashboards/finance', permission: 'dashboards' },
      { id: 'profitability', label: 'Profitability', href: '/dashboards/profitability', permission: 'dashboards' },
      { id: 'pipeline-tracker', label: 'Pipeline Tracker', href: '/dashboards/pipeline', permission: 'dashboards' },
    ],
  },
  {
    id: 'work',
    label: 'Work',
    icon: '<svg class="nav-group-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>',
    items: [
      { id: 'action-items', label: 'Action Items', href: '/action-items', permission: 'action-items' },
      { id: 'asana-tasks', label: 'Asana Tasks', href: '/asana-tasks', permission: 'asana-tasks' },
      { id: 'content-tasks', label: 'Content Tasks', href: '/tasks', permission: 'tasks' },
      { id: 'video-production', label: 'Video Production', href: '/video-production', permission: 'video-production' },
      { id: 'time-tracking', label: 'Time Tracking', href: '/dashboards/time-tracking', permission: 'dashboards' },
      { id: 'capacity', label: 'Capacity', href: '/dashboards/capacity', permission: 'dashboards' },
    ],
  },
  {
    id: 'meetings',
    label: 'Meetings',
    icon: '<svg class="nav-group-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>',
    items: [
      { id: 'meetings-page', label: 'Meetings', href: '/meetings', permission: 'meetings' },
    ],
  },
  {
    id: 'tools',
    label: 'Tools',
    icon: '<svg class="nav-group-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>',
    items: [
      { id: 'skills', label: 'Skills', href: '/skills', permission: 'skills' },
      { id: 'chat', label: 'Chat', href: '/chat', permission: 'chat' },
      { id: 'briefs', label: 'Briefs', href: '/briefs', permission: 'briefs' },
      { id: 'growth', label: 'Growth', href: '/growth', permission: 'growth' },
      { id: 'drive', label: 'Drive', href: '/drive', permission: 'drive' },
    ],
  },
  {
    id: 'operations',
    label: 'Operations',
    icon: '<svg class="nav-group-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>',
    permission: 'operations',
    items: [
      { id: 'operations-hub', label: 'Operations', href: '/operations', permission: 'operations' },
    ],
  },
  {
    id: 'admin',
    label: 'Admin',
    icon: '<svg class="nav-group-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
    adminOnly: true,
    items: [
      { id: 'admin-users', label: 'Users', href: '/admin/users' },
      { id: 'admin-permissions', label: 'Permissions', href: '/admin/permissions' },
      { id: 'admin-client-mapping', label: 'Client Mapping', href: '/admin/client-mapping' },
      { id: 'admin-portal-users', label: 'Portal Users', href: '/admin/portal-users' },
      { id: 'admin-onboarding', label: 'Account Setup', href: '/admin/onboarding' },
      { id: 'admin-usage', label: 'Usage', href: '/admin/usage' },
      { id: 'admin-sidebar', label: 'Sidebar', href: '/admin/sidebar' },
      { id: 'sync-status', label: 'Sync Status', href: '/sync-status' },
    ],
  },
];

// --- Schema ---

export async function initSidebarSchema(): Promise<void> {
  await db.execute({
    sql: `CREATE TABLE IF NOT EXISTS sidebar_config (
      key TEXT PRIMARY KEY,
      config_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
    args: [],
  });
}

// --- In-memory cache (avoids DB hit on every page load) ---

let cachedConfig: SidebarConfig | null = null;
let cacheTime = 0;
const CACHE_TTL_MS = 60_000;

// --- Queries ---

export async function getSidebarConfig(): Promise<SidebarConfig> {
  if (cachedConfig && Date.now() - cacheTime < CACHE_TTL_MS) return cachedConfig;

  try {
    const result = await rows<{ config_json: string }>(
      'SELECT config_json FROM sidebar_config WHERE key = ?',
      ['default'],
    );
    if (result.length === 0) {
      cachedConfig = DEFAULT_SIDEBAR_CONFIG;
      cacheTime = Date.now();
      return DEFAULT_SIDEBAR_CONFIG;
    }
    cachedConfig = JSON.parse(result[0].config_json) as SidebarConfig;
    cacheTime = Date.now();
    return cachedConfig;
  } catch {
    // Table may not exist yet — return default and cache it
    cachedConfig = DEFAULT_SIDEBAR_CONFIG;
    cacheTime = Date.now();
    return DEFAULT_SIDEBAR_CONFIG;
  }
}

/**
 * Patch any DB-saved sidebar config to include new items from DEFAULT_SIDEBAR_CONFIG.
 * Ensures items added in code appear even when a custom config was previously saved.
 */
export async function migrateSidebarConfig(): Promise<void> {
  await initSidebarSchema();
  try {
    const result = await rows<{ config_json: string }>(
      'SELECT config_json FROM sidebar_config WHERE key = ?',
      ['default'],
    );
    if (result.length === 0) return; // Using defaults — nothing to patch

    const saved = JSON.parse(result[0].config_json) as SidebarConfig;
    let changed = false;

    // Ensure each default group/item exists in saved config
    for (const defaultGroup of DEFAULT_SIDEBAR_CONFIG) {
      const savedGroup = saved.find(g => g.id === defaultGroup.id);
      if (!savedGroup) {
        // Whole group missing — add it
        saved.push(defaultGroup);
        changed = true;
        continue;
      }
      // Check items within the group
      for (const defaultItem of defaultGroup.items) {
        if (!savedGroup.items.find(i => i.id === defaultItem.id)) {
          // Find the insert position (after the item that precedes it in the default)
          const defaultIdx = defaultGroup.items.indexOf(defaultItem);
          const prevItem = defaultIdx > 0 ? defaultGroup.items[defaultIdx - 1] : null;
          const prevIdx = prevItem ? savedGroup.items.findIndex(i => i.id === prevItem.id) : -1;
          savedGroup.items.splice(prevIdx + 1, 0, defaultItem);
          changed = true;
        }
      }
      // Sync group icon from default
      if (defaultGroup.icon && savedGroup.icon !== defaultGroup.icon) {
        savedGroup.icon = defaultGroup.icon;
        changed = true;
      }
      // Rename items whose labels changed in the default
      for (const defaultItem of defaultGroup.items) {
        const savedItem = savedGroup.items.find(i => i.id === defaultItem.id);
        if (savedItem && savedItem.label !== defaultItem.label) {
          savedItem.label = defaultItem.label;
          changed = true;
        }
      }
    }

    if (changed) {
      await saveSidebarConfig(saved);
    }
  } catch {
    // Ignore — table may not exist yet
  }
}

export async function saveSidebarConfig(config: SidebarConfig): Promise<void> {
  await initSidebarSchema();
  const now = new Date().toISOString();
  await db.execute({
    sql: `INSERT INTO sidebar_config (key, config_json, updated_at)
          VALUES ('default', ?, ?)
          ON CONFLICT(key) DO UPDATE SET config_json = excluded.config_json, updated_at = excluded.updated_at`,
    args: [JSON.stringify(config), now],
  });
  cachedConfig = config;
  cacheTime = Date.now();
}
