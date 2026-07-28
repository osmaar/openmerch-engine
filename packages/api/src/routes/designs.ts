import type { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import { designs, products } from '../db/schema.js';
import { eq, count, and, or, isNull, notInArray } from 'drizzle-orm';
import { computeProductionJobId, enqueueProductionFiles } from '../jobs/queues.js';
import { errorResponseSchema, successResponseSchema, uuidIdParamSchema } from '../schemas/common.js';

const designSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    productId: { type: 'string', format: 'uuid' },
    name: { type: ['string', 'null'] },
    designData: { type: 'object', additionalProperties: true, description: 'Layers, zones and image references for the design canvas' },
    thumbnailUrl: { type: ['string', 'null'] },
    status: { type: 'string', enum: ['draft', 'cart', 'paid', 'cancelled'] },
    sizes: { type: 'object', additionalProperties: { type: 'integer' }, description: 'Size label to quantity map, e.g. { "S": 2, "M": 1 }' },
    productColor: { type: ['string', 'null'] },
    productionFiles: { type: ['object', 'null'], additionalProperties: { type: 'string' }, description: 'Zone ID to production file URL map' },
    productionStatus: { type: ['string', 'null'], enum: [null, 'queued', 'processing', 'completed', 'failed'] },
    productionError: { type: ['string', 'null'] },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
  required: ['id', 'productId', 'designData', 'status', 'sizes', 'createdAt', 'updatedAt'],
} as const;

const createDesignBodySchema = {
  type: 'object',
  properties: {
    productId: { type: 'string', format: 'uuid' },
    name: { type: 'string' },
    designData: { type: 'object', additionalProperties: true },
    status: { type: 'string', enum: ['draft', 'cart', 'paid', 'cancelled'] },
    sizes: { type: 'object', additionalProperties: { type: 'integer' } },
    productColor: { type: 'string' },
  },
  required: ['productId', 'designData'],
} as const;

const updateDesignBodySchema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    designData: { type: 'object', additionalProperties: true },
    thumbnailUrl: { type: 'string' },
    status: { type: 'string', enum: ['draft', 'cart', 'paid', 'cancelled'] },
    sizes: { type: 'object', additionalProperties: { type: 'integer' } },
    productColor: { type: 'string' },
  },
} as const;

export async function designRoutes(app: FastifyInstance) {
  app.post<{ Body: { productId: string; name?: string; designData: unknown; status?: string; sizes?: Record<string, number>; productColor?: string } }>(
    '/api/v1/designs',
    {
      schema: {
        tags: ['Designs'],
        summary: 'Save a new design',
        body: createDesignBodySchema,
        response: { 200: designSchema },
      },
    },
    async (req) => {
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
    },
  );

  app.get<{ Params: { id: string } }>(
    '/api/v1/designs/:id',
    {
      schema: {
        tags: ['Designs'],
        summary: 'Get a design by ID',
        params: uuidIdParamSchema,
        response: { 200: designSchema, 404: errorResponseSchema },
      },
    },
    async (req, reply) => {
      const [design] = await db.select().from(designs).where(eq(designs.id, req.params.id));
      if (!design) return reply.code(404).send({ error: 'Design not found', code: 'DESIGN_NOT_FOUND' });
      return design;
    },
  );

  app.put<{ Params: { id: string }; Body: { name?: string; designData?: unknown; thumbnailUrl?: string; status?: string; sizes?: Record<string, number>; productColor?: string } }>(
    '/api/v1/designs/:id',
    {
      schema: {
        tags: ['Designs'],
        summary: 'Update a design',
        params: uuidIdParamSchema,
        body: updateDesignBodySchema,
        response: { 200: designSchema, 404: errorResponseSchema },
      },
    },
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

  app.get(
    '/api/v1/designs',
    {
      schema: {
        tags: ['Designs'],
        summary: 'List all designs',
        response: { 200: { type: 'array', items: designSchema } },
      },
    },
    async () => {
      return db.select().from(designs);
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/api/v1/designs/:id',
    {
      schema: {
        tags: ['Designs'],
        summary: 'Delete a design',
        params: uuidIdParamSchema,
        response: { 200: successResponseSchema, 404: errorResponseSchema },
      },
    },
    async (req, reply) => {
      const [design] = await db.delete(designs).where(eq(designs.id, req.params.id)).returning();
      if (!design) return reply.code(404).send({ error: 'Design not found', code: 'DESIGN_NOT_FOUND' });
      return { success: true };
    },
  );

  app.post<{ Params: { id: string } }>(
    '/api/v1/designs/:id/generate-files',
    {
      schema: {
        tags: ['Designs'],
        summary: 'Enqueue production file generation',
        description: 'Enqueues a BullMQ job that renders one PNG per zone of the product at 300 DPI and uploads them to MinIO under production/{designId}/{zoneId}.png. The actual rendering runs in a separate worker process (`pnpm worker`).',
        params: uuidIdParamSchema,
        response: {
          200: {
            type: 'object',
            properties: {
              jobId: { type: 'string' },
              status: { type: 'string', enum: ['queued', 'processing'] },
              designId: { type: 'string', format: 'uuid' },
            },
            required: ['jobId', 'status', 'designId'],
          },
          404: errorResponseSchema,
        },
      },
    },
    async (req, reply) => {
      const [existing] = await db.select().from(designs).where(eq(designs.id, req.params.id));
      if (!existing) return reply.code(404).send({ error: 'Design not found', code: 'DESIGN_NOT_FOUND' });

      // Already in flight: don't enqueue a competing job, just report where it's at.
      // jobId is recomputed (not stored) since it's a pure function of the design's own content.
      if (existing.productionStatus === 'queued' || existing.productionStatus === 'processing') {
        return {
          jobId: computeProductionJobId(existing.id, existing.designData, existing.productColor),
          status: existing.productionStatus,
          designId: existing.id,
        };
      }

      // Atomic claim: only flip to "queued" if the row is still NOT in progress at write time.
      // Closes the TOCTOU race between the SELECT above and this UPDATE — two requests arriving
      // at the same instant can both pass the check above, but only one of these UPDATEs wins.
      const [claimed] = await db
        .update(designs)
        .set({ productionStatus: 'queued', productionError: null, updatedAt: new Date() })
        .where(
          and(
            eq(designs.id, req.params.id),
            or(isNull(designs.productionStatus), notInArray(designs.productionStatus, ['queued', 'processing'])),
          ),
        )
        .returning();

      if (!claimed) {
        // Lost the race: another request just claimed it. Report its state instead of enqueuing.
        const [current] = await db.select().from(designs).where(eq(designs.id, req.params.id));
        if (!current) return reply.code(404).send({ error: 'Design not found', code: 'DESIGN_NOT_FOUND' });
        return {
          jobId: computeProductionJobId(current.id, current.designData, current.productColor),
          status: (current.productionStatus ?? 'queued') as 'queued' | 'processing',
          designId: current.id,
        };
      }

      const jobId = await enqueueProductionFiles(claimed.id, claimed.designData, claimed.productColor);
      return { jobId, status: 'queued' as const, designId: req.params.id };
    },
  );
}
