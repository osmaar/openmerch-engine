import type { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import { fonts } from '../db/schema.js';
import { eq } from 'drizzle-orm';

export async function fontRoutes(app: FastifyInstance) {
  app.get('/api/v1/fonts', async () => {
    return db.select().from(fonts);
  });

  app.post<{ Body: { name: string; description?: string; fileUrl?: string; isGoogle?: boolean; active?: boolean } }>('/api/v1/fonts', async (req) => {
    const [item] = await db.insert(fonts).values({
      name: req.body.name,
      description: req.body.description ?? 'The quick brown fox jumps over the lazy dog',
      fileUrl: req.body.fileUrl ?? null,
      isGoogle: req.body.isGoogle ?? false,
      active: req.body.active ?? true,
    }).returning();
    return item;
  });

  app.put<{ Params: { id: string }; Body: { name?: string; description?: string; fileUrl?: string; isGoogle?: boolean; active?: boolean } }>(
    '/api/v1/fonts/:id',
    async (req, reply) => {
      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (req.body.name !== undefined) updates.name = req.body.name;
      if (req.body.description !== undefined) updates.description = req.body.description;
      if (req.body.fileUrl !== undefined) updates.fileUrl = req.body.fileUrl;
      if (req.body.isGoogle !== undefined) updates.isGoogle = req.body.isGoogle;
      if (req.body.active !== undefined) updates.active = req.body.active;
      const [item] = await db.update(fonts).set(updates).where(eq(fonts.id, req.params.id)).returning();
      if (!item) return reply.code(404).send({ error: 'Font not found', code: 'NOT_FOUND' });
      return item;
    },
  );

  app.delete<{ Params: { id: string } }>('/api/v1/fonts/:id', async (req, reply) => {
    const [item] = await db.delete(fonts).where(eq(fonts.id, req.params.id)).returning();
    if (!item) return reply.code(404).send({ error: 'Font not found', code: 'NOT_FOUND' });
    return { success: true };
  });
}
