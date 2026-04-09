import type { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import { designs, products } from '../db/schema.js';
import { eq, count } from 'drizzle-orm';
import { enqueueProductionFiles } from '../jobs/queues.js';

export async function designRoutes(app: FastifyInstance) {
  // POST /api/v1/designs — save a design
  app.post<{ Body: { productId: string; name?: string; designData: unknown; status?: string; sizes?: Record<string, number>; productColor?: string } }>('/api/v1/designs', async (req) => {
    // Auto-generate a descriptive name: "{ProductName} - Design #N"
    let designName = req.body.name;
    if (!designName) {
      const [product] = await db.select({ name: products.name }).from(products).where(eq(products.id, req.body.productId));
      const countResult = await db.select({ total: count() }).from(designs).where(eq(designs.productId, req.body.productId));
      const seq = (countResult[0]?.total ?? 0) + 1;
      const productLabel = product?.name ?? 'Product';
      designName = `${productLabel} - Design #${String(seq).padStart(3, '0')}`;
    }

    const [design] = await db.insert(designs).values({
      productId: req.body.productId,
      name: designName,
      designData: req.body.designData,
      status: req.body.status ?? 'draft',
      sizes: req.body.sizes ?? {},
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
      if (req.body.sizes !== undefined) updates.sizes = req.body.sizes;
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

  // POST /api/v1/designs/:id/generate-files
  // Enqueues a BullMQ job that renders one PNG per zone of the product at 300 DPI
  // and uploads them to MinIO under production/{designId}/{zoneId}.png.
  // The actual rendering runs in a separate worker process (`pnpm worker`).
  app.post<{ Params: { id: string } }>('/api/v1/designs/:id/generate-files', async (req, reply) => {
    // Verify the design exists before enqueuing.
    const [existing] = await db.select().from(designs).where(eq(designs.id, req.params.id));
    if (!existing) return reply.code(404).send({ error: 'Design not found', code: 'DESIGN_NOT_FOUND' });

    // Mark as queued first so the UI reflects the state immediately, then enqueue.
    await db
      .update(designs)
      .set({
        productionStatus: 'queued',
        productionError: null,
        updatedAt: new Date(),
      })
      .where(eq(designs.id, req.params.id));

    const jobId = await enqueueProductionFiles(req.params.id);
    return { jobId, status: 'queued' as const, designId: req.params.id };
  });
}
