import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { encrypt, decrypt } from '../utils/crypto.js';

type FakeRow = { key: string; value: string; isSecret: boolean | null };

const selectMock = vi.fn<() => Promise<FakeRow[]>>();

vi.mock('../db/index.js', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => selectMock(),
      }),
    }),
  },
}));

const { resolveSettingValue, isUnchangedMaskedSecret, resolveStoredValue } = await import('./settings.js');

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  selectMock.mockReset();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('resolveSettingValue()', () => {
  it('decrypts and returns the value when the row is secret', async () => {
    const plaintext = 'sk-real-unsplash-key';
    selectMock.mockResolvedValue([{ key: 'unsplash_key', value: encrypt(plaintext), isSecret: true }]);

    await expect(resolveSettingValue('unsplash_key')).resolves.toBe(plaintext);
  });

  it('returns the plain value as-is when the row is not secret', async () => {
    selectMock.mockResolvedValue([{ key: 'store_name', value: 'Acme Merch', isSecret: false }]);

    await expect(resolveSettingValue('store_name')).resolves.toBe('Acme Merch');
  });

  it('returns null when a secret row fails to decrypt (corrupted ciphertext)', async () => {
    selectMock.mockResolvedValue([{ key: 'unsplash_key', value: 'not-a-valid-ciphertext', isSecret: true }]);

    await expect(resolveSettingValue('unsplash_key')).resolves.toBeNull();
  });

  it('falls back to the mapped env var when no row exists for a known key', async () => {
    selectMock.mockResolvedValue([]);
    process.env.VITE_UNSPLASH_ACCESS_KEY = 'env-fallback-value';

    await expect(resolveSettingValue('unsplash_key')).resolves.toBe('env-fallback-value');
  });

  it('returns null for an unknown key with no row and no env fallback', async () => {
    selectMock.mockResolvedValue([]);

    await expect(resolveSettingValue('some_unknown_setting_key')).resolves.toBeNull();
  });
});

describe('isUnchangedMaskedSecret()', () => {
  it('is true for a secret entry that resends the masked placeholder', () => {
    expect(isUnchangedMaskedSecret({ key: 'unsplash_key', value: '••••••••', isSecret: true })).toBe(true);
  });

  it('is false for a secret entry with a real new value', () => {
    expect(isUnchangedMaskedSecret({ key: 'unsplash_key', value: 'sk-new-real-value', isSecret: true })).toBe(false);
  });

  it('is false when the value matches the placeholder but the entry is not secret', () => {
    expect(isUnchangedMaskedSecret({ key: 'store_name', value: '••••••••', isSecret: false })).toBe(false);
  });

  it('is false when isSecret is omitted, even if the value matches the placeholder', () => {
    expect(isUnchangedMaskedSecret({ key: 'store_name', value: '••••••••' })).toBe(false);
  });
});

describe('resolveStoredValue()', () => {
  it('encrypts the value for secret entries — the stored value differs from the raw input', () => {
    const raw = 'sk-my-api-key';
    const stored = resolveStoredValue({ key: 'unsplash_key', value: raw, isSecret: true });

    expect(stored).not.toBe(raw);
    expect(decrypt(stored)).toBe(raw);
  });

  it('leaves non-secret values untouched', () => {
    expect(resolveStoredValue({ key: 'store_name', value: 'Acme Merch', isSecret: false })).toBe('Acme Merch');
  });
});
