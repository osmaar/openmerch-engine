import type { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import { shapes } from '../db/schema.js';
import { eq } from 'drizzle-orm';

export async function shapeRoutes(app: FastifyInstance) {
  app.get('/api/v1/shapes', async () => {
    return db.select().from(shapes);
  });

  app.post<{ Body: { name: string; svgContent?: string; sortOrder?: number; active?: boolean } }>('/api/v1/shapes', async (req) => {
    const [item] = await db.insert(shapes).values({
      name: req.body.name,
      svgContent: req.body.svgContent ?? '',
      sortOrder: req.body.sortOrder ?? 0,
      active: req.body.active ?? true,
    }).returning();
    return item;
  });

  app.put<{ Params: { id: string }; Body: { name?: string; svgContent?: string; sortOrder?: number; active?: boolean } }>(
    '/api/v1/shapes/:id',
    async (req, reply) => {
      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (req.body.name !== undefined) updates.name = req.body.name;
      if (req.body.svgContent !== undefined) updates.svgContent = req.body.svgContent;
      if (req.body.sortOrder !== undefined) updates.sortOrder = req.body.sortOrder;
      if (req.body.active !== undefined) updates.active = req.body.active;
      const [item] = await db.update(shapes).set(updates).where(eq(shapes.id, req.params.id)).returning();
      if (!item) return reply.code(404).send({ error: 'Shape not found', code: 'NOT_FOUND' });
      return item;
    },
  );

  app.delete<{ Params: { id: string } }>('/api/v1/shapes/:id', async (req, reply) => {
    const [item] = await db.delete(shapes).where(eq(shapes.id, req.params.id)).returning();
    if (!item) return reply.code(404).send({ error: 'Shape not found', code: 'NOT_FOUND' });
    return { success: true };
  });
}
