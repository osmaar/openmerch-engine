import { randomUUID } from 'node:crypto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { orderDesigns } from '../../db/schema.js';

type FakeRow = Record<string, unknown>;

const designsSelectMock = vi.fn<() => Promise<FakeRow[]>>();
const orderDesignsSelectMock = vi.fn<() => Promise<FakeRow[]>>();

// Branches on the actual Drizzle table object (identity, not shape) so the "designs"
// select and the "order_designs" select each get their own mocked result.
vi.mock('../../db/index.js', () => ({
  db: {
    select: () => ({
      from: (table: unknown) => ({
        where: () => (table === orderDesigns ? orderDesignsSelectMock() : designsSelectMock()),
      }),
    }),
  },
}));

vi.mock('../../config.js', () => ({
  config: {
    cleanup: {
      abandonedDraftRetentionMs: 7 * 24 * 60 * 60 * 1000,
      abandonedCartRetentionMs: 30 * 24 * 60 * 60 * 1000,
    },
    // Full shape required — this mock also backs storage/minio.ts's `new Client(...)` call
    // (throws at construction if endPoint/port are missing) and connection.ts's redis URL
    // parsing (throws on `new URL(undefined)`).
    minio: { endpoint: 'localhost', port: 9000, accessKey: 'x', secretKey: 'x', bucket: 'openmerch' },
    redisUrl: 'redis://localhost:6379',
  },
}));

const { findAbandonedDesigns } = await import('./abandoned-designs-cleanup.worker.js');

const NOW = Date.parse('2026-08-10T00:00:00Z');

function daysAgo(days: number): Date {
  return new Date(NOW - days * 24 * 60 * 60 * 1000);
}

function fakeDesign(overrides: Partial<FakeRow> = {}): FakeRow {
  return {
    id: randomUUID(),
    status: 'draft',
    updatedAt: daysAgo(10),
    thumbnailUrl: null,
    productionFiles: null,
    ...overrides,
  };
}

beforeEach(() => {
  designsSelectMock.mockReset();
  orderDesignsSelectMock.mockReset();
  orderDesignsSelectMock.mockResolvedValue([]);
});

describe('findAbandonedDesigns()', () => {
  it('returns designs the DB-side coarse filter already narrowed down to draft/cart past the shorter window', async () => {
    const abandoned = fakeDesign({ status: 'draft', updatedAt: daysAgo(10) });
    designsSelectMock.mockResolvedValue([abandoned]);

    const result = await findAbandonedDesigns(NOW);
    expect(result).toEqual([abandoned]);
  });

  it('excludes a design linked to a real order even if it is old enough', async () => {
    const linked = fakeDesign({ id: 'linked-1', status: 'draft', updatedAt: daysAgo(10) });
    designsSelectMock.mockResolvedValue([linked]);
    orderDesignsSelectMock.mockResolvedValue([{ designId: 'linked-1' }]);

    const result = await findAbandonedDesigns(NOW);
    expect(result).toEqual([]);
  });

  it('excludes a cart design that passed the coarse (draft-length) cutoff but not its own longer cart retention', async () => {
    // 10 days old: past the 7-day draft window used for the coarse DB filter, but well
    // within the 30-day cart window — isAbandoned() must filter this back out.
    const tooYoungCart = fakeDesign({ status: 'cart', updatedAt: daysAgo(10) });
    designsSelectMock.mockResolvedValue([tooYoungCart]);

    const result = await findAbandonedDesigns(NOW);
    expect(result).toEqual([]);
  });

  it('short-circuits without querying order_designs when there are no coarse candidates', async () => {
    designsSelectMock.mockResolvedValue([]);

    const result = await findAbandonedDesigns(NOW);
    expect(result).toEqual([]);
    expect(orderDesignsSelectMock).not.toHaveBeenCalled();
  });
});
