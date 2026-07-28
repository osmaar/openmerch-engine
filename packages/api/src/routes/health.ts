import type { FastifyInstance } from 'fastify';
import { sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { minioClient } from '../storage/minio.js';
import { config } from '../config.js';
import { productionFilesQueue } from '../jobs/queues.js';

// Kept short: this endpoint backs orchestrator liveness/readiness probes
// (Docker healthcheck, k8s) — a slow check would make the probe itself a
// reliability risk.
const CHECK_TIMEOUT_MS = 1500;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms);
    }),
  ]);
}

async function checkPostgres(): Promise<boolean> {
  try {
    await withTimeout(db.execute(sql`select 1`), CHECK_TIMEOUT_MS);
    return true;
  } catch (err) {
    console.warn('[health] postgres check failed:', (err as Error).message);
    return false;
  }
}

async function checkRedis(): Promise<boolean> {
  try {
    // Reuses the BullMQ Queue's own ioredis connection instead of opening a
    // dedicated client just for this check.
    const client = await withTimeout(productionFilesQueue.client, CHECK_TIMEOUT_MS);
    const pong = await withTimeout(client.ping(), CHECK_TIMEOUT_MS);
    return pong === 'PONG';
  } catch (err) {
    console.warn('[health] redis check failed:', (err as Error).message);
    return false;
  }
}

async function checkMinio(): Promise<boolean> {
  try {
    await withTimeout(minioClient.bucketExists(config.minio.bucket), CHECK_TIMEOUT_MS);
    return true;
  } catch (err) {
    console.warn('[health] minio check failed:', (err as Error).message);
    return false;
  }
}

const healthResponseSchema = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['ok', 'degraded'] },
    timestamp: { type: 'string', format: 'date-time' },
    version: { type: 'string' },
    services: {
      type: 'object',
      properties: {
        postgres: { type: 'boolean' },
        redis: { type: 'boolean' },
        minio: { type: 'boolean' },
      },
      required: ['postgres', 'redis', 'minio'],
    },
  },
  required: ['status', 'timestamp', 'version', 'services'],
} as const;

export async function healthRoutes(app: FastifyInstance) {
  app.get(
    '/api/v1/health',
    {
      schema: {
        tags: ['Health'],
        summary: 'Check API health',
        response: {
          200: healthResponseSchema,
          503: healthResponseSchema,
        },
      },
    },
    async (_req, reply) => {
      const [postgres, redis, minio] = await Promise.all([
        checkPostgres(),
        checkRedis(),
        checkMinio(),
      ]);

      const body = {
        status: (postgres && redis && minio ? 'ok' : 'degraded') as 'ok' | 'degraded',
        timestamp: new Date().toISOString(),
        version: '0.0.1',
        services: { postgres, redis, minio },
      };

      // Postgres is the only hard dependency — nearly every route reads/writes
      // it. Redis (jobs) and MinIO (assets) failing degrades specific features
      // but the API itself can still serve most traffic, so those don't 503.
      if (!postgres) {
        return reply.code(503).send(body);
      }
      return body;
    },
  );
}
