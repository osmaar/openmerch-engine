import type { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import { settings } from '../db/schema.js';
import { eq, sql } from 'drizzle-orm';
import { encrypt, decrypt } from '../utils/crypto.js';
import { config } from '../config.js';

/** Only settings the public frontend (editor/demo) needs. No business data. */
const PUBLIC_KEYS = ['store_name', 'show_branding', 'favicon_url'];

/** Placeholder the API sends back instead of a secret's real value. */
const MASKED_PLACEHOLDER = '••••••••';

const settingSchema = {
  type: 'object',
  properties: {
    key: { type: 'string' },
    value: { type: 'string', description: 'Masked as •••••••• in responses when isSecret is true' },
    isSecret: { type: ['boolean', 'null'] },
    updatedAt: { type: 'string', format: 'date-time' },
  },
  required: ['key', 'value', 'updatedAt'],
} as const;

const publicSettingsResponseSchema = {
  type: 'object',
  additionalProperties: { type: 'string' },
  description: 'Map of public setting key to value (store_name, show_branding, favicon_url)',
} as const;

const proxyErrorResponseSchema = {
  type: 'object',
  properties: {
    error: { type: 'string' },
  },
  required: ['error'],
} as const;

const upsertSettingsBodySchema = {
  type: 'object',
  properties: {
    entries: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          key: { type: 'string' },
          value: { type: 'string' },
          isSecret: { type: 'boolean' },
        },
        required: ['key', 'value'],
      },
    },
  },
  required: ['entries'],
} as const;

/** Resolve a setting value: DB (decrypted if secret) → env fallback → null. */
export async function resolveSettingValue(key: string): Promise<string | null> {
  const [row] = await db.select().from(settings).where(eq(settings.key, key));
  if (row) {
    if (row.isSecret) {
      const decrypted = decrypt(row.value);
      return decrypted && decrypted !== '' ? decrypted : null;
    }
    return row.value || null;
  }
  // Fallback to env vars for known keys
  const envMap: Record<string, string | undefined> = {
    unsplash_key: process.env.VITE_UNSPLASH_ACCESS_KEY,
    pollinations_key: process.env.VITE_POLLINATIONS_KEY,
  };
  return envMap[key] ?? null;
}

type UpsertSettingEntry = { key: string; value: string; isSecret?: boolean };

/**
 * True when a secret entry is sending back the masked placeholder instead of
 * a real value — i.e. the admin re-saved the form without touching this
 * field. The write must be skipped entirely, or it would clobber the
 * existing encrypted value (or persist the ciphertext of the literal
 * placeholder) with no way to recover the original secret.
 */
export function isUnchangedMaskedSecret(entry: UpsertSettingEntry): boolean {
  return Boolean(entry.isSecret) && entry.value === MASKED_PLACEHOLDER;
}

/** Encrypts secret values before they're persisted; plain values pass through untouched. */
export function resolveStoredValue(entry: UpsertSettingEntry): string {
  return entry.isSecret ? encrypt(entry.value) : entry.value;
}

export async function settingRoutes(app: FastifyInstance) {
  app.get(
    '/api/v1/settings',
    {
      schema: {
        tags: ['Settings'],
        summary: 'List all settings (admin)',
        description: 'Secret values are masked as ••••••••.',
        response: { 200: { type: 'array', items: settingSchema } },
      },
    },
    async () => {
      const rows = await db.select().from(settings);
      return rows.map((r) => ({
        ...r,
        value: r.isSecret ? MASKED_PLACEHOLDER : r.value,
      }));
    },
  );

  app.get(
    '/api/v1/settings/public',
    {
      schema: {
        tags: ['Settings'],
        summary: 'Get public settings',
        description: 'Safe for the frontend/editor — no secrets, no business data.',
        response: { 200: publicSettingsResponseSchema },
      },
    },
    async (req) => {
      const rows = await db.select().from(settings);
      const result: Record<string, string> = {};
      // Build the base URL for resolving relative asset paths
      const protocol = req.protocol ?? 'http';
      const host = req.headers.host ?? `localhost:${config.port}`;
      const baseUrl = `${protocol}://${host}`;
      for (const row of rows) {
        if (PUBLIC_KEYS.includes(row.key)) {
          // Convert relative asset paths to absolute URLs
          let val = row.value;
          if (row.key === 'favicon_url' && val.startsWith('/')) {
            val = `${baseUrl}${val}`;
          }
          result[row.key] = val;
        }
      }
      return result;
    },
  );

  app.put<{ Body: { entries: UpsertSettingEntry[] } }>(
    '/api/v1/settings',
    {
      schema: {
        tags: ['Settings'],
        summary: 'Bulk upsert settings (admin)',
        description: 'Secret values are encrypted at rest. Sending the masked placeholder •••••••• for a secret leaves it unchanged.',
        body: upsertSettingsBodySchema,
        response: { 200: { type: 'array', items: settingSchema } },
      },
    },
    async (req) => {
      // The whole batch is upserted atomically so concurrent PUTs to the same
      // key can't race between "does it exist" and "insert or update" —
      // onConflictDoUpdate lets Postgres resolve that in a single statement.
      const rows = await db.transaction(async (tx) => {
        for (const entry of req.body.entries) {
          if (isUnchangedMaskedSecret(entry)) continue;

          const storedValue = resolveStoredValue(entry);

          await tx
            .insert(settings)
            .values({
              key: entry.key,
              value: storedValue,
              isSecret: entry.isSecret ?? false,
            })
            .onConflictDoUpdate({
              target: settings.key,
              set: {
                value: storedValue,
                // Preserve the existing row's isSecret when the caller didn't specify one.
                isSecret: entry.isSecret !== undefined ? entry.isSecret : sql`${settings.isSecret}`,
                updatedAt: new Date(),
              },
            });
        }
        return tx.select().from(settings);
      });
      return rows.map((r) => ({
        ...r,
        value: r.isSecret ? MASKED_PLACEHOLDER : r.value,
      }));
    },
  );

  // --- Proxy endpoints: API keys never reach the browser ---

  app.get<{ Querystring: { query?: string; page?: string; per_page?: string } }>(
    '/api/v1/proxy/unsplash/search',
    {
      schema: {
        tags: ['Settings'],
        summary: 'Proxy an Unsplash photo search',
        description: 'Keeps the Unsplash API key server-side. Forwards to api.unsplash.com/search/photos.',
        querystring: {
          type: 'object',
          properties: {
            query: { type: 'string' },
            page: { type: 'string' },
            per_page: { type: 'string' },
          },
        },
        response: {
          200: { type: 'object', additionalProperties: true },
          503: proxyErrorResponseSchema,
        },
      },
    },
    async (req, reply) => {
      const key = await resolveSettingValue('unsplash_key');
      if (!key) return reply.code(503).send({ error: 'Unsplash API key not configured' });

      const query = req.query.query ?? 'nature';
      const page = req.query.page ?? '1';
      const perPage = req.query.per_page ?? '20';

      const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&page=${page}&per_page=${perPage}`;
      const res = await fetch(url, { headers: { Authorization: `Client-ID ${key}` } });
      const data = await res.json();
      return data;
    },
  );

  // Pollinations proxy — streams the image through our server to avoid CORS.
  app.get<{ Querystring: { prompt: string; model?: string; width?: string; height?: string; seed?: string } }>(
    '/api/v1/proxy/pollinations/image',
    {
      schema: {
        tags: ['Settings'],
        summary: 'Proxy an AI-generated image from Pollinations',
        description: 'Streams the image through the API server to avoid browser CORS issues. Keeps the optional Pollinations API key server-side.',
        querystring: {
          type: 'object',
          properties: {
            prompt: { type: 'string' },
            model: { type: 'string' },
            width: { type: 'string' },
            height: { type: 'string' },
            seed: { type: 'string' },
          },
          required: ['prompt'],
        },
        response: {
          400: proxyErrorResponseSchema,
          502: proxyErrorResponseSchema,
        },
      },
    },
    async (req, reply) => {
      const { prompt, model, width, height, seed } = req.query;
      if (!prompt) return reply.code(400).send({ error: 'prompt is required' });

      const params = new URLSearchParams();
      if (model) params.set('model', model);
      if (width) params.set('width', width);
      if (height) params.set('height', height);
      if (seed) params.set('seed', seed);
      params.set('nologo', 'true');

      const key = await resolveSettingValue('pollinations_key');
      if (key) params.set('key', key);

      const url = `https://gen.pollinations.ai/image/${encodeURIComponent(prompt)}?${params.toString()}`;

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 120_000); // 2 min timeout
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);

        if (!res.ok) {
          console.error(`[pollinations-proxy] ${res.status} ${res.statusText} for: ${url}`);
          return reply.code(502).send({ error: `Pollinations returned ${res.status}` });
        }

        const contentType = res.headers.get('content-type') ?? 'image/jpeg';
        reply.header('Content-Type', contentType);
        reply.header('Cache-Control', 'public, max-age=86400');

        const buffer = Buffer.from(await res.arrayBuffer());
        return reply.send(buffer);
      } catch (err) {
        const msg = (err as Error).name === 'AbortError' ? 'Pollinations timeout (>2min)' : (err as Error).message;
        return reply.code(502).send({ error: msg });
      }
    },
  );
}
