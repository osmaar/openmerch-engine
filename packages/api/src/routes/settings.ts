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
    hf_token: process.env.HF_TOKEN,
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

  // Hugging Face AI image generation proxy — streams the image through our server to
  // avoid CORS and keep the token server-side. Verified empirically against Hugging
  // Face's Inference Providers router: most third-party providers (fal-ai, together,
  // replicate, nscale) reject serverless calls without a paid/billing-enabled HF
  // account, and HF's own free "hf-inference" provider has deprecated most popular
  // checkpoints (FLUX.1, SDXL) — stabilityai/stable-diffusion-3-medium-diffusers is the
  // one confirmed-working, genuinely free (no billing required) text-to-image model.
  const HF_MODEL = 'stabilityai/stable-diffusion-3-medium-diffusers';
  const HF_INFERENCE_URL = `https://router.huggingface.co/hf-inference/models/${HF_MODEL}`;

  app.get<{ Querystring: { prompt: string; width?: string; height?: string } }>(
    '/api/v1/proxy/ai-image',
    {
      schema: {
        tags: ['Settings'],
        summary: 'Generate an AI image via Hugging Face Inference Providers',
        description: `Streams a Stable Diffusion 3 Medium generation (${HF_MODEL}, hf-inference provider) through the API server to avoid browser CORS issues and keep HF_TOKEN server-side. Returns 503 if HF_TOKEN isn't configured.`,
        querystring: {
          type: 'object',
          properties: {
            prompt: { type: 'string' },
            width: { type: 'string' },
            height: { type: 'string' },
          },
          required: ['prompt'],
        },
        response: {
          400: proxyErrorResponseSchema,
          502: proxyErrorResponseSchema,
          503: proxyErrorResponseSchema,
        },
      },
    },
    async (req, reply) => {
      const { prompt, width, height } = req.query;
      if (!prompt) return reply.code(400).send({ error: 'prompt is required' });

      const token = await resolveSettingValue('hf_token');
      if (!token) {
        return reply.code(503).send({ error: 'AI image generation service not configured (HF_TOKEN unset)' });
      }

      const parameters: { width?: number; height?: number } = {};
      if (width) parameters.width = Number(width);
      if (height) parameters.height = Number(height);

      // No caching: each generation is meant to be a fresh, non-deterministic result —
      // unlike the old Pollinations flow, there's no seed param here to make a repeat
      // request intentionally reproducible/cacheable.
      const MAX_ATTEMPTS = 2;
      const RETRY_DELAY_MS = 1000;

      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 120_000); // 2 min timeout
          const res = await fetch(HF_INFERENCE_URL, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ inputs: prompt, parameters }),
            signal: controller.signal,
          });
          clearTimeout(timeout);

          if (!res.ok) {
            const bodyText = await res.text().catch(() => '');
            console.error(`[hf-image-proxy] attempt ${attempt}/${MAX_ATTEMPTS}: ${res.status} ${res.statusText} — ${bodyText.slice(0, 300)}`);
            if (attempt < MAX_ATTEMPTS) {
              await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
              continue;
            }
            return reply.code(502).send({ error: `Hugging Face returned ${res.status}` });
          }

          reply.header('Content-Type', res.headers.get('content-type') ?? 'image/jpeg');
          reply.header('Cache-Control', 'no-store');

          const buffer = Buffer.from(await res.arrayBuffer());
          return reply.send(buffer);
        } catch (err) {
          const msg = (err as Error).name === 'AbortError' ? 'Hugging Face timeout (>2min)' : (err as Error).message;
          if (attempt < MAX_ATTEMPTS) {
            console.error(`[hf-image-proxy] attempt ${attempt}/${MAX_ATTEMPTS} threw: ${msg}`);
            await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
            continue;
          }
          return reply.code(502).send({ error: msg });
        }
      }

      // Unreachable — the loop above always returns by its last iteration — but keeps
      // TypeScript happy about a guaranteed return type.
      return reply.code(502).send({ error: 'Hugging Face returned an error' });
    },
  );
}
