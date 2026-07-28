import type { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import { orders } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { errorResponseSchema, successResponseSchema, uuidIdParamSchema } from '../schemas/common.js';

const orderSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    orderId: { type: 'string' },
    customerName: { type: 'string' },
    productName: { type: 'string' },
    designId: { type: ['string', 'null'], format: 'uuid' },
    status: { type: 'string' },
    total: { type: 'integer', description: 'Total in cents' },
    designFiles: { type: ['object', 'null'], additionalProperties: true },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
  required: ['id', 'orderId', 'customerName', 'productName', 'status', 'total', 'createdAt', 'updatedAt'],
} as const;

const createOrderBodySchema = {
  type: 'object',
  properties: {
    orderId: { type: 'string' },
    customerName: { type: 'string' },
    productName: { type: 'string' },
    designId: { type: 'string', format: 'uuid' },
    status: { type: 'string' },
    total: { type: 'integer' },
  },
  required: ['orderId', 'customerName', 'productName'],
} as const;

const updateOrderStatusBodySchema = {
  type: 'object',
  properties: {
    status: { type: 'string' },
  },
  required: ['status'],
} as const;

export async function orderRoutes(app: FastifyInstance) {
  app.get(
    '/api/v1/orders',
    {
      schema: {
        tags: ['Orders'],
        summary: 'List all orders',
        response: { 200: { type: 'array', items: orderSchema } },
      },
    },
    async () => {
      return db.select().from(orders);
    },
  );

  app.get<{ Params: { id: string } }>(
    '/api/v1/orders/:id',
    {
      schema: {
        tags: ['Orders'],
        summary: 'Get an order by ID',
        params: uuidIdParamSchema,
        response: { 200: orderSchema, 404: errorResponseSchema },
      },
    },
    async (req, reply) => {
      const [item] = await db.select().from(orders).where(eq(orders.id, req.params.id));
      if (!item) return reply.code(404).send({ error: 'Order not found', code: 'NOT_FOUND' });
      return item;
    },
  );

  app.post<{ Body: { orderId: string; customerName: string; productName: string; designId?: string; status?: string; total?: number } }>(
    '/api/v1/orders',
    {
      schema: {
        tags: ['Orders'],
        summary: 'Create an order',
        description: 'For dev/testing — in production orders come from the storefront.',
        body: createOrderBodySchema,
        response: { 200: orderSchema, 403: errorResponseSchema },
      },
    },
    async (req, reply) => {
      if (process.env.NODE_ENV === 'production') {
        return reply.code(403).send({
          error: 'This endpoint is only available outside production. In production, orders are created by the storefront integration.',
          code: 'FORBIDDEN_IN_PRODUCTION',
        });
      }

      const [item] = await db.insert(orders).values({
        orderId: req.body.orderId,
        customerName: req.body.customerName,
        productName: req.body.productName,
        designId: req.body.designId ?? null,
        status: req.body.status ?? 'pending',
        total: req.body.total ?? 0,
      }).returning();
      return item;
    },
  );

  app.patch<{ Params: { id: string }; Body: { status: string } }>(
    '/api/v1/orders/:id/status',
    {
      schema: {
        tags: ['Orders'],
        summary: 'Update an order status',
        params: uuidIdParamSchema,
        body: updateOrderStatusBodySchema,
        response: { 200: orderSchema, 404: errorResponseSchema },
      },
    },
    async (req, reply) => {
      const [item] = await db.update(orders).set({ status: req.body.status, updatedAt: new Date() }).where(eq(orders.id, req.params.id)).returning();
      if (!item) return reply.code(404).send({ error: 'Order not found', code: 'NOT_FOUND' });
      return item;
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/api/v1/orders/:id',
    {
      schema: {
        tags: ['Orders'],
        summary: 'Delete an order',
        params: uuidIdParamSchema,
        response: { 200: successResponseSchema, 404: errorResponseSchema },
      },
    },
    async (req, reply) => {
      const [item] = await db.delete(orders).where(eq(orders.id, req.params.id)).returning();
      if (!item) return reply.code(404).send({ error: 'Order not found', code: 'NOT_FOUND' });
      return { success: true };
    },
  );
}
