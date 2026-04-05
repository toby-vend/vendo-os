/**
 * Email notification utility using Resend (or SMTP fallback).
 *
 * Set RESEND_API_KEY in .env.local to enable.
 * Falls back to console log if not configured.
 *
 * Usage:
 *   import { sendEmailAlert } from '../utils/email-alert.js';
 *   await sendEmailAlert('toby@vendodigital.co.uk', 'Alert Subject', 'Alert body text');
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const DEFAULT_FROM = process.env.EMAIL_FROM || 'Vendo OS <alerts@vendodigital.co.uk>';

export async function sendEmailAlert(
  to: string | string[],
  subject: string,
  body: string,
  html?: string,
): Promise<boolean> {
  const recipients = Array.isArray(to) ? to : [to];

  if (!RESEND_API_KEY) {
    console.log(`[EMAIL] Not configured — would send to ${recipients.join(', ')}: ${subject}`);
    return false;
  }

  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: DEFAULT_FROM,
        to: recipients,
        subject,
        text: body,
        html: html || undefined,
      }),
    });

    if (!resp.ok) {
      const errBody = await resp.text();
      console.error(`[EMAIL] Resend API ${resp.status}: ${errBody}`);
      return false;
    }

    console.log(`[EMAIL] Sent to ${recipients.join(', ')}: ${subject}`);
    return true;
  } catch (err) {
    console.error(`[EMAIL] Failed:`, err instanceof Error ? err.message : String(err));
    return false;
  }
}

/**
 * Send alert to configured alert recipients.
 * Uses ALERT_EMAIL_RECIPIENTS from .env.local (comma-separated).
 */
export async function sendAlertEmail(subject: string, body: string): Promise<boolean> {
  const recipients = (process.env.ALERT_EMAIL_RECIPIENTS || '').split(',').map(e => e.trim()).filter(Boolean);
  if (!recipients.length) {
    console.log(`[EMAIL] No ALERT_EMAIL_RECIPIENTS configured — skipping: ${subject}`);
    return false;
  }
  return sendEmailAlert(recipients, `[Vendo OS] ${subject}`, body);
}
