import type { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import { templates } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { errorResponseSchema, successResponseSchema, uuidIdParamSchema } from '../schemas/common.js';

const templateSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    name: { type: 'string' },
    categories: { type: 'array', items: { type: 'string' } },
    tags: { type: 'array', items: { type: 'string' } },
    fileUrl: { type: ['string', 'null'] },
    fileName: { type: ['string', 'null'] },
    price: { type: 'integer', description: 'Price in cents' },
    featured: { type: 'boolean' },
    active: { type: 'boolean' },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
  required: ['id', 'name', 'categories', 'tags', 'price', 'featured', 'active', 'createdAt', 'updatedAt'],
} as const;

const createTemplateBodySchema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    categories: { type: 'array', items: { type: 'string' } },
    tags: { type: 'array', items: { type: 'string' } },
    fileUrl: { type: 'string' },
    fileName: { type: 'string' },
    price: { type: 'integer' },
    featured: { type: 'boolean' },
    active: { type: 'boolean' },
  },
  required: ['name'],
} as const;

const updateTemplateBodySchema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    categories: { type: 'array', items: { type: 'string' } },
    tags: { type: 'array', items: { type: 'string' } },
    fileUrl: { type: 'string' },
    fileName: { type: 'string' },
    price: { type: 'integer' },
    featured: { type: 'boolean' },
    active: { type: 'boolean' },
  },
} as const;

export async function templateRoutes(app: FastifyInstance) {
  app.get(
    '/api/v1/templates',
    {
      schema: {
        tags: ['Templates'],
        summary: 'List all templates',
        response: { 200: { type: 'array', items: templateSchema } },
      },
    },
    async () => {
      return db.select().from(templates);
    },
  );

  app.get<{ Params: { id: string } }>(
    '/api/v1/templates/:id',
    {
      schema: {
        tags: ['Templates'],
        summary: 'Get a template by ID',
        params: uuidIdParamSchema,
        response: { 200: templateSchema, 404: errorResponseSchema },
      },
    },
    async (req, reply) => {
      const [item] = await db.select().from(templates).where(eq(templates.id, req.params.id));
      if (!item) return reply.code(404).send({ error: 'Template not found', code: 'NOT_FOUND' });
      return item;
    },
  );

  app.post<{ Body: { name: string; categories?: string[]; tags?: string[]; fileUrl?: string; fileName?: string; price?: number; featured?: boolean; active?: boolean } }>(
    '/api/v1/templates',
    {
      schema: {
        tags: ['Templates'],
        summary: 'Create a template',
        body: createTemplateBodySchema,
        response: { 200: templateSchema },
      },
    },
    async (req) => {
      const [item] = await db.insert(templates).values({
        name: req.body.name,
        categories: req.body.categories ?? [],
        tags: req.body.tags ?? [],
        fileUrl: req.body.fileUrl ?? null,
        fileName: req.body.fileName ?? null,
        price: req.body.price ?? 0,
        featured: req.body.featured ?? false,
        active: req.body.active ?? true,
      }).returning();
      return item;
    },
  );

  app.put<{ Params: { id: string }; Body: { name?: string; categories?: string[]; tags?: string[]; fileUrl?: string; fileName?: string; price?: number; featured?: boolean; active?: boolean } }>(
    '/api/v1/templates/:id',
    {
      schema: {
        tags: ['Templates'],
        summary: 'Update a template',
        params: uuidIdParamSchema,
        body: updateTemplateBodySchema,
        response: { 200: templateSchema, 404: errorResponseSchema },
      },
    },
    async (req, reply) => {
      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (req.body.name !== undefined) updates.name = req.body.name;
      if (req.body.categories !== undefined) updates.categories = req.body.categories;
      if (req.body.tags !== undefined) updates.tags = req.body.tags;
      if (req.body.fileUrl !== undefined) updates.fileUrl = req.body.fileUrl;
      if (req.body.fileName !== undefined) updates.fileName = req.body.fileName;
      if (req.body.price !== undefined) updates.price = req.body.price;
      if (req.body.featured !== undefined) updates.featured = req.body.featured;
      if (req.body.active !== undefined) updates.active = req.body.active;
      const [item] = await db.update(templates).set(updates).where(eq(templates.id, req.params.id)).returning();
      if (!item) return reply.code(404).send({ error: 'Template not found', code: 'NOT_FOUND' });
      return item;
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/api/v1/templates/:id',
    {
      schema: {
        tags: ['Templates'],
        summary: 'Delete a template',
        params: uuidIdParamSchema,
        response: { 200: successResponseSchema, 404: errorResponseSchema },
      },
    },
    async (req, reply) => {
      const [item] = await db.delete(templates).where(eq(templates.id, req.params.id)).returning();
      if (!item) return reply.code(404).send({ error: 'Template not found', code: 'NOT_FOUND' });
      return { success: true };
    },
  );
}
