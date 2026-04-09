import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Derives a 32-byte key from the ENCRYPTION_KEY env var using scrypt.
 * Falls back to a deterministic dev key so the app still works without
 * the env var — but logs a warning on first use.
 */
let derivedKey: Buffer | null = null;

function getKey(): Buffer {
  if (derivedKey) return derivedKey;

  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    console.warn('[crypto] ENCRYPTION_KEY not set — using insecure dev key. Set it in production!');
  }
  const passphrase = raw || 'openmerch-dev-key-do-not-use-in-production';
  derivedKey = scryptSync(passphrase, 'openmerch-salt', 32);
  return derivedKey;
}

/**
 * Encrypts a plaintext string. Returns a base64 string containing
 * iv + authTag + ciphertext so it can be stored in a single DB column.
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Pack: iv (16) + authTag (16) + ciphertext
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

/**
 * Decrypts a value previously encrypted with `encrypt()`.
 * Returns null if decryption fails (wrong key, corrupted data).
 */
export function decrypt(encoded: string): string | null {
  try {
    const key = getKey();
    const buf = Buffer.from(encoded, 'base64');
    if (buf.length < IV_LENGTH + AUTH_TAG_LENGTH) return null;
    const iv = buf.subarray(0, IV_LENGTH);
    const authTag = buf.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const ciphertext = buf.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString('utf8');
  } catch {
    return null;
  }
}
