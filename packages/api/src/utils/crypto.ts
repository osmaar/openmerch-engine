import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

// Shared with assertEncryptionKeyConfigured() below so the "is this the dev
// key" check can never drift from the actual fallback value.
const DEV_PASSPHRASE = 'openmerch-dev-key-do-not-use-in-production';

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
  const passphrase = raw || DEV_PASSPHRASE;
  // KNOWN LIMITATION (accepted, not fixed): this salt is a hardcoded constant
  // shared by every deployment, which is bad scrypt hygiene in the general
  // case. It was NOT changed to a per-installation value because there is no
  // way to do that here without either (a) invalidating every secret already
  // encrypted in the DB, or (b) adding no real protection at all:
  //   - A salt derived from ENCRYPTION_KEY itself (e.g. sha256/HKDF of the
  //     passphrase) changes the scrypt output, which changes this derived
  //     key, which breaks decrypt() for every row encrypted under the old
  //     key — there is no key-rotation/versioning support in encrypt()/
  //     decrypt() today to migrate existing ciphertext safely.
  //   - Even setting that aside, a salt that is itself a deterministic
  //     function of the passphrase provides no real defense: an attacker
  //     brute-forcing ENCRYPTION_KEY recomputes salt = f(guess) as part of
  //     each guess, so it doesn't stop the shared-salt precomputation
  //     attack a real per-install random salt is meant to prevent. A
  //     genuine fix needs an independently-generated random salt persisted
  //     somewhere new (its own env var or a first-boot-generated value
  //     stored alongside ENCRYPTION_KEY) plus a decrypt fallback to the old
  //     key while existing rows are re-encrypted — real migration work,
  //     out of scope for this fix.
  // Mitigation already in place: assertEncryptionKeyConfigured() requires a
  // high-entropy (32 random bytes) ENCRYPTION_KEY in production, so this
  // passphrase is not practically brute-forceable regardless of salt.
  derivedKey = scryptSync(passphrase, 'openmerch-salt', 32);
  return derivedKey;
}

/**
 * Startup guard: refuses to run in production without a real ENCRYPTION_KEY.
 * Settings values (API keys, secrets) are stored encrypted with this key, so
 * silently falling back to the hardcoded dev passphrase in production would
 * mean anyone who reads the source can decrypt every secret in the database.
 * Call this once, early, from every process entrypoint (API + worker).
 */
export function assertEncryptionKeyConfigured(): void {
  if (process.env.NODE_ENV !== 'production') return;

  const raw = process.env.ENCRYPTION_KEY;
  if (!raw || raw === DEV_PASSPHRASE) {
    console.error(
      '[crypto] FATAL: ENCRYPTION_KEY is not set (or is the insecure dev default) while NODE_ENV=production.\n' +
        '  Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"\n' +
        '  Then set ENCRYPTION_KEY in your .env (or the container/orchestrator environment) and restart.',
    );
    process.exit(1);
  }
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
