import type { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import { assets } from '../db/schema.js';
import { minioClient, ensureBucket } from '../storage/minio.js';
import { config } from '../config.js';
import { randomUUID } from 'crypto';
import { errorResponseSchema } from '../schemas/common.js';
import { sanitizeSvg } from '../utils/sanitizeSvg.js';

const ASSET_CATEGORIES = ['clipart', 'font', 'template', 'product', 'upload', 'production'] as const;

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg']);
const FONT_EXTENSIONS = new Set(['ttf', 'otf', 'woff', 'woff2']);
const DOCUMENT_EXTENSIONS = new Set(['pdf']);

// Per-category allowlist. Keyed by lowercased file extension rather than the
// client-supplied mimetype: the mimetype header is attacker-controlled and,
// for fonts especially, inconsistent across browsers/OSes (often reported as
// application/octet-stream), so it isn't a reliable gate on its own.
const ALLOWED_EXTENSIONS_BY_CATEGORY: Record<(typeof ASSET_CATEGORIES)[number], ReadonlySet<string>> = {
  clipart: IMAGE_EXTENSIONS,
  product: IMAGE_EXTENSIONS,
  upload: IMAGE_EXTENSIONS,
  template: new Set([...IMAGE_EXTENSIONS, ...DOCUMENT_EXTENSIONS]),
  production: new Set([...IMAGE_EXTENSIONS, ...DOCUMENT_EXTENSIONS]),
  font: FONT_EXTENSIONS,
};

// Applied when no `category` query param is given (matches getStoragePath's default).
const DEFAULT_ALLOWED_EXTENSIONS = IMAGE_EXTENSIONS;

const assetSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    filename: { type: 'string' },
    mimeType: { type: 'string' },
    size: { type: 'integer', description: 'File size in bytes' },
    url: { type: 'string', description: 'Public URL to fetch the asset, e.g. /api/v1/assets/{storageKey}' },
    storageKey: { type: 'string', description: 'Object key inside the MinIO bucket' },
    createdAt: { type: 'string', format: 'date-time' },
  },
  required: ['id', 'filename', 'mimeType', 'size', 'url', 'storageKey', 'createdAt'],
} as const;

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
  app.post<{ Querystring: { category?: string } }>(
    '/api/v1/assets/upload',
    {
      schema: {
        tags: ['Assets'],
        summary: 'Upload a file',
        description: 'Accepts a single multipart/form-data file. Optional `category` query param controls the storage subfolder.',
        consumes: ['multipart/form-data'],
        querystring: {
          type: 'object',
          properties: {
            category: { type: 'string', enum: ASSET_CATEGORIES },
          },
        },
        response: { 200: assetSchema, 400: errorResponseSchema },
      },
    },
    async (req, reply) => {
      const file = await req.file();
      if (!file) return reply.code(400).send({ error: 'No file uploaded', code: 'NO_FILE' });

      const rawBuffer = await file.toBuffer();
      const category = (req.query as { category?: string }).category;
      const ext = file.filename.split('.').pop()?.toLowerCase() ?? '';
      const allowedExtensions = category ? ALLOWED_EXTENSIONS_BY_CATEGORY[category as (typeof ASSET_CATEGORIES)[number]] : DEFAULT_ALLOWED_EXTENSIONS;
      if (!ext || !allowedExtensions.has(ext)) {
        return reply.code(400).send({
          error: `File type ".${ext || 'unknown'}" is not allowed for category "${category ?? 'default'}". Allowed types: ${[...allowedExtensions].join(', ')}`,
          code: 'UNSUPPORTED_FILE_TYPE',
        });
      }

      const isSvg = file.mimetype === 'image/svg+xml' || ext === 'svg';
      const buffer = isSvg ? Buffer.from(sanitizeSvg(rawBuffer.toString('utf8')), 'utf8') : rawBuffer;
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
    },
  );

  app.get<{ Params: { '*': string } }>(
    '/api/v1/assets/*',
    {
      schema: {
        tags: ['Assets'],
        summary: 'Serve a file from storage',
        description: 'Streams the binary content of an asset from MinIO by its storage key (everything after /api/v1/assets/).',
        params: {
          type: 'object',
          properties: {
            '*': { type: 'string' },
          },
          required: ['*'],
        },
        response: { 400: errorResponseSchema, 404: errorResponseSchema },
      },
    },
    async (req, reply) => {
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
    },
  );
}
