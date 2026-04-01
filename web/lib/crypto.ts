import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const SALT = 'vendoos-token-encryption';

// Eager key cache — scrypt is intentionally slow; cache per env value
const _keys = new Map<string, Buffer>();

function deriveKey(envValue: string): Buffer {
  if (_keys.has(envValue)) return _keys.get(envValue)!;
  const key = crypto.scryptSync(envValue, SALT, 32);
  _keys.set(envValue, key);
  return key;
}

function getCurrentKey(): Buffer {
  const val = process.env.TOKEN_ENCRYPTION_KEY;
  if (!val) throw new Error('TOKEN_ENCRYPTION_KEY environment variable is required for token encryption');
  return deriveKey(val);
}

function getPreviousKey(): Buffer | null {
  const val = process.env.TOKEN_ENCRYPTION_KEY_PREVIOUS;
  return val ? deriveKey(val) : null;
}

export function encryptToken(plaintext: string): string {
  const key = getCurrentKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // v1 format: 'v1:' + base64(iv + authTag + ciphertext)
  return 'v1:' + Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

function decryptWithKey(payload: string, key: Buffer): string | null {
  try {
    const data = Buffer.from(payload, 'base64');
    const iv = data.subarray(0, IV_LENGTH);
    const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
    decipher.setAuthTag(authTag);
    return decipher.update(encrypted) + decipher.final('utf8');
  } catch {
    return null;
  }
}

export function decryptToken(ciphertext: string): string {
  // Strip v1: prefix if present; bare base64 is treated as v0 (legacy)
  const payload = ciphertext.startsWith('v1:') ? ciphertext.slice(3) : ciphertext;

  // Try current key first
  const result = decryptWithKey(payload, getCurrentKey());
  if (result !== null) return result;

  // Fall back to previous key during rotation window
  const prevKey = getPreviousKey();
  if (prevKey) {
    const fallback = decryptWithKey(payload, prevKey);
    if (fallback !== null) return fallback;
  }

  throw new Error('Token decryption failed — key may have rotated without migration');
}

// Exported for google-tokens.ts lazy migration check
export function isV0Token(ciphertext: string): boolean {
  return !ciphertext.startsWith('v1:');
}
