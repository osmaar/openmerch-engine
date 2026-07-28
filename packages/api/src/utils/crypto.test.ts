import { describe, it, expect } from 'vitest';
import { encrypt, decrypt } from './crypto.js';

describe('encrypt/decrypt roundtrip', () => {
  it('roundtrips a normal string', () => {
    const plaintext = 'sk-unsplash-1234567890abcdef';
    expect(decrypt(encrypt(plaintext))).toBe(plaintext);
  });

  it('roundtrips an empty string', () => {
    expect(decrypt(encrypt(''))).toBe('');
  });

  it('roundtrips a string with unicode and emoji', () => {
    const plaintext = 'clave-secreta-ñáéíóú-🔐🚀-日本語';
    expect(decrypt(encrypt(plaintext))).toBe(plaintext);
  });

  it('roundtrips a long string', () => {
    const plaintext = 'x'.repeat(10_000);
    expect(decrypt(encrypt(plaintext))).toBe(plaintext);
  });

  it('works with the dev fallback key when ENCRYPTION_KEY is not set', () => {
    // The module caches its derived key on first use, so this test mainly
    // documents that encrypt/decrypt work without any special CI setup —
    // whatever key is currently in effect (env var or dev fallback), a
    // roundtrip must still succeed.
    expect(process.env.ENCRYPTION_KEY).toBeUndefined();
    const plaintext = 'dev-fallback-key-roundtrip';
    expect(decrypt(encrypt(plaintext))).toBe(plaintext);
  });
});

describe('decrypt() error handling', () => {
  it('returns null (does not throw) for a payload shorter than IV+authTag', () => {
    // IV (16) + authTag (16) = 32 bytes minimum; base64 of a short buffer.
    const tooShort = Buffer.from('short').toString('base64');
    expect(() => decrypt(tooShort)).not.toThrow();
    expect(decrypt(tooShort)).toBeNull();
  });

  it('returns null for an empty string payload', () => {
    expect(decrypt('')).toBeNull();
  });

  it('returns null (does not throw) for a truncated valid ciphertext', () => {
    const encrypted = encrypt('some secret value');
    const buf = Buffer.from(encrypted, 'base64');
    const truncated = buf.subarray(0, buf.length - 5).toString('base64');
    expect(() => decrypt(truncated)).not.toThrow();
    expect(decrypt(truncated)).toBeNull();
  });

  it('returns null (does not throw) for a non-base64 string', () => {
    // Characters outside the base64 alphabet; Buffer.from(..., 'base64')
    // does not throw in Node, but the resulting bytes should fail to
    // authenticate/decrypt cleanly.
    const invalid = '!!!not-valid-base64!!!***';
    expect(() => decrypt(invalid)).not.toThrow();
    expect(decrypt(invalid)).toBeNull();
  });

  it('returns null (does not throw) for garbage that happens to be valid base64', () => {
    const garbage = Buffer.from('this is definitely not an encrypted payload, just garbage bytes').toString(
      'base64',
    );
    expect(() => decrypt(garbage)).not.toThrow();
    expect(decrypt(garbage)).toBeNull();
  });

  it('returns null and does not reveal plaintext when the authTag is tampered with', () => {
    const plaintext = 'super-secret-api-key';
    const encrypted = encrypt(plaintext);
    const buf = Buffer.from(encrypted, 'base64');

    // Layout is iv(16) + authTag(16) + ciphertext. Flip a byte inside the authTag.
    const tampered = Buffer.from(buf);
    const authTagOffset = 16;
    tampered[authTagOffset] = tampered[authTagOffset]! ^ 0xff;

    const result = decrypt(tampered.toString('base64'));
    expect(result).toBeNull();
    // Make sure the failure mode is a clean null, not a partial/garbled
    // plaintext leak.
    expect(result).not.toBe(plaintext);
  });

  it('returns null when the ciphertext bytes are tampered with', () => {
    const plaintext = 'super-secret-api-key';
    const encrypted = encrypt(plaintext);
    const buf = Buffer.from(encrypted, 'base64');

    const tampered = Buffer.from(buf);
    const ciphertextOffset = 32; // iv(16) + authTag(16)
    expect(tampered.length).toBeGreaterThan(ciphertextOffset);
    tampered[ciphertextOffset] = tampered[ciphertextOffset]! ^ 0xff;

    const result = decrypt(tampered.toString('base64'));
    expect(result).toBeNull();
    expect(result).not.toBe(plaintext);
  });
});

describe('encrypt() randomness', () => {
  it('produces different ciphertexts for the same plaintext (random IV)', () => {
    const plaintext = 'same-plaintext-every-time';
    const a = encrypt(plaintext);
    const b = encrypt(plaintext);
    expect(a).not.toBe(b);
    // But both must still decrypt back to the original value.
    expect(decrypt(a)).toBe(plaintext);
    expect(decrypt(b)).toBe(plaintext);
  });

  it('produces ciphertexts with different IV prefixes across calls', () => {
    const plaintext = 'iv-randomness-check';
    const ivs = new Set<string>();
    for (let i = 0; i < 10; i++) {
      const buf = Buffer.from(encrypt(plaintext), 'base64');
      ivs.add(buf.subarray(0, 16).toString('hex'));
    }
    // All 10 IVs should be unique.
    expect(ivs.size).toBe(10);
  });
});
