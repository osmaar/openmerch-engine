import type { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import { cliparts } from '../db/schema.js';
import { eq } from 'drizzle-orm';

export async function clipartRoutes(app: FastifyInstance) {
  app.get('/api/v1/cliparts', async () => {
    return db.select().from(cliparts);
  });

  app.get<{ Params: { id: string } }>('/api/v1/cliparts/:id', async (req, reply) => {
    const [item] = await db.select().from(cliparts).where(eq(cliparts.id, req.params.id));
    if (!item) return reply.code(404).send({ error: 'Clipart not found', code: 'NOT_FOUND' });
    return item;
  });

  app.post<{ Body: { name: string; categories?: string[]; tags?: string[]; fileUrl?: string; price?: number; featured?: boolean; active?: boolean } }>('/api/v1/cliparts', async (req) => {
    const [item] = await db.insert(cliparts).values({
      name: req.body.name,
      categories: JSON.stringify(req.body.categories ?? []),
      tags: JSON.stringify(req.body.tags ?? []),
      fileUrl: req.body.fileUrl ?? null,
      price: req.body.price ?? 0,
      featured: req.body.featured ?? false,
      active: req.body.active ?? true,
    }).returning();
    return item;
  });

  // Bulk create
  app.post<{ Body: { cliparts: { name: string; categories?: string[]; tags?: string[]; fileUrl?: string; price?: number }[] } }>('/api/v1/cliparts/bulk', async (req) => {
    const values = req.body.cliparts.map((c) => ({
      name: c.name,
      categories: JSON.stringify(c.categories ?? []),
      tags: JSON.stringify(c.tags ?? []),
      fileUrl: c.fileUrl ?? null,
      price: c.price ?? 0,
    }));
    const items = await db.insert(cliparts).values(values).returning();
    return items;
  });

  app.put<{ Params: { id: string }; Body: { name?: string; categories?: string[]; tags?: string[]; fileUrl?: string; price?: number; featured?: boolean; active?: boolean } }>(
    '/api/v1/cliparts/:id',
    async (req, reply) => {
      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (req.body.name !== undefined) updates.name = req.body.name;
      if (req.body.categories !== undefined) updates.categories = JSON.stringify(req.body.categories);
      if (req.body.tags !== undefined) updates.tags = JSON.stringify(req.body.tags);
      if (req.body.fileUrl !== undefined) updates.fileUrl = req.body.fileUrl;
      if (req.body.price !== undefined) updates.price = req.body.price;
      if (req.body.featured !== undefined) updates.featured = req.body.featured;
      if (req.body.active !== undefined) updates.active = req.body.active;
      const [item] = await db.update(cliparts).set(updates).where(eq(cliparts.id, req.params.id)).returning();
      if (!item) return reply.code(404).send({ error: 'Clipart not found', code: 'NOT_FOUND' });
      return item;
    },
  );

  app.delete<{ Params: { id: string } }>('/api/v1/cliparts/:id', async (req, reply) => {
    const [item] = await db.delete(cliparts).where(eq(cliparts.id, req.params.id)).returning();
    if (!item) return reply.code(404).send({ error: 'Clipart not found', code: 'NOT_FOUND' });
    return { success: true };
  });
}
