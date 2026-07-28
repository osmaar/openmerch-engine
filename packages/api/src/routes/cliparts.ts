import type { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import { cliparts } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { errorResponseSchema, successResponseSchema, uuidIdParamSchema } from '../schemas/common.js';

const clipartSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    name: { type: 'string' },
    categories: { type: 'array', items: { type: 'string' } },
    tags: { type: 'array', items: { type: 'string' } },
    fileUrl: { type: ['string', 'null'] },
    price: { type: 'integer', description: 'Price in cents' },
    featured: { type: 'boolean' },
    active: { type: 'boolean' },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
  required: ['id', 'name', 'categories', 'tags', 'price', 'featured', 'active', 'createdAt', 'updatedAt'],
} as const;

const createClipartBodySchema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    categories: { type: 'array', items: { type: 'string' } },
    tags: { type: 'array', items: { type: 'string' } },
    fileUrl: { type: 'string' },
    price: { type: 'integer' },
    featured: { type: 'boolean' },
    active: { type: 'boolean' },
  },
  required: ['name'],
} as const;

const bulkCreateClipartsBodySchema = {
  type: 'object',
  properties: {
    cliparts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          categories: { type: 'array', items: { type: 'string' } },
          tags: { type: 'array', items: { type: 'string' } },
          fileUrl: { type: 'string' },
          price: { type: 'integer' },
        },
        required: ['name'],
      },
    },
  },
  required: ['cliparts'],
} as const;

const updateClipartBodySchema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    categories: { type: 'array', items: { type: 'string' } },
    tags: { type: 'array', items: { type: 'string' } },
    fileUrl: { type: 'string' },
    price: { type: 'integer' },
    featured: { type: 'boolean' },
    active: { type: 'boolean' },
  },
} as const;

export async function clipartRoutes(app: FastifyInstance) {
  app.get(
    '/api/v1/cliparts',
    {
      schema: {
        tags: ['Cliparts'],
        summary: 'List all cliparts',
        response: { 200: { type: 'array', items: clipartSchema } },
      },
    },
    async () => {
      return db.select().from(cliparts);
    },
  );

  app.get<{ Params: { id: string } }>(
    '/api/v1/cliparts/:id',
    {
      schema: {
        tags: ['Cliparts'],
        summary: 'Get a clipart by ID',
        params: uuidIdParamSchema,
        response: { 200: clipartSchema, 404: errorResponseSchema },
      },
    },
    async (req, reply) => {
      const [item] = await db.select().from(cliparts).where(eq(cliparts.id, req.params.id));
      if (!item) return reply.code(404).send({ error: 'Clipart not found', code: 'NOT_FOUND' });
      return item;
    },
  );

  app.post<{ Body: { name: string; categories?: string[]; tags?: string[]; fileUrl?: string; price?: number; featured?: boolean; active?: boolean } }>(
    '/api/v1/cliparts',
    {
      schema: {
        tags: ['Cliparts'],
        summary: 'Create a clipart',
        body: createClipartBodySchema,
        response: { 200: clipartSchema },
      },
    },
    async (req) => {
      const [item] = await db.insert(cliparts).values({
        name: req.body.name,
        categories: req.body.categories ?? [],
        tags: req.body.tags ?? [],
        fileUrl: req.body.fileUrl ?? null,
        price: req.body.price ?? 0,
        featured: req.body.featured ?? false,
        active: req.body.active ?? true,
      }).returning();
      return item;
    },
  );

  app.post<{ Body: { cliparts: { name: string; categories?: string[]; tags?: string[]; fileUrl?: string; price?: number }[] } }>(
    '/api/v1/cliparts/bulk',
    {
      schema: {
        tags: ['Cliparts'],
        summary: 'Bulk create cliparts',
        body: bulkCreateClipartsBodySchema,
        response: { 200: { type: 'array', items: clipartSchema } },
      },
    },
    async (req) => {
      const values = req.body.cliparts.map((c) => ({
        name: c.name,
        categories: c.categories ?? [],
        tags: c.tags ?? [],
        fileUrl: c.fileUrl ?? null,
        price: c.price ?? 0,
      }));
      const items = await db.insert(cliparts).values(values).returning();
      return items;
    },
  );

  app.put<{ Params: { id: string }; Body: { name?: string; categories?: string[]; tags?: string[]; fileUrl?: string; price?: number; featured?: boolean; active?: boolean } }>(
    '/api/v1/cliparts/:id',
    {
      schema: {
        tags: ['Cliparts'],
        summary: 'Update a clipart',
        params: uuidIdParamSchema,
        body: updateClipartBodySchema,
        response: { 200: clipartSchema, 404: errorResponseSchema },
      },
    },
    async (req, reply) => {
      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (req.body.name !== undefined) updates.name = req.body.name;
      if (req.body.categories !== undefined) updates.categories = req.body.categories;
      if (req.body.tags !== undefined) updates.tags = req.body.tags;
      if (req.body.fileUrl !== undefined) updates.fileUrl = req.body.fileUrl;
      if (req.body.price !== undefined) updates.price = req.body.price;
      if (req.body.featured !== undefined) updates.featured = req.body.featured;
      if (req.body.active !== undefined) updates.active = req.body.active;
      const [item] = await db.update(cliparts).set(updates).where(eq(cliparts.id, req.params.id)).returning();
      if (!item) return reply.code(404).send({ error: 'Clipart not found', code: 'NOT_FOUND' });
      return item;
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/api/v1/cliparts/:id',
    {
      schema: {
        tags: ['Cliparts'],
        summary: 'Delete a clipart',
        params: uuidIdParamSchema,
        response: { 200: successResponseSchema, 404: errorResponseSchema },
      },
    },
    async (req, reply) => {
      const [item] = await db.delete(cliparts).where(eq(cliparts.id, req.params.id)).returning();
      if (!item) return reply.code(404).send({ error: 'Clipart not found', code: 'NOT_FOUND' });
      return { success: true };
    },
  );
}
