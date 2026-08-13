import { Worker } from 'bullmq';
import type { Job } from 'bullmq';
import { and, eq, inArray, lt } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { designs, orderDesigns } from '../../db/schema.js';
import { minioClient } from '../../storage/minio.js';
import { config } from '../../config.js';
import { redisConnection } from '../connection.js';
import { ABANDONED_DESIGNS_CLEANUP_QUEUE, type AbandonedDesignsCleanupJobResult } from '../queues.js';
import { isAbandoned, extractStorageKey } from './abandoned-designs-cleanup.logic.js';

type DesignRow = typeof designs.$inferSelect;

/**
 * Finds draft/cart designs eligible for cleanup: past their status's retention window AND
 * never linked to a real order (checked against `order_designs.designId`, populated by the
 * WooCommerce webhook once a design resolves — see orders-webhook-woocommerce.ts). Exported
 * so the admin "preview" endpoint can show what a sweep would remove without deleting anything.
 */
export async function findAbandonedDesigns(now: number): Promise<DesignRow[]> {
  // Coarse DB-side filter using the SHORTER of the two retention windows — a superset of the
  // real candidates (e.g. a "cart" design only 8 days old passes this, since drafts already
  // qualify at 7 days). isAbandoned() below applies the exact per-status threshold.
  const coarseCutoff = new Date(now - Math.min(config.cleanup.abandonedDraftRetentionMs, config.cleanup.abandonedCartRetentionMs));

  const candidates = await db
    .select()
    .from(designs)
    .where(and(inArray(designs.status, ['draft', 'cart']), lt(designs.updatedAt, coarseCutoff)));

  if (candidates.length === 0) return [];

  const linked = await db
    .select({ designId: orderDesigns.designId })
    .from(orderDesigns)
    .where(inArray(orderDesigns.designId, candidates.map((c) => c.id)));
  const linkedIds = new Set(linked.map((l) => l.designId).filter((id): id is string => id !== null));

  return candidates.filter(
    (c) => !linkedIds.has(c.id) && isAbandoned(c, config.cleanup, now),
  );
}

function collectStorageKeys(design: DesignRow): string[] {
  const keys = [extractStorageKey(design.thumbnailUrl)];
  const productionFiles = (design.productionFiles ?? {}) as Record<string, { print?: string; mockup?: string }>;
  for (const zoneFiles of Object.values(productionFiles)) {
    keys.push(extractStorageKey(zoneFiles.print));
    keys.push(extractStorageKey(zoneFiles.mockup));
  }
  return keys.filter((k): k is string => k !== null);
}

/**
 * Deletes the DB row first, then best-effort cleans up its files in MinIO.
 *
 * Order matters: `order_designs.design_id` has no ON DELETE CASCADE, so if a real order got
 * linked to this design in the split second between findAbandonedDesigns() and here, Postgres
 * rejects the delete instead of silently orphaning a paid order's line item — the design
 * survives untouched and gets re-evaluated on the next sweep. Storage cleanup happens only
 * once the row is confirmed gone; a MinIO error at that point just leaves an orphaned object
 * (wasted disk, not a correctness bug) rather than leaving an undeletable DB row behind.
 */
async function deleteDesignAndFiles(design: DesignRow, job: Job): Promise<'deleted' | 'error'> {
  try {
    const [deletedRow] = await db.delete(designs).where(eq(designs.id, design.id)).returning();
    if (!deletedRow) return 'error';
  } catch (err) {
    job.log(`skip design ${design.id}: delete rejected (${(err as Error).message})`);
    return 'error';
  }

  for (const key of collectStorageKeys(design)) {
    try {
      await minioClient.removeObject(config.minio.bucket, key);
    } catch (err) {
      job.log(`warning: failed to remove storage object "${key}" for design ${design.id}: ${(err as Error).message}`);
    }
  }

  return 'deleted';
}

async function processJob(job: Job): Promise<AbandonedDesignsCleanupJobResult> {
  const now = Date.now();
  const candidates = await findAbandonedDesigns(now);
  job.log(`Found ${candidates.length} abandoned design(s)`);

  let deleted = 0;
  let errors = 0;
  for (const design of candidates) {
    const outcome = await deleteDesignAndFiles(design, job);
    if (outcome === 'deleted') deleted++;
    else errors++;
  }

  return { scanned: candidates.length, deleted, errors };
}

export function startAbandonedDesignsCleanupWorker(): Worker {
  const worker = new Worker<Record<string, never>, AbandonedDesignsCleanupJobResult>(
    ABANDONED_DESIGNS_CLEANUP_QUEUE,
    processJob,
    { connection: redisConnection, concurrency: 1 },
  );

  worker.on('completed', (_job, result) => {
    console.log(
      `[worker] ✓ abandoned-designs sweep: ${result.deleted} deleted, ${result.errors} error(s) (scanned ${result.scanned})`,
    );
  });
  worker.on('failed', (job, err) => {
    console.error(`[worker] ✗ abandoned-designs sweep failed:`, job?.id, err.message);
  });

  return worker;
}
