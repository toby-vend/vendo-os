/**
 * Send invite notifications via Slack DM and Gmail when a new user is created.
 * Failures are logged but don't block user creation.
 */

const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN || '';
const APP_URL = process.env.APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

// Google OAuth for sending email
const GDRIVE_CREDENTIALS_PATH = process.env.GDRIVE_CREDENTIALS_PATH || '';
const GDRIVE_OAUTH_PATH = process.env.GDRIVE_OAUTH_PATH || '';

interface InviteDetails {
  name: string;
  email: string;
  password: string;
  role: string;
  invitedBy: string;
}

// ── Slack DM ──────────────────────────────────────────────

async function findSlackUserByEmail(email: string): Promise<string | null> {
  if (!SLACK_BOT_TOKEN) return null;
  try {
    const res = await fetch(`https://slack.com/api/users.lookupByEmail?email=${encodeURIComponent(email)}`, {
      headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}` },
    });
    const data = await res.json() as { ok: boolean; user?: { id: string } };
    return data.ok ? data.user!.id : null;
  } catch {
    return null;
  }
}

async function sendSlackDM(userId: string, text: string): Promise<boolean> {
  if (!SLACK_BOT_TOKEN) return false;
  try {
    const res = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ channel: userId, text }),
    });
    const data = await res.json() as { ok: boolean; error?: string };
    if (!data.ok) console.error('[notify] Slack DM failed:', data.error);
    return data.ok;
  } catch (e) {
    console.error('[notify] Slack DM error:', e);
    return false;
  }
}

// ── Gmail (via Google API using existing OAuth credentials) ──

async function getGmailAccessToken(): Promise<string | null> {
  if (!GDRIVE_CREDENTIALS_PATH || !GDRIVE_OAUTH_PATH) return null;
  try {
    const { readFileSync, writeFileSync } = await import('fs');
    const tokenData = JSON.parse(readFileSync(GDRIVE_CREDENTIALS_PATH, 'utf-8'));
    const oauthKeys = JSON.parse(readFileSync(GDRIVE_OAUTH_PATH, 'utf-8'));

    // Check if we have gmail.send scope — if not, we can't send
    const scopes: string = tokenData.scope || '';
    if (!scopes.includes('gmail.send')) return null;

    // Refresh if expired
    if (tokenData.expiry_date <= Date.now() + 60_000) {
      const res = await fetch(oauthKeys.installed.token_uri, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: oauthKeys.installed.client_id,
          client_secret: oauthKeys.installed.client_secret,
          refresh_token: tokenData.refresh_token,
          grant_type: 'refresh_token',
        }),
      });
      const refreshed = await res.json() as { access_token: string; expires_in: number };
      tokenData.access_token = refreshed.access_token;
      tokenData.expiry_date = Date.now() + refreshed.expires_in * 1000;
      writeFileSync(GDRIVE_CREDENTIALS_PATH, JSON.stringify(tokenData), 'utf-8');
    }

    return tokenData.access_token;
  } catch {
    return null;
  }
}

async function sendGmail(to: string, subject: string, bodyHtml: string): Promise<boolean> {
  const token = await getGmailAccessToken();
  if (!token) return false;

  try {
    // Build RFC 2822 message
    const boundary = '----=_VendoOS_' + Date.now();
    const rawMessage = [
      `To: ${to}`,
      `Subject: ${subject}`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/html; charset=UTF-8',
      '',
      bodyHtml,
      '',
      `--${boundary}--`,
    ].join('\r\n');

    // Base64url encode
    const encoded = Buffer.from(rawMessage)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw: encoded }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('[notify] Gmail send failed:', res.status, err.slice(0, 200));
      return false;
    }
    return true;
  } catch (e) {
    console.error('[notify] Gmail error:', e);
    return false;
  }
}

// ── Public API ────────────────────────────────────────────

export async function sendInviteNotifications(details: InviteDetails): Promise<{ slack: boolean; email: boolean }> {
  const loginUrl = `${APP_URL}/login`;

  const slackMessage = [
    `👋 Hi ${details.name}! You've been invited to *Vendo OS* by ${details.invitedBy}.`,
    '',
    `🔗 *Login:* ${loginUrl}`,
    `📧 *Email:* ${details.email}`,
    `🔑 *Temporary password:* \`${details.password}\``,
    `👤 *Role:* ${details.role}`,
    '',
    `You'll be asked to change your password on first login.`,
  ].join('\n');

  const emailHtml = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="display: inline-block; width: 48px; height: 48px; background: #22C55E; border-radius: 12px; line-height: 48px; color: #0B0B0B; font-weight: 700; font-size: 22px;">V</div>
      </div>
      <h2 style="margin: 0 0 8px; font-size: 22px; color: #1a1a1a;">You're invited to Vendo OS</h2>
      <p style="color: #555; font-size: 15px; line-height: 1.5;">${details.invitedBy} has invited you to the Vendo OS team dashboard.</p>
      <div style="background: #f8f9fa; border-radius: 10px; padding: 20px; margin: 20px 0;">
        <p style="margin: 0 0 8px; font-size: 13px; color: #888;">YOUR LOGIN DETAILS</p>
        <p style="margin: 4px 0; font-size: 15px;"><strong>Email:</strong> ${details.email}</p>
        <p style="margin: 4px 0; font-size: 15px;"><strong>Temporary password:</strong> <code style="background: #e9ecef; padding: 2px 8px; border-radius: 4px;">${details.password}</code></p>
        <p style="margin: 4px 0; font-size: 15px;"><strong>Role:</strong> ${details.role}</p>
      </div>
      <a href="${loginUrl}" style="display: inline-block; padding: 12px 28px; background: #22C55E; color: #0B0B0B; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; margin: 8px 0;">Log in to Vendo OS</a>
      <p style="color: #999; font-size: 13px; margin-top: 24px;">You'll be asked to set a new password on your first login.</p>
    </div>
  `;

  // Run both in parallel — neither blocks user creation
  const [slack, email] = await Promise.all([
    (async () => {
      const slackUserId = await findSlackUserByEmail(details.email);
      if (!slackUserId) {
        console.log(`[notify] No Slack user found for ${details.email} — skipping DM`);
        return false;
      }
      return sendSlackDM(slackUserId, slackMessage);
    })(),
    sendGmail(details.email, `You're invited to Vendo OS`, emailHtml),
  ]);

  console.log(`[notify] Invite sent to ${details.email} — Slack: ${slack}, Email: ${email}`);
  return { slack, email };
}
