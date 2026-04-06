import type { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import { designs } from '../db/schema.js';
import { eq } from 'drizzle-orm';

export async function designRoutes(app: FastifyInstance) {
  // POST /api/v1/designs — save a design
  app.post<{ Body: { productId: string; name?: string; designData: unknown; status?: string; sizes?: Record<string, number>; productColor?: string } }>('/api/v1/designs', async (req) => {
    const [design] = await db.insert(designs).values({
      productId: req.body.productId,
      name: req.body.name ?? 'Untitled Design',
      designData: req.body.designData,
      status: req.body.status ?? 'draft',
      sizes: JSON.stringify(req.body.sizes ?? {}),
      productColor: req.body.productColor ?? null,
    }).returning();
    return design;
  });

  // GET /api/v1/designs/:id
  app.get<{ Params: { id: string } }>('/api/v1/designs/:id', async (req, reply) => {
    const [design] = await db.select().from(designs).where(eq(designs.id, req.params.id));
    if (!design) return reply.code(404).send({ error: 'Design not found', code: 'DESIGN_NOT_FOUND' });
    return design;
  });

  // PUT /api/v1/designs/:id — update a design
  app.put<{ Params: { id: string }; Body: { name?: string; designData?: unknown; thumbnailUrl?: string; status?: string; sizes?: Record<string, number>; productColor?: string } }>(
    '/api/v1/designs/:id',
    async (req, reply) => {
      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (req.body.name !== undefined) updates.name = req.body.name;
      if (req.body.designData !== undefined) updates.designData = req.body.designData;
      if (req.body.thumbnailUrl !== undefined) updates.thumbnailUrl = req.body.thumbnailUrl;
      if (req.body.status !== undefined) updates.status = req.body.status;
      if (req.body.sizes !== undefined) updates.sizes = JSON.stringify(req.body.sizes);
      if (req.body.productColor !== undefined) updates.productColor = req.body.productColor;
      const [design] = await db
        .update(designs)
        .set(updates)
        .where(eq(designs.id, req.params.id))
        .returning();
      if (!design) return reply.code(404).send({ error: 'Design not found', code: 'DESIGN_NOT_FOUND' });
      return design;
    },
  );

  // GET /api/v1/designs — list all designs
  app.get('/api/v1/designs', async () => {
    return db.select().from(designs);
  });

  // DELETE /api/v1/designs/:id
  app.delete<{ Params: { id: string } }>('/api/v1/designs/:id', async (req, reply) => {
    const [design] = await db.delete(designs).where(eq(designs.id, req.params.id)).returning();
    if (!design) return reply.code(404).send({ error: 'Design not found', code: 'DESIGN_NOT_FOUND' });
    return { success: true };
  });
}
