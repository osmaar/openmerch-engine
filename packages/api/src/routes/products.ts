import type { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import { products } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { errorResponseSchema, successResponseSchema, uuidIdParamSchema } from '../schemas/common.js';

const zoneSchema = {
  type: 'object',
  additionalProperties: true,
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    baseImageWidthMM: { type: 'number' },
    baseImageHeightMM: { type: 'number' },
    printAreaWidthMM: { type: 'number' },
    printAreaHeightMM: { type: 'number' },
    printAreaXMM: { type: 'number' },
    printAreaYMM: { type: 'number' },
    baseImageUrl: { type: 'string' },
  },
} as const;

const productSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    name: { type: 'string' },
    slug: { type: 'string' },
    description: { type: ['string', 'null'] },
    price: { type: 'integer', description: 'Price in cents' },
    categories: { type: 'array', items: { type: 'string' } },
    printingTechniques: { type: 'array', items: { type: 'string' } },
    active: { type: 'boolean' },
    zones: { type: 'array', items: zoneSchema },
    variants: { type: ['array', 'null'], items: { type: 'object', additionalProperties: true } },
    variantLabel: { type: ['string', 'null'] },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
  required: ['id', 'name', 'slug', 'price', 'categories', 'printingTechniques', 'active', 'zones', 'createdAt', 'updatedAt'],
} as const;

const createProductBodySchema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    slug: { type: 'string' },
    description: { type: 'string' },
    price: { type: 'integer', description: 'Price in cents' },
    categories: { type: 'array', items: { type: 'string' } },
    printingTechniques: { type: 'array', items: { type: 'string' } },
    active: { type: 'boolean' },
    zones: { type: 'array', items: zoneSchema },
  },
  required: ['name', 'slug', 'zones'],
} as const;

const updateProductBodySchema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    slug: { type: 'string' },
    description: { type: 'string' },
    price: { type: 'integer', description: 'Price in cents' },
    categories: { type: 'array', items: { type: 'string' } },
    printingTechniques: { type: 'array', items: { type: 'string' } },
    active: { type: 'boolean' },
    zones: { type: 'array', items: zoneSchema },
    variants: { type: 'array', items: { type: 'object', additionalProperties: true } },
    variantLabel: { type: ['string', 'null'] },
  },
} as const;

export async function productRoutes(app: FastifyInstance) {
  app.get(
    '/api/v1/products',
    {
      schema: {
        tags: ['Products'],
        summary: 'List all products',
        response: { 200: { type: 'array', items: productSchema } },
      },
    },
    async () => {
      return db.select().from(products);
    },
  );

  app.get<{ Params: { id: string } }>(
    '/api/v1/products/:id',
    {
      schema: {
        tags: ['Products'],
        summary: 'Get a product by ID',
        params: uuidIdParamSchema,
        response: { 200: productSchema, 404: errorResponseSchema },
      },
    },
    async (req, reply) => {
      const [product] = await db.select().from(products).where(eq(products.id, req.params.id));
      if (!product) return reply.code(404).send({ error: 'Product not found', code: 'PRODUCT_NOT_FOUND' });
      return product;
    },
  );

  app.post<{ Body: { name: string; slug: string; description?: string; price?: number; categories?: string[]; printingTechniques?: string[]; active?: boolean; zones: unknown[] } }>(
    '/api/v1/products',
    {
      schema: {
        tags: ['Products'],
        summary: 'Create a product',
        body: createProductBodySchema,
        response: { 200: productSchema },
      },
    },
    async (req) => {
      const [product] = await db.insert(products).values({
        name: req.body.name,
        slug: req.body.slug,
        description: req.body.description ?? null,
        price: req.body.price ?? 0,
        categories: req.body.categories ?? [],
        printingTechniques: req.body.printingTechniques ?? [],
        active: req.body.active ?? true,
        zones: req.body.zones,
      }).returning();
      return product;
    },
  );

  app.put<{ Params: { id: string }; Body: { name?: string; slug?: string; description?: string; price?: number; categories?: string[]; printingTechniques?: string[]; active?: boolean; zones?: unknown[]; variants?: unknown[]; variantLabel?: string | null } }>(
    '/api/v1/products/:id',
    {
      schema: {
        tags: ['Products'],
        summary: 'Update a product',
        params: uuidIdParamSchema,
        body: updateProductBodySchema,
        response: { 200: productSchema, 404: errorResponseSchema },
      },
    },
    async (req, reply) => {
      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (req.body.name !== undefined) updates.name = req.body.name;
      if (req.body.slug !== undefined) updates.slug = req.body.slug;
      if (req.body.description !== undefined) updates.description = req.body.description;
      if (req.body.price !== undefined) updates.price = req.body.price;
      if (req.body.categories !== undefined) updates.categories = req.body.categories;
      if (req.body.printingTechniques !== undefined) updates.printingTechniques = req.body.printingTechniques;
      if (req.body.active !== undefined) updates.active = req.body.active;
      if (req.body.zones !== undefined) updates.zones = req.body.zones;
      if (req.body.variants !== undefined) updates.variants = req.body.variants;
      if (req.body.variantLabel !== undefined) updates.variantLabel = req.body.variantLabel;

      const [product] = await db.update(products).set(updates).where(eq(products.id, req.params.id)).returning();
      if (!product) return reply.code(404).send({ error: 'Product not found', code: 'PRODUCT_NOT_FOUND' });
      return product;
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/api/v1/products/:id',
    {
      schema: {
        tags: ['Products'],
        summary: 'Delete a product',
        params: uuidIdParamSchema,
        response: { 200: successResponseSchema, 404: errorResponseSchema },
      },
    },
    async (req, reply) => {
      const [product] = await db.delete(products).where(eq(products.id, req.params.id)).returning();
      if (!product) return reply.code(404).send({ error: 'Product not found', code: 'PRODUCT_NOT_FOUND' });
      return { success: true };
    },
  );
}
