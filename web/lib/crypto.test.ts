import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

// Set env vars before importing the module under test
process.env.TOKEN_ENCRYPTION_KEY = 'test-current-key-abc123';
process.env.TOKEN_ENCRYPTION_KEY_PREVIOUS = 'test-previous-key-xyz789';

// Dynamic import after env is set
let encryptToken: (plaintext: string) => string;
let decryptToken: (ciphertext: string) => string;
let isV0Token: (ciphertext: string) => boolean;

before(async () => {
  const mod = await import('./crypto.js');
  encryptToken = mod.encryptToken;
  decryptToken = mod.decryptToken;
  isV0Token = mod.isV0Token;
});

describe('encryptToken', () => {
  it('produces output starting with "v1:"', () => {
    const result = encryptToken('my-secret-token');
    assert.ok(result.startsWith('v1:'), `Expected v1: prefix, got: ${result}`);
  });
});

describe('decryptToken', () => {
  it('decrypts a v1-prefixed token correctly', () => {
    const original = 'hello-world-token';
    const encrypted = encryptToken(original);
    assert.ok(encrypted.startsWith('v1:'));
    const decrypted = decryptToken(encrypted);
    assert.equal(decrypted, original);
  });

  it('decrypts a bare base64 (v0) token correctly with current key', () => {
    // Produce a v0 token by stripping the v1: prefix from a freshly encrypted token
    const original = 'v0-token-value';
    const v1Encrypted = encryptToken(original);
    const v0Ciphertext = v1Encrypted.slice(3); // strip 'v1:' prefix
    const decrypted = decryptToken(v0Ciphertext);
    assert.equal(decrypted, original);
  });

  it('decrypts a v0 token with TOKEN_ENCRYPTION_KEY_PREVIOUS when current key fails', async () => {
    // Build a v0 ciphertext encrypted with the previous key directly via Node crypto
    const nodeCrypto = await import('node:crypto');
    const prevKeyRaw = 'test-previous-key-xyz789';
    const prevKeyBuf = nodeCrypto.scryptSync(prevKeyRaw, 'vendoos-token-encryption', 32);
    const iv = nodeCrypto.randomBytes(12);
    const cipher = nodeCrypto.createCipheriv('aes-256-gcm', prevKeyBuf, iv, { authTagLength: 16 });
    const plaintext = 'previous-key-token';
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    // v0 format: bare base64(iv + authTag + ciphertext)
    const v0Ciphertext = Buffer.concat([iv, authTag, encrypted]).toString('base64');

    const decrypted = decryptToken(v0Ciphertext);
    assert.equal(decrypted, plaintext);
  });

  it('throws a clear error when both keys fail', () => {
    const garbage = Buffer.alloc(28, 0xff).toString('base64'); // 28 bytes: 12 iv + 16 authTag
    assert.throws(
      () => decryptToken(garbage),
      (err: Error) => {
        assert.ok(err instanceof Error);
        assert.ok(err.message.includes('decryption failed'), `Unexpected message: ${err.message}`);
        return true;
      }
    );
  });
});

describe('isV0Token', () => {
  it('returns true for bare base64', () => {
    assert.equal(isV0Token('SGVsbG8gV29ybGQ='), true);
  });

  it('returns false for v1: prefixed tokens', () => {
    assert.equal(isV0Token('v1:SGVsbG8gV29ybGQ='), false);
  });
});

describe('round-trip', () => {
  it('encryptToken then decryptToken returns original plaintext', () => {
    const original = 'round-trip-secret-value-12345';
    assert.equal(decryptToken(encryptToken(original)), original);
  });
});
