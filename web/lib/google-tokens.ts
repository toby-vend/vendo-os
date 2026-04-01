import { getUserOAuthToken, updateUserOAuthAccessToken } from './queries.js';
import { encryptToken, decryptToken } from './crypto.js';

/**
 * Get a valid Google access token for a user.
 * Returns null if the user hasn't connected their Google account.
 * Automatically refreshes expired tokens.
 */
export async function getGoogleAccessToken(userId: string): Promise<string | null> {
  const row = await getUserOAuthToken(userId, 'google');
  if (!row) return null;

  const accessToken = decryptToken(row.access_token_enc);
  const refreshToken = decryptToken(row.refresh_token_enc);

  // If token is still valid (60s buffer), return it
  if (row.token_expiry > Date.now() + 60_000) {
    return accessToken;
  }

  // Refresh the token
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required');
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    console.error(`[Google] Token refresh failed (${res.status}): ${errBody}`);
    return null;
  }

  const data = await res.json() as { access_token: string; expires_in: number };
  const newExpiry = Date.now() + data.expires_in * 1000;
  const newAccessTokenEnc = encryptToken(data.access_token);

  await updateUserOAuthAccessToken(userId, 'google', newAccessTokenEnc, newExpiry);

  return data.access_token;
}
