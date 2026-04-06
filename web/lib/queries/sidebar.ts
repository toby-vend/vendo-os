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
    icon: '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
    items: [
      { id: 'dashboard', label: 'Home', href: '/', permission: 'dashboard' },
    ],
  },
  {
    id: 'clients',
    label: 'Clients',
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
    items: [
      { id: 'ads-dashboard', label: 'Ads Dashboard', href: '/dashboards/ads', permission: 'dashboards' },
      { id: 'reporting-hub', label: 'Reporting Hub', href: '/dashboards/reporting-hub', permission: 'dashboards' },
      { id: 'ads-manager', label: 'Ads Manager', href: '/ads', permission: 'ads' },
    ],
  },
  {
    id: 'finance',
    label: 'Finance',
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
    icon: '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>',
    items: [
      { id: 'meetings-page', label: 'Meetings', href: '/meetings', permission: 'meetings' },
    ],
  },
  {
    id: 'tools',
    label: 'Tools',
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
    icon: '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>',
    permission: 'operations',
    items: [
      { id: 'operations-hub', label: 'Operations', href: '/operations', permission: 'operations' },
    ],
  },
  {
    id: 'admin',
    label: 'Admin',
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
