import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Import every symbol from the barrel — this is both a compile-time and runtime check
import {
  db,
  rows,
  scalar,
  // meetings
  searchMeetings,
  getMeetingById,
  getMeetingActionItems,
  getActionItems,
  getCategories,
  getAssignees,
  getClientNames,
  // auth - users
  getUserByEmail,
  getUserById,
  getAllUsers,
  createUser,
  updateUser,
  deleteUser,
  updateUserPassword,
  // auth - channels
  getChannels,
  getUserChannelSlugs,
  setUserChannels,
  // auth - permissions
  getUserAllowedRoutes,
  getAllPermissions,
  setAllPermissions,
  // auth - schema
  initSchema,
  initAuthSchema,
  // auth - oauth tokens
  getUserOAuthToken,
  hasUserOAuthToken,
  upsertUserOAuthToken,
  updateUserOAuthAccessToken,
  deleteUserOAuthToken,
  // dashboard
  getDashboardStats,
  getRecentMeetings,
  getActionsByAssignee,
  getClients,
  getClientByName,
  getSyncStatus,
  listBriefs,
  getBriefContent,
  // pipeline
  getPipelineOverview,
  getRecentOpportunities,
  getWonDeals,
  getStalledDeals,
  getOpportunityDetail,
  getPipelineNames,
  // ads
  getAdAccountSummary,
  getCampaignSummary,
} from './index.js';

describe('queries barrel smoke test', () => {
  it('db client exists and has execute method', () => {
    assert.ok(db, 'db is exported');
    assert.strictEqual(typeof db.execute, 'function', 'db.execute is a function');
  });

  it('rows and scalar helpers are functions', () => {
    assert.strictEqual(typeof rows, 'function');
    assert.strictEqual(typeof scalar, 'function');
  });

  it('meeting functions are exported', () => {
    assert.strictEqual(typeof searchMeetings, 'function');
    assert.strictEqual(typeof getMeetingById, 'function');
    assert.strictEqual(typeof getMeetingActionItems, 'function');
    assert.strictEqual(typeof getActionItems, 'function');
    assert.strictEqual(typeof getCategories, 'function');
    assert.strictEqual(typeof getAssignees, 'function');
    assert.strictEqual(typeof getClientNames, 'function');
  });

  it('auth user functions are exported', () => {
    assert.strictEqual(typeof getUserByEmail, 'function');
    assert.strictEqual(typeof getUserById, 'function');
    assert.strictEqual(typeof getAllUsers, 'function');
    assert.strictEqual(typeof createUser, 'function');
    assert.strictEqual(typeof updateUser, 'function');
    assert.strictEqual(typeof deleteUser, 'function');
    assert.strictEqual(typeof updateUserPassword, 'function');
  });

  it('auth channel and permission functions are exported', () => {
    assert.strictEqual(typeof getChannels, 'function');
    assert.strictEqual(typeof getUserChannelSlugs, 'function');
    assert.strictEqual(typeof setUserChannels, 'function');
    assert.strictEqual(typeof getUserAllowedRoutes, 'function');
    assert.strictEqual(typeof getAllPermissions, 'function');
    assert.strictEqual(typeof setAllPermissions, 'function');
  });

  it('initSchema and initAuthSchema both exported (backward compat)', () => {
    assert.strictEqual(typeof initSchema, 'function');
    assert.strictEqual(typeof initAuthSchema, 'function');
    assert.strictEqual(initSchema, initAuthSchema, 'initAuthSchema is alias of initSchema');
  });

  it('oauth token functions are exported', () => {
    assert.strictEqual(typeof getUserOAuthToken, 'function');
    assert.strictEqual(typeof hasUserOAuthToken, 'function');
    assert.strictEqual(typeof upsertUserOAuthToken, 'function');
    assert.strictEqual(typeof updateUserOAuthAccessToken, 'function');
    assert.strictEqual(typeof deleteUserOAuthToken, 'function');
  });

  it('dashboard functions are exported', () => {
    assert.strictEqual(typeof getDashboardStats, 'function');
    assert.strictEqual(typeof getRecentMeetings, 'function');
    assert.strictEqual(typeof getActionsByAssignee, 'function');
    assert.strictEqual(typeof getClients, 'function');
    assert.strictEqual(typeof getClientByName, 'function');
    assert.strictEqual(typeof getSyncStatus, 'function');
    assert.strictEqual(typeof listBriefs, 'function');
    assert.strictEqual(typeof getBriefContent, 'function');
  });

  it('pipeline functions are exported', () => {
    assert.strictEqual(typeof getPipelineOverview, 'function');
    assert.strictEqual(typeof getRecentOpportunities, 'function');
    assert.strictEqual(typeof getWonDeals, 'function');
    assert.strictEqual(typeof getStalledDeals, 'function');
    assert.strictEqual(typeof getOpportunityDetail, 'function');
    assert.strictEqual(typeof getPipelineNames, 'function');
  });

  it('ads functions are exported', () => {
    assert.strictEqual(typeof getAdAccountSummary, 'function');
    assert.strictEqual(typeof getCampaignSummary, 'function');
  });
});
