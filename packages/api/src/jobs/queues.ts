import { createHash } from 'node:crypto';
import { Queue } from 'bullmq';
import { redisConnection } from './connection.js';

export const PRODUCTION_FILES_QUEUE = 'production-files';

export interface ProductionFilesJobData {
  designId: string;
}

export interface ProductionZoneFiles {
  print: string;
  mockup?: string;
}

export interface ProductionFilesJobResult {
  designId: string;
  files: Record<string, ProductionZoneFiles>;
}

// Singleton queue used by the API process to enqueue jobs.
// The worker process consumes from the same queue name via its own connection.
export const productionFilesQueue = new Queue<ProductionFilesJobData, ProductionFilesJobResult>(
  PRODUCTION_FILES_QUEUE,
  {
    connection: redisConnection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      // Kept for a while (not removed immediately) rather than count-capped: computeProductionJobId
      // below produces a STABLE jobId per design content, and BullMQ only dedupes against a jobId
      // that still exists in Redis. A double-click or an out-of-band retry that lands after the
      // first run already finished still needs to find the finished job here to be deduped against
      // it. If double-submits are ever observed arriving later than these windows, widen them.
      removeOnComplete: { age: 60 * 60 * 24 * 7 }, // keep completed for 7 days
      removeOnFail: { age: 60 * 60 * 24 * 30 }, // keep failed for 30 days
    },
  },
);

// Deterministic jobId derived from what actually gets rendered (designData + productColor),
// not from a timestamp. Two enqueue calls for the SAME content collapse into ONE BullMQ job via
// native jobId dedup, which is what stops a double-click or a retry from racing another in-flight
// render for the same productionFiles write. Editing the design changes the hash, so a fresh job
// id is produced and regenerating after an edit is never blocked by an old completed job.
export function computeProductionJobId(designId: string, designData: unknown, productColor: string | null): string {
  const contentHash = createHash('sha256')
    .update(JSON.stringify({ designData, productColor }))
    .digest('hex')
    .slice(0, 16);
  return `design-${designId}-${contentHash}`;
}

export async function enqueueProductionFiles(
  designId: string,
  designData: unknown,
  productColor: string | null,
): Promise<string> {
  const jobId = computeProductionJobId(designId, designData, productColor);

  // A job with this exact id can still be sitting in Redis in a TERMINAL state (completed/failed)
  // — that's the point of the retention windows above, so double-clicks/retries against an
  // in-flight job dedupe. But queue.add() with an existing jobId is a no-op against a terminal
  // job too: it silently hands back the old finished job instead of rendering again. That would
  // permanently wedge retries for unchanged content (e.g. "generate files" again after a failure,
  // or a deliberate re-render request once completed). Clear it first so this case actually
  // re-runs; a job still waiting/active/delayed is left untouched and dedups as intended.
  const existingJob = await productionFilesQueue.getJob(jobId);
  if (existingJob) {
    const state = await existingJob.getState();
    if (state === 'completed' || state === 'failed') {
      await existingJob.remove();
    }
  }

  const job = await productionFilesQueue.add('render-design', { designId }, { jobId });
  return job.id ?? 'unknown';
}

export const ABANDONED_DESIGNS_CLEANUP_QUEUE = 'abandoned-designs-cleanup';

export interface AbandonedDesignsCleanupJobResult {
  scanned: number;
  deleted: number;
  errors: number;
}

export const abandonedDesignsCleanupQueue = new Queue<Record<string, never>, AbandonedDesignsCleanupJobResult>(
  ABANDONED_DESIGNS_CLEANUP_QUEUE,
  {
    connection: redisConnection,
    defaultJobOptions: {
      // A failed sweep just retries on the next scheduled tick (24h later) — no need to
      // hammer Postgres/MinIO immediately after a transient failure.
      attempts: 1,
      removeOnComplete: { age: 60 * 60 * 24 * 30 }, // keep 30 days of sweep history for audit
      removeOnFail: { age: 60 * 60 * 24 * 30 },
    },
  },
);

const CLEANUP_SCHEDULER_ID = 'abandoned-designs-cleanup-daily';

// Registers (or refreshes) the repeatable daily sweep. Safe to call on every worker boot —
// upsertJobScheduler is idempotent against the same schedulerId, so restarting the worker
// process doesn't pile up duplicate schedulers.
export async function scheduleAbandonedDesignsCleanup(): Promise<void> {
  await abandonedDesignsCleanupQueue.upsertJobScheduler(
    CLEANUP_SCHEDULER_ID,
    { every: 24 * 60 * 60 * 1000 },
    { name: 'sweep' },
  );
}

// Used by the manual "run now" admin endpoint — a one-off sweep outside the daily schedule.
export async function enqueueAbandonedDesignsCleanupNow(): Promise<string> {
  const job = await abandonedDesignsCleanupQueue.add('sweep-manual', {});
  return job.id ?? 'unknown';
}

export const WEBHOOK_DELIVERIES_CLEANUP_QUEUE = 'webhook-deliveries-cleanup';

export interface WebhookDeliveriesCleanupJobResult {
  deleted: number;
}

export const webhookDeliveriesCleanupQueue = new Queue<Record<string, never>, WebhookDeliveriesCleanupJobResult>(
  WEBHOOK_DELIVERIES_CLEANUP_QUEUE,
  {
    connection: redisConnection,
    defaultJobOptions: {
      attempts: 1,
      removeOnComplete: { age: 60 * 60 * 24 * 30 },
      removeOnFail: { age: 60 * 60 * 24 * 30 },
    },
  },
);

const WEBHOOK_DELIVERIES_SCHEDULER_ID = 'webhook-deliveries-cleanup-daily';

// Same idempotent upsert pattern as scheduleAbandonedDesignsCleanup above — safe to call on
// every worker boot.
export async function scheduleWebhookDeliveriesCleanup(): Promise<void> {
  await webhookDeliveriesCleanupQueue.upsertJobScheduler(
    WEBHOOK_DELIVERIES_SCHEDULER_ID,
    { every: 24 * 60 * 60 * 1000 },
    { name: 'sweep' },
  );
}
