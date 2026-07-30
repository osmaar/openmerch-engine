import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'crypto';
import sharp from 'sharp';
import { unpremultiplyAlpha } from '@openmerch/core';
import { db } from '../db/index.js';
import { assets } from '../db/schema.js';
import { minioClient, ensureBucket } from '../storage/minio.js';
import { config } from '../config.js';
import { errorResponseSchema } from '../schemas/common.js';
import { ImageResolver } from '../jobs/resolvers/image-resolver.js';

// The Python microservice (services/rembg) is given 30s to respond — u2net
// inference on a cold CPU can take several seconds, but a request that's
// still hanging past this is almost certainly stuck.
const REMBG_TIMEOUT_MS = 30_000;

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

const removeBackgroundBodySchema = {
  type: 'object',
  properties: {
    src: {
      type: 'string',
      description:
        'Image source to resolve: a data: URL, an external http(s) URL, or an internal asset path (/api/v1/assets/... or /products/...).',
    },
  },
  required: ['src'],
} as const;

export async function removeBackgroundRoutes(app: FastifyInstance) {
  app.post<{ Body: { src: string } }>(
    '/api/v1/assets/remove-background',
    {
      schema: {
        tags: ['Assets'],
        summary: 'Remove the background from an image using AI',
        description:
          'Resolves `src` to an image, sends it to the rembg microservice (services/rembg) for AI background removal, ' +
          'then stores the resulting transparent PNG as a new asset. Returns 503 if the microservice isn\'t configured ' +
          '(REMBG_URL unset) or unreachable, 504 on timeout, and 502 if the microservice itself reports an error.',
        body: removeBackgroundBodySchema,
        response: {
          200: assetSchema,
          400: errorResponseSchema,
          502: errorResponseSchema,
          503: errorResponseSchema,
          504: errorResponseSchema,
        },
      },
    },
    async (req, reply) => {
      if (!config.rembg.url) {
        return reply.code(503).send({
          error: 'AI background removal service not configured',
          code: 'REMBG_NOT_CONFIGURED',
        });
      }

      const { src } = req.body;

      let sourceBuffer: Buffer;
      try {
        sourceBuffer = await new ImageResolver().resolve(src);
      } catch (err) {
        return reply.code(400).send({
          error: `Could not resolve image source: ${(err as Error).message}`,
          code: 'INVALID_IMAGE_SOURCE',
        });
      }

      let rawResult: Buffer;
      try {
        const form = new FormData();
        form.append('file', new Blob([new Uint8Array(sourceBuffer)]), 'image.png');

        const res = await fetch(`${config.rembg.url}/remove-background`, {
          method: 'POST',
          body: form,
          signal: AbortSignal.timeout(REMBG_TIMEOUT_MS),
        });

        if (!res.ok) {
          return reply.code(502).send({
            error: 'AI background removal failed',
            code: 'REMBG_FAILED',
          });
        }

        rawResult = Buffer.from(await res.arrayBuffer());
      } catch (err) {
        if ((err as Error).name === 'TimeoutError') {
          return reply.code(504).send({
            error: 'AI background removal timed out',
            code: 'REMBG_TIMEOUT',
          });
        }
        return reply.code(503).send({
          error: 'AI background removal service unreachable',
          code: 'REMBG_UNAVAILABLE',
        });
      }

      // rembg's PNG output is premultiplied-alpha (verified empirically: un-
      // premultiplying neighboring edge pixels at different alpha values
      // recovers a consistent underlying color). Every standard PNG consumer
      // (browsers, Photopea, node-canvas/Konva) expects straight alpha, so left
      // uncorrected this shows up as a dark/muddy fringe on every semi-
      // transparent edge — most visible on soft/furry cutouts. Fixed once here
      // so every consumer of this asset (editor preview, print file, mockup)
      // gets the corrected image with no special-casing on their end.
      let resultBuffer: Buffer;
      try {
        const { data, info } = await sharp(rawResult).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        unpremultiplyAlpha({ data, width: info.width, height: info.height });
        resultBuffer = await sharp(data, { raw: info }).png().toBuffer();
      } catch (err) {
        return reply.code(502).send({
          error: `AI background removal returned an unprocessable image: ${(err as Error).message}`,
          code: 'REMBG_INVALID_IMAGE',
        });
      }

      const storageKey = `uploads/${randomUUID()}.png`;

      await ensureBucket();

      await minioClient.putObject(
        config.minio.bucket,
        storageKey,
        resultBuffer,
        resultBuffer.length,
        { 'Content-Type': 'image/png' },
      );

      const url = `/api/v1/assets/${storageKey}`;

      const [asset] = await db.insert(assets).values({
        filename: storageKey.split('/').pop() ?? `${randomUUID()}.png`,
        mimeType: 'image/png',
        size: resultBuffer.length,
        url,
        storageKey,
      }).returning();

      return asset;
    },
  );
}
