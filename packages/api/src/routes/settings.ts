import type { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import { settings } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { encrypt, decrypt } from '../utils/crypto.js';
import { config } from '../config.js';

/** Settings that are safe to expose to the public frontend (editor/demo). */
/** Only settings the public frontend (editor/demo) needs. No business data. */
const PUBLIC_KEYS = ['store_name', 'show_branding', 'favicon_url'];

/** Resolve a setting value: DB (decrypted if secret) → env fallback → null. */
async function resolveSettingValue(key: string): Promise<string | null> {
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

export async function settingRoutes(app: FastifyInstance) {
  // GET all settings (mask secrets) — admin only
  app.get('/api/v1/settings', async () => {
    const rows = await db.select().from(settings);
    return rows.map((r) => ({
      ...r,
      value: r.isSecret ? '••••••••' : r.value,
    }));
  });

  // GET public settings — safe for frontend/editor (no secrets, no business data)
  app.get('/api/v1/settings/public', async (req) => {
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
  });

  // PUT bulk upsert settings — admin only
  app.put<{ Body: { entries: { key: string; value: string; isSecret?: boolean }[] } }>('/api/v1/settings', async (req) => {
    for (const entry of req.body.entries) {
      // Encrypt secret values before storing
      const storedValue = entry.isSecret ? encrypt(entry.value) : entry.value;

      const [existing] = await db.select().from(settings).where(eq(settings.key, entry.key));
      if (existing) {
        // Skip if the value is the masked placeholder (no change intended)
        if (entry.isSecret && entry.value === '••••••••') continue;
        await db.update(settings).set({
          value: storedValue,
          isSecret: entry.isSecret ?? existing.isSecret,
          updatedAt: new Date(),
        }).where(eq(settings.key, entry.key));
      } else {
        await db.insert(settings).values({
          key: entry.key,
          value: storedValue,
          isSecret: entry.isSecret ?? false,
        });
      }
    }
    const rows = await db.select().from(settings);
    return rows.map((r) => ({
      ...r,
      value: r.isSecret ? '••••••••' : r.value,
    }));
  });

  // --- Proxy endpoints: API keys never reach the browser ---

  // Unsplash proxy: /api/v1/proxy/unsplash/search?query=...&page=...&per_page=...
  app.get<{ Querystring: { query?: string; page?: string; per_page?: string } }>('/api/v1/proxy/unsplash/search', async (req, reply) => {
    const key = await resolveSettingValue('unsplash_key');
    if (!key) return reply.code(503).send({ error: 'Unsplash API key not configured' });

    const query = req.query.query ?? 'nature';
    const page = req.query.page ?? '1';
    const perPage = req.query.per_page ?? '20';

    const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&page=${page}&per_page=${perPage}`;
    const res = await fetch(url, { headers: { Authorization: `Client-ID ${key}` } });
    const data = await res.json();
    return data;
  });

  // Pollinations proxy — streams the image through our server to avoid CORS.
  // GET /api/v1/proxy/pollinations/image?prompt=...&model=...&width=...&height=...&seed=...
  app.get<{ Querystring: { prompt: string; model?: string; width?: string; height?: string; seed?: string } }>(
    '/api/v1/proxy/pollinations/image',
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
