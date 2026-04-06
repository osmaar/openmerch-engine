import type { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import { orders } from '../db/schema.js';
import { eq } from 'drizzle-orm';

export async function orderRoutes(app: FastifyInstance) {
  app.get('/api/v1/orders', async () => {
    return db.select().from(orders);
  });

  app.get<{ Params: { id: string } }>('/api/v1/orders/:id', async (req, reply) => {
    const [item] = await db.select().from(orders).where(eq(orders.id, req.params.id));
    if (!item) return reply.code(404).send({ error: 'Order not found', code: 'NOT_FOUND' });
    return item;
  });

  // POST for dev/testing — in production orders come from storefront
  app.post<{ Body: { orderId: string; customerName: string; productName: string; designId?: string; status?: string; total?: number } }>('/api/v1/orders', async (req) => {
    const [item] = await db.insert(orders).values({
      orderId: req.body.orderId,
      customerName: req.body.customerName,
      productName: req.body.productName,
      designId: req.body.designId ?? null,
      status: req.body.status ?? 'pending',
      total: req.body.total ?? 0,
    }).returning();
    return item;
  });

  // PATCH status
  app.patch<{ Params: { id: string }; Body: { status: string } }>(
    '/api/v1/orders/:id/status',
    async (req, reply) => {
      const [item] = await db.update(orders).set({ status: req.body.status, updatedAt: new Date() }).where(eq(orders.id, req.params.id)).returning();
      if (!item) return reply.code(404).send({ error: 'Order not found', code: 'NOT_FOUND' });
      return item;
    },
  );

  app.delete<{ Params: { id: string } }>('/api/v1/orders/:id', async (req, reply) => {
    const [item] = await db.delete(orders).where(eq(orders.id, req.params.id)).returning();
    if (!item) return reply.code(404).send({ error: 'Order not found', code: 'NOT_FOUND' });
    return { success: true };
  });
}
