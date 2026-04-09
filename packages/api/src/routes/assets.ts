import type { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import { assets } from '../db/schema.js';
import { minioClient, ensureBucket } from '../storage/minio.js';
import { config } from '../config.js';
import { randomUUID } from 'crypto';

// Determine subfolder based on category query param or mime type
function getStoragePath(category: string | undefined, filename: string): string {
  const ext = filename.split('.').pop() ?? 'bin';
  const id = randomUUID();

  switch (category) {
    case 'clipart':
      return `assets/cliparts/${id}.${ext}`;
    case 'font':
      return `assets/fonts/${id}.${ext}`;
    case 'template':
      return `assets/templates/${id}.${ext}`;
    case 'product':
      return `assets/products/${id}.${ext}`;
    case 'upload':
      return `uploads/${id}.${ext}`;
    case 'production':
      return `production/${id}.${ext}`;
    default:
      return `assets/general/${id}.${ext}`;
  }
}

export async function assetRoutes(app: FastifyInstance) {
  // POST /api/v1/assets/upload — upload a file
  // Optional query param: ?category=clipart|font|template|product|upload|production
  app.post<{ Querystring: { category?: string } }>('/api/v1/assets/upload', async (req, reply) => {
    const file = await req.file();
    if (!file) return reply.code(400).send({ error: 'No file uploaded', code: 'NO_FILE' });

    const buffer = await file.toBuffer();
    const category = (req.query as { category?: string }).category;
    const storageKey = getStoragePath(category, file.filename);

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

    // Set Content-Type based on file extension
    const ext = key.split('.').pop()?.toLowerCase();
    const mimeMap: Record<string, string> = {
      png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
      svg: 'image/svg+xml', webp: 'image/webp', ico: 'image/x-icon',
      ttf: 'font/ttf', otf: 'font/otf', woff: 'font/woff', woff2: 'font/woff2',
      pdf: 'application/pdf', json: 'application/json',
    };
    if (ext && mimeMap[ext]) reply.header('Content-Type', mimeMap[ext]);

    try {
      const stream = await minioClient.getObject(config.minio.bucket, key);
      return reply.send(stream);
    } catch {
      return reply.code(404).send({ error: 'Asset not found', code: 'ASSET_NOT_FOUND' });
    }
  });
}
