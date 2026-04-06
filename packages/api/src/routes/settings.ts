import type { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import { settings } from '../db/schema.js';
import { eq } from 'drizzle-orm';

export async function settingRoutes(app: FastifyInstance) {
  // GET all settings (mask secrets)
  app.get('/api/v1/settings', async () => {
    const rows = await db.select().from(settings);
    return rows.map((r) => ({
      ...r,
      value: r.isSecret ? '••••••••' : r.value,
    }));
  });

  // PUT bulk upsert settings
  app.put<{ Body: { entries: { key: string; value: string; isSecret?: boolean }[] } }>('/api/v1/settings', async (req) => {
    for (const entry of req.body.entries) {
      const [existing] = await db.select().from(settings).where(eq(settings.key, entry.key));
      if (existing) {
        await db.update(settings).set({ value: entry.value, isSecret: entry.isSecret ?? existing.isSecret, updatedAt: new Date() }).where(eq(settings.key, entry.key));
      } else {
        await db.insert(settings).values({ key: entry.key, value: entry.value, isSecret: entry.isSecret ?? false });
      }
    }
    const rows = await db.select().from(settings);
    return rows.map((r) => ({
      ...r,
      value: r.isSecret ? '••••••••' : r.value,
    }));
  });
}
