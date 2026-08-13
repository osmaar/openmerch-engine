import { describe, it, expect } from 'vitest';
import { isAbandoned, extractStorageKey, type RetentionConfig } from './abandoned-designs-cleanup.logic.js';

const RETENTION: RetentionConfig = {
  abandonedDraftRetentionMs: 7 * 24 * 60 * 60 * 1000, // 7 days
  abandonedCartRetentionMs: 30 * 24 * 60 * 60 * 1000, // 30 days
};

const NOW = Date.parse('2026-08-10T00:00:00Z');

function daysAgo(days: number): Date {
  return new Date(NOW - days * 24 * 60 * 60 * 1000);
}

describe('isAbandoned()', () => {
  it('flags a draft design past the draft retention window', () => {
    expect(isAbandoned({ id: '1', status: 'draft', updatedAt: daysAgo(8) }, RETENTION, NOW)).toBe(true);
  });

  it('does not flag a draft design still within the draft retention window', () => {
    expect(isAbandoned({ id: '1', status: 'draft', updatedAt: daysAgo(6) }, RETENTION, NOW)).toBe(false);
  });

  it('flags a draft design at exactly the retention boundary (age >= retention)', () => {
    expect(isAbandoned({ id: '1', status: 'draft', updatedAt: daysAgo(7) }, RETENTION, NOW)).toBe(true);
  });

  it('does not flag a cart design past the draft window but within the cart window', () => {
    // 8 days old: would be abandoned as a draft, but "cart" gets the longer 30-day grace period.
    expect(isAbandoned({ id: '1', status: 'cart', updatedAt: daysAgo(8) }, RETENTION, NOW)).toBe(false);
  });

  it('flags a cart design past the cart retention window', () => {
    expect(isAbandoned({ id: '1', status: 'cart', updatedAt: daysAgo(31) }, RETENTION, NOW)).toBe(true);
  });

  it('never flags a paid design regardless of age', () => {
    expect(isAbandoned({ id: '1', status: 'paid', updatedAt: daysAgo(365) }, RETENTION, NOW)).toBe(false);
  });

  it('never flags a cancelled design regardless of age', () => {
    expect(isAbandoned({ id: '1', status: 'cancelled', updatedAt: daysAgo(365) }, RETENTION, NOW)).toBe(false);
  });
});

describe('extractStorageKey()', () => {
  it('extracts the object key from a /api/v1/assets/ URL', () => {
    expect(extractStorageKey('/api/v1/assets/production/design-1/front.png')).toBe('production/design-1/front.png');
  });

  it('returns null for null/undefined', () => {
    expect(extractStorageKey(null)).toBeNull();
    expect(extractStorageKey(undefined)).toBeNull();
  });

  it('returns null for a URL that does not use the expected prefix', () => {
    expect(extractStorageKey('https://cdn.example.com/foo.png')).toBeNull();
  });
});
