import type { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import { designs } from '../db/schema.js';
import { eq } from 'drizzle-orm';

export async function designRoutes(app: FastifyInstance) {
  // POST /api/v1/designs — save a design
  app.post<{ Body: { productId: string; name?: string; designData: unknown } }>('/api/v1/designs', async (req) => {
    const [design] = await db.insert(designs).values({
      productId: req.body.productId,
      name: req.body.name ?? 'Untitled Design',
      designData: req.body.designData,
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
  app.put<{ Params: { id: string }; Body: { name?: string; designData?: unknown; thumbnailUrl?: string } }>(
    '/api/v1/designs/:id',
    async (req, reply) => {
      const [design] = await db
        .update(designs)
        .set({
          ...(req.body.name !== undefined ? { name: req.body.name } : {}),
          ...(req.body.designData !== undefined ? { designData: req.body.designData } : {}),
          ...(req.body.thumbnailUrl !== undefined ? { thumbnailUrl: req.body.thumbnailUrl } : {}),
          updatedAt: new Date(),
        })
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
