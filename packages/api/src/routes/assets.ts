import type { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import { assets } from '../db/schema.js';
import { minioClient, ensureBucket } from '../storage/minio.js';
import { config } from '../config.js';
import { randomUUID } from 'crypto';

export async function assetRoutes(app: FastifyInstance) {
  // POST /api/v1/assets/upload — upload a file
  app.post('/api/v1/assets/upload', async (req, reply) => {
    const file = await req.file();
    if (!file) return reply.code(400).send({ error: 'No file uploaded', code: 'NO_FILE' });

    const buffer = await file.toBuffer();
    const ext = file.filename.split('.').pop() ?? 'bin';
    const storageKey = `assets/${randomUUID()}.${ext}`;

    await ensureBucket();

    await minioClient.putObject(
      config.minio.bucket,
      storageKey,
      buffer,
      buffer.length,
      { 'Content-Type': file.mimetype },
    );

    const url = `/api/v1/assets/${storageKey}`;

    const [asset] = await db.insert(assets).values({
      filename: file.filename,
      mimeType: file.mimetype,
      size: buffer.length,
      url,
      storageKey,
    }).returning();

    return asset;
  });

  // GET /api/v1/assets/:key — serve a file from MinIO
  app.get<{ Params: { '*': string } }>('/api/v1/assets/*', async (req, reply) => {
    const key = req.params['*'];
    if (!key) return reply.code(400).send({ error: 'Missing key', code: 'MISSING_KEY' });

    try {
      const stream = await minioClient.getObject(config.minio.bucket, key);
      return reply.send(stream);
    } catch {
      return reply.code(404).send({ error: 'Asset not found', code: 'ASSET_NOT_FOUND' });
    }
  });
}
