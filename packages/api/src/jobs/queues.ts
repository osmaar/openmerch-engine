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
      removeOnComplete: { age: 60 * 60 * 24 * 7 }, // keep completed for 7 days
      removeOnFail: { age: 60 * 60 * 24 * 30 }, // keep failed for 30 days
    },
  },
);

export async function enqueueProductionFiles(designId: string): Promise<string> {
  const job = await productionFilesQueue.add(
    'render-design',
    { designId },
    { jobId: `design-${designId}-${Date.now()}` },
  );
  return job.id ?? 'unknown';
}
