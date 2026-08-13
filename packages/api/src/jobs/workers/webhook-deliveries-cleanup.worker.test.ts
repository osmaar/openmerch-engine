import { describe, it, expect, vi, beforeEach } from 'vitest';

const deleteWhereMock = vi.fn<() => { returning: () => Promise<Record<string, unknown>[]> }>();
const whereConditionSpy = vi.fn();

vi.mock('../../db/index.js', () => ({
  db: {
    delete: () => ({
      where: (condition: unknown) => {
        whereConditionSpy(condition);
        return deleteWhereMock();
      },
    }),
  },
}));

vi.mock('../../config.js', () => ({
  config: {
    webhookDeliveriesCleanup: { retentionMs: 30 * 24 * 60 * 60 * 1000 },
    // Full shape required — this mock also backs storage/minio.ts's `new Client(...)` call
    // and connection.ts's redis URL parsing (same reason as the abandoned-designs test mock).
    minio: { endpoint: 'localhost', port: 9000, accessKey: 'x', secretKey: 'x', bucket: 'openmerch' },
    redisUrl: 'redis://localhost:6379',
  },
}));

const { purgeOldWebhookDeliveries } = await import('./webhook-deliveries-cleanup.worker.js');

const NOW = Date.parse('2026-08-10T00:00:00Z');

beforeEach(() => {
  deleteWhereMock.mockReset();
  whereConditionSpy.mockReset();
});

describe('purgeOldWebhookDeliveries()', () => {
  it('deletes rows older than the configured retention window and reports how many', async () => {
    deleteWhereMock.mockReturnValue({ returning: () => Promise.resolve([{ id: '1' }, { id: '2' }]) });

    const result = await purgeOldWebhookDeliveries(NOW);

    expect(result).toEqual({ deleted: 2 });
    expect(whereConditionSpy).toHaveBeenCalledTimes(1);
  });

  it('reports zero deletions when nothing is old enough to purge', async () => {
    deleteWhereMock.mockReturnValue({ returning: () => Promise.resolve([]) });

    const result = await purgeOldWebhookDeliveries(NOW);

    expect(result).toEqual({ deleted: 0 });
  });
});
