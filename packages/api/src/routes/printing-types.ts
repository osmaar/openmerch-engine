import type { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import { printingTypes } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { errorResponseSchema, successResponseSchema, uuidIdParamSchema } from '../schemas/common.js';

const printingTypeSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    title: { type: 'string' },
    description: { type: ['string', 'null'] },
    thumbnailUrl: { type: ['string', 'null'] },
    active: { type: 'boolean' },
    calculationMethod: { type: 'string', description: 'Pricing calculation strategy, e.g. "elements"' },
    pricingConfig: { type: 'object', additionalProperties: true },
    resourcePermissions: { type: 'object', additionalProperties: true },
    layoutConfig: { type: 'object', additionalProperties: true },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
  required: ['id', 'title', 'active', 'calculationMethod', 'pricingConfig', 'resourcePermissions', 'layoutConfig', 'createdAt', 'updatedAt'],
} as const;

const createPrintingTypeBodySchema = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    description: { type: 'string' },
    thumbnailUrl: { type: 'string' },
    active: { type: 'boolean' },
    calculationMethod: { type: 'string' },
    pricingConfig: { type: 'object', additionalProperties: true },
    resourcePermissions: { type: 'object', additionalProperties: true },
    layoutConfig: { type: 'object', additionalProperties: true },
  },
  required: ['title'],
} as const;

const updatePrintingTypeBodySchema = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    description: { type: 'string' },
    thumbnailUrl: { type: 'string' },
    active: { type: 'boolean' },
    calculationMethod: { type: 'string' },
    pricingConfig: { type: 'object', additionalProperties: true },
    resourcePermissions: { type: 'object', additionalProperties: true },
    layoutConfig: { type: 'object', additionalProperties: true },
  },
} as const;

export async function printingTypeRoutes(app: FastifyInstance) {
  app.get(
    '/api/v1/printing-types',
    {
      schema: {
        tags: ['PrintingTypes'],
        summary: 'List all printing types',
        response: { 200: { type: 'array', items: printingTypeSchema } },
      },
    },
    async () => {
      return db.select().from(printingTypes);
    },
  );

  app.post<{ Body: { title: string; description?: string; thumbnailUrl?: string; active?: boolean; calculationMethod?: string; pricingConfig?: unknown; resourcePermissions?: unknown; layoutConfig?: unknown } }>(
    '/api/v1/printing-types',
    {
      schema: {
        tags: ['PrintingTypes'],
        summary: 'Create a printing type',
        body: createPrintingTypeBodySchema,
        response: { 200: printingTypeSchema },
      },
    },
    async (req) => {
      const [item] = await db.insert(printingTypes).values({
        title: req.body.title,
        description: req.body.description ?? null,
        thumbnailUrl: req.body.thumbnailUrl ?? null,
        active: req.body.active ?? true,
        calculationMethod: req.body.calculationMethod ?? 'elements',
        pricingConfig: JSON.stringify(req.body.pricingConfig ?? {}),
        resourcePermissions: JSON.stringify(req.body.resourcePermissions ?? {}),
        layoutConfig: JSON.stringify(req.body.layoutConfig ?? {}),
      }).returning();
      return item;
    },
  );

  app.put<{ Params: { id: string }; Body: { title?: string; description?: string; thumbnailUrl?: string; active?: boolean; calculationMethod?: string; pricingConfig?: unknown; resourcePermissions?: unknown; layoutConfig?: unknown } }>(
    '/api/v1/printing-types/:id',
    {
      schema: {
        tags: ['PrintingTypes'],
        summary: 'Update a printing type',
        params: uuidIdParamSchema,
        body: updatePrintingTypeBodySchema,
        response: { 200: printingTypeSchema, 404: errorResponseSchema },
      },
    },
    async (req, reply) => {
      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (req.body.title !== undefined) updates.title = req.body.title;
      if (req.body.description !== undefined) updates.description = req.body.description;
      if (req.body.thumbnailUrl !== undefined) updates.thumbnailUrl = req.body.thumbnailUrl;
      if (req.body.active !== undefined) updates.active = req.body.active;
      if (req.body.calculationMethod !== undefined) updates.calculationMethod = req.body.calculationMethod;
      if (req.body.pricingConfig !== undefined) updates.pricingConfig = JSON.stringify(req.body.pricingConfig);
      if (req.body.resourcePermissions !== undefined) updates.resourcePermissions = JSON.stringify(req.body.resourcePermissions);
      if (req.body.layoutConfig !== undefined) updates.layoutConfig = JSON.stringify(req.body.layoutConfig);
      const [item] = await db.update(printingTypes).set(updates).where(eq(printingTypes.id, req.params.id)).returning();
      if (!item) return reply.code(404).send({ error: 'Printing type not found', code: 'NOT_FOUND' });
      return item;
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/api/v1/printing-types/:id',
    {
      schema: {
        tags: ['PrintingTypes'],
        summary: 'Delete a printing type',
        params: uuidIdParamSchema,
        response: { 200: successResponseSchema, 404: errorResponseSchema },
      },
    },
    async (req, reply) => {
      const [item] = await db.delete(printingTypes).where(eq(printingTypes.id, req.params.id)).returning();
      if (!item) return reply.code(404).send({ error: 'Printing type not found', code: 'NOT_FOUND' });
      return { success: true };
    },
  );
}
