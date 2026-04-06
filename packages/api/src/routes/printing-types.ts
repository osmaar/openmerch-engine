import type { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import { printingTypes } from '../db/schema.js';
import { eq } from 'drizzle-orm';

export async function printingTypeRoutes(app: FastifyInstance) {
  app.get('/api/v1/printing-types', async () => {
    return db.select().from(printingTypes);
  });

  app.post<{ Body: { title: string; description?: string; thumbnailUrl?: string; active?: boolean; calculationMethod?: string; pricingConfig?: unknown; resourcePermissions?: unknown; layoutConfig?: unknown } }>('/api/v1/printing-types', async (req) => {
    const [item] = await db.insert(printingTypes).values({
      title: req.body.title,
      description: req.body.description ?? null,
      thumbnailUrl: req.body.thumbnailUrl ?? null,
      active: req.body.active ?? true,
      calculationMethod: req.body.calculationMethod ?? 'elements',
      pricingConfig: JSON.stringify(req.body.pricingConfig ?? {}),
      resourcePermissions: JSON.stringify(req.body.resourcePermissions ?? {}),
      layoutConfig: JSON.stringify(req.body.layoutConfig ?? {}),
    }).returning();
    return item;
  });

  app.put<{ Params: { id: string }; Body: { title?: string; description?: string; thumbnailUrl?: string; active?: boolean; calculationMethod?: string; pricingConfig?: unknown; resourcePermissions?: unknown; layoutConfig?: unknown } }>(
    '/api/v1/printing-types/:id',
    async (req, reply) => {
      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (req.body.title !== undefined) updates.title = req.body.title;
      if (req.body.description !== undefined) updates.description = req.body.description;
      if (req.body.thumbnailUrl !== undefined) updates.thumbnailUrl = req.body.thumbnailUrl;
      if (req.body.active !== undefined) updates.active = req.body.active;
      if (req.body.calculationMethod !== undefined) updates.calculationMethod = req.body.calculationMethod;
      if (req.body.pricingConfig !== undefined) updates.pricingConfig = JSON.stringify(req.body.pricingConfig);
      if (req.body.resourcePermissions !== undefined) updates.resourcePermissions = JSON.stringify(req.body.resourcePermissions);
      if (req.body.layoutConfig !== undefined) updates.layoutConfig = JSON.stringify(req.body.layoutConfig);
      const [item] = await db.update(printingTypes).set(updates).where(eq(printingTypes.id, req.params.id)).returning();
      if (!item) return reply.code(404).send({ error: 'Printing type not found', code: 'NOT_FOUND' });
      return item;
    },
  );

  app.delete<{ Params: { id: string } }>('/api/v1/printing-types/:id', async (req, reply) => {
    const [item] = await db.delete(printingTypes).where(eq(printingTypes.id, req.params.id)).returning();
    if (!item) return reply.code(404).send({ error: 'Printing type not found', code: 'NOT_FOUND' });
    return { success: true };
  });
}
