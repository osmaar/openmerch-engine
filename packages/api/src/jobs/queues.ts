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
