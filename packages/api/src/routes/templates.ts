import type { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import { templates } from '../db/schema.js';
import { eq } from 'drizzle-orm';

export async function templateRoutes(app: FastifyInstance) {
  app.get('/api/v1/templates', async () => {
    return db.select().from(templates);
  });

  app.get<{ Params: { id: string } }>('/api/v1/templates/:id', async (req, reply) => {
    const [item] = await db.select().from(templates).where(eq(templates.id, req.params.id));
    if (!item) return reply.code(404).send({ error: 'Template not found', code: 'NOT_FOUND' });
    return item;
  });

  app.post<{ Body: { name: string; categories?: string[]; tags?: string[]; fileUrl?: string; fileName?: string; price?: number; featured?: boolean; active?: boolean } }>('/api/v1/templates', async (req) => {
    const [item] = await db.insert(templates).values({
      name: req.body.name,
      categories: JSON.stringify(req.body.categories ?? []),
      tags: JSON.stringify(req.body.tags ?? []),
      fileUrl: req.body.fileUrl ?? null,
      fileName: req.body.fileName ?? null,
      price: req.body.price ?? 0,
      featured: req.body.featured ?? false,
      active: req.body.active ?? true,
    }).returning();
    return item;
  });

  app.put<{ Params: { id: string }; Body: { name?: string; categories?: string[]; tags?: string[]; fileUrl?: string; fileName?: string; price?: number; featured?: boolean; active?: boolean } }>(
    '/api/v1/templates/:id',
    async (req, reply) => {
      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (req.body.name !== undefined) updates.name = req.body.name;
      if (req.body.categories !== undefined) updates.categories = JSON.stringify(req.body.categories);
      if (req.body.tags !== undefined) updates.tags = JSON.stringify(req.body.tags);
      if (req.body.fileUrl !== undefined) updates.fileUrl = req.body.fileUrl;
      if (req.body.fileName !== undefined) updates.fileName = req.body.fileName;
      if (req.body.price !== undefined) updates.price = req.body.price;
      if (req.body.featured !== undefined) updates.featured = req.body.featured;
      if (req.body.active !== undefined) updates.active = req.body.active;
      const [item] = await db.update(templates).set(updates).where(eq(templates.id, req.params.id)).returning();
      if (!item) return reply.code(404).send({ error: 'Template not found', code: 'NOT_FOUND' });
      return item;
    },
  );

  app.delete<{ Params: { id: string } }>('/api/v1/templates/:id', async (req, reply) => {
    const [item] = await db.delete(templates).where(eq(templates.id, req.params.id)).returning();
    if (!item) return reply.code(404).send({ error: 'Template not found', code: 'NOT_FOUND' });
    return { success: true };
  });
}
