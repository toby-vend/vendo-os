import type { FastifyPluginAsync } from 'fastify';
import {
  getAllClientsAdmin,
  addSourceMapping,
  getGhlLocations,
} from '../../lib/queries/clients.js';
import {
  createPortalUser,
  getUserByEmail,
} from '../../lib/queries/auth.js';
import { hashPassword, generateId } from '../../lib/auth.js';
import { rows, db } from '../../lib/queries/base.js';

// --- Onboarding query helpers ---

interface MetaAccountRow {
  account_id: string;
  name: string | null;
}

interface GadsAccountRow {
  id: string;
  descriptive_name: string | null;
}

interface TreatmentTypeRow {
  id: number;
  slug: string;
  label: string;
  default_value: number;
  vertical: string;
  keywords: string | null;
}

async function getMetaAdAccounts(): Promise<MetaAccountRow[]> {
  try {
    return await rows<MetaAccountRow>(
      'SELECT account_id, name FROM meta_ad_accounts ORDER BY name COLLATE NOCASE',
    );
  } catch {
    return [];
  }
}

async function getGadsAccounts(): Promise<GadsAccountRow[]> {
  try {
    return await rows<GadsAccountRow>(
      'SELECT id, descriptive_name FROM gads_accounts ORDER BY descriptive_name COLLATE NOCASE',
    );
  } catch {
    return [];
  }
}

async function getGa4Properties(): Promise<{ id: string; display_name: string | null }[]> {
  try {
    return await rows<{ id: string; display_name: string | null }>(
      'SELECT id, display_name FROM ga4_properties ORDER BY display_name COLLATE NOCASE',
    );
  } catch {
    return [];
  }
}

async function getGscSites(): Promise<{ id: string }[]> {
  try {
    return await rows<{ id: string }>('SELECT id FROM gsc_sites ORDER BY id');
  } catch {
    return [];
  }
}

async function getTreatmentTypes(): Promise<TreatmentTypeRow[]> {
  try {
    return await rows<TreatmentTypeRow>(
      'SELECT id, slug, label, default_value, vertical, keywords FROM treatment_types ORDER BY vertical, label',
    );
  } catch {
    return [];
  }
}

async function createClient(
  name: string,
  displayName: string,
  domain: string,
  crmType: string,
  vertical: string,
): Promise<number> {
  const now = new Date().toISOString();
  // Use the existing clients table — add display_name via the column that already exists
  const result = await db.execute({
    sql: `INSERT INTO clients (name, display_name, email, vertical, status, source, total_invoiced, outstanding, meeting_count)
          VALUES (?, ?, ?, ?, 'active', 'onboarding', 0, 0, 0)`,
    args: [name, displayName || name, domain || null, vertical || null],
  });
  const clientId = Number(result.lastInsertRowid);

  // Store crm_type and domain in client_account_map metadata if needed
  // (the clients table doesn't have crm_type/domain columns — they live on the mappings)
  return clientId;
}

async function createSyncJob(clientId: number, clientName: string, jobType: string): Promise<number> {
  const now = new Date().toISOString();
  // Ensure sync_jobs table exists
  await db.execute({
    sql: `CREATE TABLE IF NOT EXISTS sync_jobs (
      id INTEGER PRIMARY KEY,
      client_id INTEGER NOT NULL,
      client_name TEXT NOT NULL,
      job_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL,
      started_at TEXT,
      completed_at TEXT,
      error TEXT
    )`,
    args: [],
  });
  const result = await db.execute({
    sql: 'INSERT INTO sync_jobs (client_id, client_name, job_type, status, created_at) VALUES (?, ?, ?, ?, ?)',
    args: [clientId, clientName, jobType, 'pending', now],
  });
  return Number(result.lastInsertRowid);
}

// --- Routes ---

export const adminOnboardingRoutes: FastifyPluginAsync = async (app) => {
  // GET /admin/onboarding — render the wizard
  app.get('/', async (_request, reply) => {
    const clients = await getAllClientsAdmin();
    reply.render('admin/onboarding', { clients });
  });

  // POST /admin/onboarding/create-client — Step 1
  app.post('/create-client', async (request, reply) => {
    const body = request.body as Record<string, string>;
    const mode = (body.mode || 'new').trim();
    const existingClientId = body.existing_client_id ? Number(body.existing_client_id) : null;
    const name = (body.name || '').trim();
    const displayName = (body.display_name || '').trim();
    const domain = (body.domain || '').trim();
    const crmType = (body.crm_type || 'ghl').trim();
    const vertical = (body.vertical || '').trim();

    let clientId: number;
    let clientName: string;

    if (mode === 'existing' && existingClientId) {
      clientId = existingClientId;
      // Look up name
      const found = await rows<{ name: string; display_name: string | null }>(
        'SELECT name, display_name FROM clients WHERE id = ?',
        [clientId],
      );
      clientName = found[0]?.display_name || found[0]?.name || 'Unknown';
    } else {
      if (!name) {
        reply.code(400).type('text/html').send(
          '<div style="color: #EF4444; padding: 0.5rem;">Client name is required.</div>',
        );
        return;
      }
      try {
        clientId = await createClient(name, displayName, domain, crmType, vertical);
        clientName = displayName || name;
      } catch (err: any) {
        const msg = err.message?.includes('UNIQUE') ? 'A client with that name already exists.' : 'Failed to create client.';
        reply.code(400).type('text/html').send(
          `<div style="color: #EF4444; padding: 0.5rem;">${msg}</div>`,
        );
        return;
      }
    }

    // Fetch platform accounts for step 2
    const [metaAccounts, gadsAccounts, ga4Properties, gscSites, ghlLocations] = await Promise.all([
      getMetaAdAccounts(),
      getGadsAccounts(),
      getGa4Properties(),
      getGscSites(),
      getGhlLocations(),
    ]);

    const html = renderStep2({
      clientId,
      clientName,
      crmType,
      metaAccounts,
      gadsAccounts,
      ga4Properties,
      gscSites,
      ghlLocations,
      csrfToken: (request as any)._sessionToken
        ? (await import('../../lib/auth.js')).generateCsrfToken((request as any)._sessionToken)
        : '',
    });
    reply.type('text/html').send(html);
  });

  // POST /admin/onboarding/link-accounts — Step 2
  app.post('/link-accounts', async (request, reply) => {
    const body = request.body as Record<string, string | string[]>;
    const clientId = Number(body.client_id);
    const clientName = typeof body.client_name === 'string' ? body.client_name : '';
    const crmType = typeof body.crm_type === 'string' ? body.crm_type : 'ghl';

    // Parse platform mappings from form arrays
    const platforms = Array.isArray(body['platform[]']) ? body['platform[]'] : body['platform[]'] ? [body['platform[]'] as string] : [];
    const accountIds = Array.isArray(body['account_id[]']) ? body['account_id[]'] : body['account_id[]'] ? [body['account_id[]'] as string] : [];
    const accountNames = Array.isArray(body['account_name[]']) ? body['account_name[]'] : body['account_name[]'] ? [body['account_name[]'] as string] : [];

    // Save each mapping
    for (let i = 0; i < platforms.length; i++) {
      const platform = platforms[i]?.trim();
      const accountId = accountIds[i]?.trim();
      const accountName = (accountNames[i] || '').trim();
      if (platform && accountId) {
        try {
          await addSourceMapping(clientId, platform, accountId, accountName || accountId);
        } catch {
          // Duplicate — skip
        }
      }
    }

    // Fetch treatments for step 3
    const treatments = await getTreatmentTypes();
    const csrfToken = (request as any)._sessionToken
      ? (await import('../../lib/auth.js')).generateCsrfToken((request as any)._sessionToken)
      : '';

    const html = renderStep3({ clientId, clientName, crmType, treatments, csrfToken });
    reply.type('text/html').send(html);
  });

  // POST /admin/onboarding/treatments — Step 3
  app.post('/treatments', async (request, reply) => {
    const body = request.body as Record<string, string | string[]>;
    const clientId = Number(body.client_id);
    const clientName = typeof body.client_name === 'string' ? body.client_name : '';
    const crmType = typeof body.crm_type === 'string' ? body.crm_type : 'ghl';

    // Save client-specific treatment values
    // For now, store in a client_treatment_values table
    await db.execute({
      sql: `CREATE TABLE IF NOT EXISTS client_treatment_values (
        id INTEGER PRIMARY KEY,
        client_id INTEGER NOT NULL,
        treatment_type_id INTEGER NOT NULL,
        custom_value REAL NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE(client_id, treatment_type_id)
      )`,
      args: [],
    });

    const treatmentIds = Array.isArray(body['treatment_id[]']) ? body['treatment_id[]'] : body['treatment_id[]'] ? [body['treatment_id[]'] as string] : [];
    const treatmentValues = Array.isArray(body['treatment_value[]']) ? body['treatment_value[]'] : body['treatment_value[]'] ? [body['treatment_value[]'] as string] : [];
    const now = new Date().toISOString();

    for (let i = 0; i < treatmentIds.length; i++) {
      const tId = Number(treatmentIds[i]);
      const tVal = parseFloat(treatmentValues[i] || '0');
      if (tId && !isNaN(tVal)) {
        await db.execute({
          sql: `INSERT INTO client_treatment_values (client_id, treatment_type_id, custom_value, created_at)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(client_id, treatment_type_id) DO UPDATE SET custom_value = excluded.custom_value`,
          args: [clientId, tId, tVal, now],
        });
      }
    }

    const csrfToken = (request as any)._sessionToken
      ? (await import('../../lib/auth.js')).generateCsrfToken((request as any)._sessionToken)
      : '';

    const html = renderStep4({ clientId, clientName, crmType, csrfToken });
    reply.type('text/html').send(html);
  });

  // POST /admin/onboarding/portal-user — Step 4
  app.post('/portal-user', async (request, reply) => {
    const body = request.body as Record<string, string>;
    const clientId = Number(body.client_id);
    const clientName = (body.client_name || '').trim();
    const crmType = (body.crm_type || 'ghl').trim();
    const email = (body.email || '').trim().toLowerCase();
    const name = (body.portal_user_name || '').trim();
    const password = (body.password || '').trim();
    const skipUser = body.skip_user === '1';

    let portalUserCreated = false;
    let portalUserError = '';

    if (!skipUser) {
      if (!email || !name || !password) {
        portalUserError = 'Email, name, and password are all required.';
      } else {
        const existing = await getUserByEmail(email);
        if (existing) {
          portalUserError = 'A user with that email already exists.';
        } else {
          await createPortalUser({
            id: generateId(),
            email,
            name,
            passwordHash: hashPassword(password),
            clientId,
            clientName,
          });
          portalUserCreated = true;
        }
      }
    }

    if (portalUserError) {
      const csrfToken = (request as any)._sessionToken
        ? (await import('../../lib/auth.js')).generateCsrfToken((request as any)._sessionToken)
        : '';
      const html = renderStep4({ clientId, clientName, crmType, csrfToken, error: portalUserError });
      reply.type('text/html').send(html);
      return;
    }

    // Fetch summary data
    const mappings = await rows<{ source: string; external_id: string; external_name: string | null }>(
      'SELECT source, external_id, external_name FROM client_source_mappings WHERE client_id = ?',
      [clientId],
    );

    const csrfToken = (request as any)._sessionToken
      ? (await import('../../lib/auth.js')).generateCsrfToken((request as any)._sessionToken)
      : '';

    const html = renderStep5({
      clientId,
      clientName,
      crmType,
      mappings,
      portalUserCreated,
      skipUser,
      portalEmail: email,
      csrfToken,
    });
    reply.type('text/html').send(html);
  });

  // POST /admin/onboarding/trigger-sync — Step 5
  app.post('/trigger-sync', async (request, reply) => {
    const body = request.body as Record<string, string>;
    const clientId = Number(body.client_id);
    const clientName = (body.client_name || '').trim();

    const jobId = await createSyncJob(clientId, clientName, 'attribution_backfill');

    reply.type('text/html').send(`
      <div style="background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.3); border-radius: 8px; padding: 1rem; margin-top: 1rem;">
        <p style="color: #22C55E; font-weight: 600; margin: 0 0 0.5rem 0;">Sync job queued (ID: ${jobId})</p>
        <p style="color: #94A3B8; font-size: 13px; margin: 0;">
          Run <code style="background: rgba(255,255,255,0.06); padding: 2px 6px; border-radius: 4px;">npm run leads:attribute:backfill</code> to process.
          The job status will update when complete.
        </p>
      </div>
    `);
  });

  // --- API endpoints for dynamic dropdowns ---

  app.get('/api/meta-accounts', async (_request, reply) => {
    const accounts = await getMetaAdAccounts();
    reply.send(accounts);
  });

  app.get('/api/gads-accounts', async (_request, reply) => {
    const accounts = await getGadsAccounts();
    reply.send(accounts);
  });

  app.get('/api/ghl-locations', async (_request, reply) => {
    const locations = await getGhlLocations();
    reply.send(locations);
  });
};

// --- Step renderers (return HTML fragments for HTMX swap) ---

function renderStep2(data: {
  clientId: number;
  clientName: string;
  crmType: string;
  metaAccounts: MetaAccountRow[];
  gadsAccounts: GadsAccountRow[];
  ga4Properties: { id: string; display_name: string | null }[];
  gscSites: { id: string }[];
  ghlLocations: { id: string; name: string }[];
  csrfToken: string;
}): string {
  const platformOptions = (platform: string) => {
    if (platform === 'meta') {
      return data.metaAccounts.map(a =>
        `<option value="${a.account_id}" data-name="${a.name || ''}">${a.name || a.account_id}</option>`
      ).join('');
    }
    if (platform === 'gads') {
      return data.gadsAccounts.map(a =>
        `<option value="${a.id}" data-name="${a.descriptive_name || ''}">${a.descriptive_name || a.id}</option>`
      ).join('');
    }
    if (platform === 'ga4') {
      return data.ga4Properties.map(a =>
        `<option value="${a.id}" data-name="${a.display_name || ''}">${a.display_name || a.id}</option>`
      ).join('');
    }
    if (platform === 'gsc') {
      return data.gscSites.map(a =>
        `<option value="${a.id}" data-name="${a.id}">${a.id}</option>`
      ).join('');
    }
    if (platform === 'ghl') {
      return data.ghlLocations.map(a =>
        `<option value="${a.id}" data-name="${a.name}">${a.name} (${a.id.slice(0, 8)}...)</option>`
      ).join('');
    }
    return '';
  };

  // Pre-build JSON for client-side use
  const accountsJson = JSON.stringify({
    meta: data.metaAccounts.map(a => ({ id: a.account_id, name: a.name })),
    gads: data.gadsAccounts.map(a => ({ id: a.id, name: a.descriptive_name })),
    ga4: data.ga4Properties.map(a => ({ id: a.id, name: a.display_name })),
    gsc: data.gscSites.map(a => ({ id: a.id, name: a.id })),
    ghl: data.ghlLocations.map(a => ({ id: a.id, name: a.name })),
  });

  return `
    <!-- Step indicator update -->
    <div id="step-indicator" hx-swap-oob="innerHTML:#step-indicator">
      ${stepIndicator(2)}
    </div>

    <div style="background: #141414; border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 1.5rem;">
      <h2 style="margin-top: 0; font-size: 16px; color: #E2E8F0; margin-bottom: 0.25rem;">Step 2: Link Platform Accounts</h2>
      <p style="color: #64748B; font-size: 13px; margin-top: 0;">Map ad accounts, analytics properties, and CRM locations to <strong style="color: #E2E8F0;">${escHtml(data.clientName)}</strong>.</p>

      <form hx-post="/admin/onboarding/link-accounts" hx-target="#wizard-content" hx-swap="innerHTML">
        <input type="hidden" name="_csrf" value="${data.csrfToken}" />
        <input type="hidden" name="client_id" value="${data.clientId}" />
        <input type="hidden" name="client_name" value="${escHtml(data.clientName)}" />
        <input type="hidden" name="crm_type" value="${escHtml(data.crmType)}" />

        <div id="account-rows" style="display: flex; flex-direction: column; gap: 0.75rem;">
          <div class="account-row" style="display: grid; grid-template-columns: 150px 1fr 1fr 40px; gap: 0.75rem; align-items: end;">
            <div>
              <label style="display: block; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: #94A3B8; margin-bottom: 4px;">Platform</label>
              <select name="platform[]" onchange="onPlatformChange(this)"
                style="width: 100%; padding: 8px 12px; background: #0B0B0B; border: 1px solid rgba(255,255,255,0.10); border-radius: 6px; color: #E2E8F0; font-size: 14px; box-sizing: border-box;">
                <option value="">Select...</option>
                <option value="meta">Meta Ads</option>
                <option value="gads">Google Ads</option>
                <option value="ga4">GA4</option>
                <option value="gsc">Search Console</option>
                <option value="ghl">GHL</option>
              </select>
            </div>
            <div>
              <label style="display: block; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: #94A3B8; margin-bottom: 4px;">Account</label>
              <select class="account-select" onchange="onAccountSelect(this)"
                style="width: 100%; padding: 8px 12px; background: #0B0B0B; border: 1px solid rgba(255,255,255,0.10); border-radius: 6px; color: #E2E8F0; font-size: 14px; box-sizing: border-box;">
                <option value="">Select platform first...</option>
              </select>
            </div>
            <div>
              <input type="hidden" name="account_id[]" value="" class="account-id-input" />
              <input type="hidden" name="account_name[]" value="" class="account-name-input" />
              <label style="display: block; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: #94A3B8; margin-bottom: 4px;">Manual ID <span style="font-weight: 400; text-transform: none;">(if not in list)</span></label>
              <input type="text" class="manual-id-input" placeholder="Paste account ID"
                onchange="onManualId(this)"
                style="width: 100%; padding: 8px 12px; background: #0B0B0B; border: 1px solid rgba(255,255,255,0.10); border-radius: 6px; color: #E2E8F0; font-size: 14px; box-sizing: border-box;" />
            </div>
            <div>
              <button type="button" onclick="removeRow(this)" title="Remove"
                style="padding: 8px; background: none; border: 1px solid rgba(239,68,68,0.2); border-radius: 6px; color: #EF4444; cursor: pointer; font-size: 16px; line-height: 1;">&#x2715;</button>
            </div>
          </div>
        </div>

        <div style="margin-top: 0.75rem;">
          <button type="button" onclick="addAccountRow()"
            style="padding: 6px 14px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.10); border-radius: 6px; color: #94A3B8; cursor: pointer; font-size: 13px;">
            + Add Another Account
          </button>
        </div>

        <div style="margin-top: 1.5rem; display: flex; gap: 0.75rem;">
          <button type="submit"
            style="padding: 8px 20px; background: #22C55E; color: #0B0B0B; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 14px;">
            Save &amp; Continue
          </button>
          <button type="submit" formaction="/admin/onboarding/link-accounts" name="skip" value="1"
            style="padding: 8px 20px; background: transparent; color: #94A3B8; border: 1px solid rgba(255,255,255,0.10); border-radius: 6px; cursor: pointer; font-size: 14px;">
            Skip
          </button>
        </div>
      </form>
    </div>

    <script>
    var _platformAccounts = ${accountsJson};

    function onPlatformChange(sel) {
      var row = sel.closest('.account-row');
      var accountSel = row.querySelector('.account-select');
      var platform = sel.value;
      var accounts = _platformAccounts[platform] || [];
      var html = '<option value="">Select account...</option>';
      accounts.forEach(function(a) {
        html += '<option value="' + a.id + '" data-name="' + (a.name || '') + '">' + (a.name || a.id) + '</option>';
      });
      if (!accounts.length) html = '<option value="">No accounts found — use manual ID</option>';
      accountSel.innerHTML = html;
      // Reset hidden fields
      row.querySelector('.account-id-input').value = '';
      row.querySelector('.account-name-input').value = '';
    }

    function onAccountSelect(sel) {
      var row = sel.closest('.account-row');
      var opt = sel.options[sel.selectedIndex];
      row.querySelector('.account-id-input').value = opt.value;
      row.querySelector('.account-name-input').value = opt.dataset.name || '';
      row.querySelector('.manual-id-input').value = '';
    }

    function onManualId(input) {
      var row = input.closest('.account-row');
      if (input.value.trim()) {
        row.querySelector('.account-id-input').value = input.value.trim();
        row.querySelector('.account-name-input').value = input.value.trim();
        row.querySelector('.account-select').value = '';
      }
    }

    function addAccountRow() {
      var container = document.getElementById('account-rows');
      var firstRow = container.querySelector('.account-row');
      var clone = firstRow.cloneNode(true);
      clone.querySelectorAll('select').forEach(function(s) { s.value = ''; });
      clone.querySelectorAll('input').forEach(function(i) { i.value = ''; });
      var accountSel = clone.querySelector('.account-select');
      accountSel.innerHTML = '<option value="">Select platform first...</option>';
      container.appendChild(clone);
    }

    function removeRow(btn) {
      var container = document.getElementById('account-rows');
      if (container.querySelectorAll('.account-row').length > 1) {
        btn.closest('.account-row').remove();
      }
    }
    </script>
  `;
}

function renderStep3(data: {
  clientId: number;
  clientName: string;
  crmType: string;
  treatments: TreatmentTypeRow[];
  csrfToken: string;
}): string {
  const treatmentRows = data.treatments.map(t => `
    <tr style="border-bottom: 1px solid rgba(255,255,255,0.04);">
      <td style="padding: 10px 12px; color: #E2E8F0; font-size: 14px;">${escHtml(t.label)}</td>
      <td style="padding: 10px 12px; color: #64748B; font-size: 13px;">${escHtml(t.vertical)}</td>
      <td style="padding: 10px 12px;">
        <input type="hidden" name="treatment_id[]" value="${t.id}" />
        <input type="number" name="treatment_value[]" value="${t.default_value}" step="0.01" min="0"
          style="width: 120px; padding: 6px 10px; background: #0B0B0B; border: 1px solid rgba(255,255,255,0.10); border-radius: 6px; color: #E2E8F0; font-size: 14px; text-align: right;" />
      </td>
    </tr>
  `).join('');

  return `
    <div id="step-indicator" hx-swap-oob="innerHTML:#step-indicator">
      ${stepIndicator(3)}
    </div>

    <div style="background: #141414; border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 1.5rem;">
      <h2 style="margin-top: 0; font-size: 16px; color: #E2E8F0; margin-bottom: 0.25rem;">Step 3: Treatment Values</h2>
      <p style="color: #64748B; font-size: 13px; margin-top: 0;">Set the average treatment values for <strong style="color: #E2E8F0;">${escHtml(data.clientName)}</strong>. These are used for ROI calculations.</p>

      <form hx-post="/admin/onboarding/treatments" hx-target="#wizard-content" hx-swap="innerHTML">
        <input type="hidden" name="_csrf" value="${data.csrfToken}" />
        <input type="hidden" name="client_id" value="${data.clientId}" />
        <input type="hidden" name="client_name" value="${escHtml(data.clientName)}" />
        <input type="hidden" name="crm_type" value="${escHtml(data.crmType)}" />

        ${data.treatments.length ? `
        <div style="overflow-x: auto; margin-bottom: 1rem;">
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="border-bottom: 1px solid rgba(255,255,255,0.08);">
                <th style="text-align: left; padding: 10px 12px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: #94A3B8;">Treatment</th>
                <th style="text-align: left; padding: 10px 12px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: #94A3B8;">Vertical</th>
                <th style="text-align: left; padding: 10px 12px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: #94A3B8;">Value (GBP)</th>
              </tr>
            </thead>
            <tbody>
              ${treatmentRows}
            </tbody>
          </table>
        </div>
        ` : `
        <p style="color: #64748B; font-size: 13px; padding: 1rem 0;">No treatment types configured yet. You can add them later in the database.</p>
        `}

        <div style="display: flex; gap: 0.75rem;">
          <button type="submit"
            style="padding: 8px 20px; background: #22C55E; color: #0B0B0B; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 14px;">
            Save &amp; Continue
          </button>
          <button type="submit" name="skip" value="1"
            style="padding: 8px 20px; background: transparent; color: #94A3B8; border: 1px solid rgba(255,255,255,0.10); border-radius: 6px; cursor: pointer; font-size: 14px;">
            Skip
          </button>
        </div>
      </form>
    </div>
  `;
}

function renderStep4(data: {
  clientId: number;
  clientName: string;
  crmType: string;
  csrfToken: string;
  error?: string;
}): string {
  return `
    <div id="step-indicator" hx-swap-oob="innerHTML:#step-indicator">
      ${stepIndicator(4)}
    </div>

    <div style="background: #141414; border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 1.5rem;">
      <h2 style="margin-top: 0; font-size: 16px; color: #E2E8F0; margin-bottom: 0.25rem;">Step 4: Create Portal User</h2>
      <p style="color: #64748B; font-size: 13px; margin-top: 0;">Create a login for <strong style="color: #E2E8F0;">${escHtml(data.clientName)}</strong> to access their performance portal.</p>

      ${data.error ? `
      <div style="background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); border-radius: 8px; padding: 0.75rem 1rem; margin-bottom: 1rem; color: #EF4444; font-size: 14px;">
        ${escHtml(data.error)}
      </div>
      ` : ''}

      <form hx-post="/admin/onboarding/portal-user" hx-target="#wizard-content" hx-swap="innerHTML">
        <input type="hidden" name="_csrf" value="${data.csrfToken}" />
        <input type="hidden" name="client_id" value="${data.clientId}" />
        <input type="hidden" name="client_name" value="${escHtml(data.clientName)}" />
        <input type="hidden" name="crm_type" value="${escHtml(data.crmType)}" />

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
          <div>
            <label style="display: block; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: #94A3B8; margin-bottom: 4px;">Contact Name</label>
            <input type="text" name="portal_user_name" placeholder="Jane Smith"
              style="width: 100%; padding: 8px 12px; background: #0B0B0B; border: 1px solid rgba(255,255,255,0.10); border-radius: 6px; color: #E2E8F0; font-size: 14px; box-sizing: border-box;" />
          </div>
          <div>
            <label style="display: block; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: #94A3B8; margin-bottom: 4px;">Email</label>
            <input type="email" name="email" placeholder="client@example.com"
              style="width: 100%; padding: 8px 12px; background: #0B0B0B; border: 1px solid rgba(255,255,255,0.10); border-radius: 6px; color: #E2E8F0; font-size: 14px; box-sizing: border-box;" />
          </div>
          <div>
            <label style="display: block; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: #94A3B8; margin-bottom: 4px;">Temporary Password</label>
            <input type="text" name="password" placeholder="They will change this on first login"
              style="width: 100%; padding: 8px 12px; background: #0B0B0B; border: 1px solid rgba(255,255,255,0.10); border-radius: 6px; color: #E2E8F0; font-size: 14px; box-sizing: border-box;" />
          </div>
        </div>

        <div style="display: flex; gap: 0.75rem;">
          <button type="submit"
            style="padding: 8px 20px; background: #22C55E; color: #0B0B0B; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 14px;">
            Create User &amp; Continue
          </button>
          <button type="submit" name="skip_user" value="1"
            style="padding: 8px 20px; background: transparent; color: #94A3B8; border: 1px solid rgba(255,255,255,0.10); border-radius: 6px; cursor: pointer; font-size: 14px;">
            Skip — create later
          </button>
        </div>
      </form>
    </div>
  `;
}

function renderStep5(data: {
  clientId: number;
  clientName: string;
  crmType: string;
  mappings: { source: string; external_id: string; external_name: string | null }[];
  portalUserCreated: boolean;
  skipUser: boolean;
  portalEmail: string;
  csrfToken: string;
}): string {
  const platformColours: Record<string, string> = {
    ghl: '#4ADE80', meta: '#1877F2', gads: '#FBBC05', ga4: '#E37400', gsc: '#4285F4',
  };

  const mappingRows = data.mappings.map(m => `
    <tr style="border-bottom: 1px solid rgba(255,255,255,0.04);">
      <td style="padding: 8px 12px;">
        <span style="padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; background: rgba(255,255,255,0.06); color: ${platformColours[m.source] || '#94A3B8'};">
          ${escHtml(m.source)}
        </span>
      </td>
      <td style="padding: 8px 12px; color: #E2E8F0; font-size: 13px;">${escHtml(m.external_name || m.external_id)}</td>
      <td style="padding: 8px 12px; color: #64748B; font-size: 12px; font-family: monospace;">${escHtml(m.external_id)}</td>
    </tr>
  `).join('');

  return `
    <div id="step-indicator" hx-swap-oob="innerHTML:#step-indicator">
      ${stepIndicator(5)}
    </div>

    <div style="background: #141414; border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 1.5rem;">
      <h2 style="margin-top: 0; font-size: 16px; color: #E2E8F0; margin-bottom: 0.25rem;">Step 5: Summary &amp; Sync</h2>
      <p style="color: #64748B; font-size: 13px; margin-top: 0;">Review the configuration for <strong style="color: #E2E8F0;">${escHtml(data.clientName)}</strong>.</p>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem;">
        <div style="background: #0B0B0B; border: 1px solid rgba(255,255,255,0.06); border-radius: 6px; padding: 1rem;">
          <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: #94A3B8; margin-bottom: 0.5rem;">Client</div>
          <div style="color: #E2E8F0; font-size: 14px; font-weight: 500;">${escHtml(data.clientName)}</div>
          <div style="color: #64748B; font-size: 12px; margin-top: 4px;">CRM: ${escHtml(data.crmType)} | ID: ${data.clientId}</div>
        </div>
        <div style="background: #0B0B0B; border: 1px solid rgba(255,255,255,0.06); border-radius: 6px; padding: 1rem;">
          <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: #94A3B8; margin-bottom: 0.5rem;">Portal User</div>
          ${data.portalUserCreated
            ? `<div style="color: #22C55E; font-size: 14px;">Created: ${escHtml(data.portalEmail)}</div>`
            : data.skipUser
              ? '<div style="color: #F59E0B; font-size: 14px;">Skipped — create later</div>'
              : '<div style="color: #64748B; font-size: 14px;">Not created</div>'
          }
        </div>
      </div>

      ${data.mappings.length ? `
      <div style="margin-bottom: 1.5rem;">
        <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: #94A3B8; margin-bottom: 0.5rem;">Linked Accounts (${data.mappings.length})</div>
        <table style="width: 100%; border-collapse: collapse;">
          <tbody>${mappingRows}</tbody>
        </table>
      </div>
      ` : `
      <div style="margin-bottom: 1.5rem; color: #64748B; font-size: 13px;">No platform accounts linked.</div>
      `}

      <div style="border-top: 1px solid rgba(255,255,255,0.06); padding-top: 1rem;">
        <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: #94A3B8; margin-bottom: 0.75rem;">Trigger Data Sync</div>
        <p style="color: #64748B; font-size: 13px; margin-top: 0;">
          Queue an attribution backfill for this client. This creates a sync job record; the actual processing runs via <code style="background: rgba(255,255,255,0.06); padding: 2px 6px; border-radius: 4px;">npm run leads:attribute:backfill</code>.
        </p>

        <div style="display: flex; gap: 0.75rem; align-items: center;">
          <button type="button"
            hx-post="/admin/onboarding/trigger-sync"
            hx-target="#sync-result"
            hx-swap="innerHTML"
            hx-vals='{"_csrf": "${data.csrfToken}", "client_id": "${data.clientId}", "client_name": "${escHtml(data.clientName)}"}'
            style="padding: 8px 20px; background: #3B82F6; color: #fff; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 14px;">
            Start Sync
          </button>
          <a href="/admin/onboarding"
            style="padding: 8px 20px; background: transparent; color: #94A3B8; border: 1px solid rgba(255,255,255,0.10); border-radius: 6px; text-decoration: none; font-size: 14px;">
            Onboard Another Client
          </a>
          <a href="/admin/client-mapping"
            style="padding: 8px 20px; background: transparent; color: #94A3B8; border: 1px solid rgba(255,255,255,0.10); border-radius: 6px; text-decoration: none; font-size: 14px;">
            View All Mappings
          </a>
        </div>
        <div id="sync-result"></div>
      </div>
    </div>
  `;
}

function stepIndicator(activeStep: number): string {
  const steps = [
    { num: 1, label: 'Client' },
    { num: 2, label: 'Accounts' },
    { num: 3, label: 'Treatments' },
    { num: 4, label: 'Portal User' },
    { num: 5, label: 'Sync' },
  ];
  return steps.map(s => {
    const isActive = s.num === activeStep;
    const isDone = s.num < activeStep;
    const colour = isActive ? '#22C55E' : isDone ? '#22C55E' : '#64748B';
    const bg = isActive ? 'rgba(34,197,94,0.15)' : isDone ? 'rgba(34,197,94,0.08)' : 'transparent';
    const border = isActive ? '1px solid rgba(34,197,94,0.3)' : '1px solid rgba(255,255,255,0.06)';
    return `
      <div style="display: flex; align-items: center; gap: 0.5rem; padding: 6px 12px; border-radius: 6px; background: ${bg}; border: ${border};">
        <span style="width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 600; color: ${isDone ? '#0B0B0B' : colour}; background: ${isDone ? '#22C55E' : 'transparent'}; border: 1.5px solid ${colour};">
          ${isDone ? '&#10003;' : s.num}
        </span>
        <span style="font-size: 13px; color: ${colour}; font-weight: ${isActive ? '600' : '400'};">${s.label}</span>
      </div>
    `;
  }).join('<div style="width: 20px; height: 1px; background: rgba(255,255,255,0.10);"></div>');
}

function escHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
