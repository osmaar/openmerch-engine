import type { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import { orders, orderDesigns, designs } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { errorResponseSchema, successResponseSchema, uuidIdParamSchema } from '../schemas/common.js';

const orderDesignSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    designId: { type: ['string', 'null'], format: 'uuid' },
    designKey: { type: 'string' },
    productName: { type: 'string' },
    designUrl: { type: ['string', 'null'] },
    designFilename: { type: ['string', 'null'] },
    designDimensions: { type: ['string', 'null'] },
    // Joined from the linked `designs` row, when resolved — convenience fields so the
    // admin panel doesn't need a second request per line item to show production status.
    productionStatus: { type: ['string', 'null'] },
    source: { type: ['string', 'null'] },
    createdAt: { type: 'string', format: 'date-time' },
  },
  required: ['id', 'designId', 'designKey', 'productName', 'createdAt'],
} as const;

const orderSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    orderId: { type: 'string' },
    customerName: { type: 'string' },
    status: { type: 'string' },
    total: { type: 'integer', description: 'Total in cents' },
    currency: { type: 'string', description: 'ISO 4217 code, e.g. "USD", "MXN"' },
    // Every customized line item on this order — an order can carry more than one.
    designs: { type: 'array', items: orderDesignSchema },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
  required: ['id', 'orderId', 'customerName', 'status', 'total', 'currency', 'designs', 'createdAt', 'updatedAt'],
} as const;

const createOrderDesignSchema = {
  type: 'object',
  properties: {
    designId: { type: 'string', format: 'uuid' },
    productName: { type: 'string' },
    designKey: { type: 'string' },
  },
  required: ['designId', 'productName'],
} as const;

const createOrderBodySchema = {
  type: 'object',
  properties: {
    orderId: { type: 'string' },
    customerName: { type: 'string' },
    status: { type: 'string' },
    total: { type: 'integer' },
    currency: { type: 'string' },
    designs: { type: 'array', items: createOrderDesignSchema },
  },
  required: ['orderId', 'customerName'],
} as const;

const updateOrderStatusBodySchema = {
  type: 'object',
  properties: {
    status: { type: 'string' },
  },
  required: ['status'],
} as const;

interface OrderDesignRow {
  orderId: string;
  id: string;
  designId: string | null;
  designKey: string;
  productName: string;
  designUrl: string | null;
  designFilename: string | null;
  designDimensions: string | null;
  productionStatus: string | null;
  source: string | null;
  createdAt: Date;
}

/** LEFT JOINs `designs` so callers get productionStatus/source without a request per line item. */
function selectOrderDesignRows() {
  return db
    .select({
      orderId: orderDesigns.orderId,
      id: orderDesigns.id,
      designId: orderDesigns.designId,
      designKey: orderDesigns.designKey,
      productName: orderDesigns.productName,
      designUrl: orderDesigns.designUrl,
      designFilename: orderDesigns.designFilename,
      designDimensions: orderDesigns.designDimensions,
      productionStatus: designs.productionStatus,
      source: designs.source,
      createdAt: orderDesigns.createdAt,
    })
    .from(orderDesigns)
    .leftJoin(designs, eq(orderDesigns.designId, designs.id));
}

function groupByOrderId(rows: OrderDesignRow[]): Map<string, Omit<OrderDesignRow, 'orderId'>[]> {
  const byOrder = new Map<string, Omit<OrderDesignRow, 'orderId'>[]>();
  for (const { orderId, ...rest } of rows) {
    const list = byOrder.get(orderId) ?? [];
    list.push(rest);
    byOrder.set(orderId, list);
  }
  return byOrder;
}

export async function orderRoutes(app: FastifyInstance) {
  app.get(
    '/api/v1/orders',
    {
      schema: {
        tags: ['Orders'],
        summary: 'List all orders',
        description: 'Each order includes every customized line item attached to it (see `designs`).',
        response: { 200: { type: 'array', items: orderSchema } },
      },
    },
    async () => {
      const [allOrders, rows] = await Promise.all([db.select().from(orders), selectOrderDesignRows()]);
      const byOrder = groupByOrderId(rows);
      return allOrders.map((o) => ({ ...o, designs: byOrder.get(o.id) ?? [] }));
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
      const rows = await selectOrderDesignRows().where(eq(orderDesigns.orderId, req.params.id));
      return { ...item, designs: rows.map(({ orderId, ...rest }) => { void orderId; return rest; }) };
    },
  );

  app.post<{
    Body: {
      orderId: string;
      customerName: string;
      status?: string;
      total?: number;
      currency?: string;
      designs?: { designId: string; productName: string; designKey?: string }[];
    };
  }>(
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
        status: req.body.status ?? 'pending',
        total: req.body.total ?? 0,
        currency: req.body.currency ?? 'USD',
      }).returning();
      // A plain single-row insert with no onConflict clause always returns that row.
      const created = item!;

      const designLines = req.body.designs ?? [];
      if (designLines.length > 0) {
        await db.insert(orderDesigns).values(
          designLines.map((d) => ({
            orderId: created.id,
            designId: d.designId,
            designKey: d.designKey ?? d.designId,
            productName: d.productName,
          })),
        );
      }

      const rows = await selectOrderDesignRows().where(eq(orderDesigns.orderId, created.id));
      return { ...created, designs: rows.map(({ orderId, ...rest }) => { void orderId; return rest; }) };
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
      const rows = await selectOrderDesignRows().where(eq(orderDesigns.orderId, item.id));
      return { ...item, designs: rows.map(({ orderId, ...rest }) => { void orderId; return rest; }) };
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
