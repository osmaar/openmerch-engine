import { Worker } from 'bullmq';
import type { Job } from 'bullmq';
import { lt } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { webhookDeliveries } from '../../db/schema.js';
import { config } from '../../config.js';
import { redisConnection } from '../connection.js';
import { WEBHOOK_DELIVERIES_CLEANUP_QUEUE, type WebhookDeliveriesCleanupJobResult } from '../queues.js';

/**
 * Deletes rows older than the configured retention window. No FK/order-linkage check needed
 * here (unlike abandoned-designs-cleanup) — a webhook_deliveries row is a pure audit record,
 * never referenced by anything else, so there's nothing it could orphan. Exported (rather than
 * inlined in processJob) so the retention-window math is unit-testable without a real Postgres.
 */
export async function purgeOldWebhookDeliveries(now: number): Promise<WebhookDeliveriesCleanupJobResult> {
  const cutoff = new Date(now - config.webhookDeliveriesCleanup.retentionMs);
  const deletedRows = await db.delete(webhookDeliveries).where(lt(webhookDeliveries.createdAt, cutoff)).returning();
  return { deleted: deletedRows.length };
}

async function processJob(_job: Job): Promise<WebhookDeliveriesCleanupJobResult> {
  return purgeOldWebhookDeliveries(Date.now());
}

export function startWebhookDeliveriesCleanupWorker(): Worker {
  const worker = new Worker<Record<string, never>, WebhookDeliveriesCleanupJobResult>(
    WEBHOOK_DELIVERIES_CLEANUP_QUEUE,
    processJob,
    { connection: redisConnection, concurrency: 1 },
  );

  worker.on('completed', (_job, result) => {
    console.log(`[worker] ✓ webhook-deliveries sweep: ${result.deleted} deleted`);
  });
  worker.on('failed', (job, err) => {
    console.error(`[worker] ✗ webhook-deliveries sweep failed:`, job?.id, err.message);
  });

  return worker;
}
