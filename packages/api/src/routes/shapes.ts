import type { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import { shapes } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { errorResponseSchema, successResponseSchema, uuidIdParamSchema } from '../schemas/common.js';
import { sanitizeSvg } from '../utils/sanitizeSvg.js';

const shapeSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    name: { type: 'string' },
    svgContent: { type: 'string' },
    sortOrder: { type: 'integer' },
    active: { type: 'boolean' },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
  required: ['id', 'name', 'svgContent', 'sortOrder', 'active', 'createdAt', 'updatedAt'],
} as const;

const createShapeBodySchema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    svgContent: { type: 'string' },
    sortOrder: { type: 'integer' },
    active: { type: 'boolean' },
  },
  required: ['name'],
} as const;

const updateShapeBodySchema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    svgContent: { type: 'string' },
    sortOrder: { type: 'integer' },
    active: { type: 'boolean' },
  },
} as const;

export async function shapeRoutes(app: FastifyInstance) {
  app.get(
    '/api/v1/shapes',
    {
      schema: {
        tags: ['Shapes'],
        summary: 'List all shapes',
        response: { 200: { type: 'array', items: shapeSchema } },
      },
    },
    async () => {
      return db.select().from(shapes);
    },
  );

  app.post<{ Body: { name: string; svgContent?: string; sortOrder?: number; active?: boolean } }>(
    '/api/v1/shapes',
    {
      schema: {
        tags: ['Shapes'],
        summary: 'Create a shape',
        body: createShapeBodySchema,
        response: { 200: shapeSchema },
      },
    },
    async (req) => {
      const [item] = await db.insert(shapes).values({
        name: req.body.name,
        svgContent: sanitizeSvg(req.body.svgContent ?? ''),
        sortOrder: req.body.sortOrder ?? 0,
        active: req.body.active ?? true,
      }).returning();
      return item;
    },
  );

  app.put<{ Params: { id: string }; Body: { name?: string; svgContent?: string; sortOrder?: number; active?: boolean } }>(
    '/api/v1/shapes/:id',
    {
      schema: {
        tags: ['Shapes'],
        summary: 'Update a shape',
        params: uuidIdParamSchema,
        body: updateShapeBodySchema,
        response: { 200: shapeSchema, 404: errorResponseSchema },
      },
    },
    async (req, reply) => {
      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (req.body.name !== undefined) updates.name = req.body.name;
      if (req.body.svgContent !== undefined) updates.svgContent = sanitizeSvg(req.body.svgContent);
      if (req.body.sortOrder !== undefined) updates.sortOrder = req.body.sortOrder;
      if (req.body.active !== undefined) updates.active = req.body.active;
      const [item] = await db.update(shapes).set(updates).where(eq(shapes.id, req.params.id)).returning();
      if (!item) return reply.code(404).send({ error: 'Shape not found', code: 'NOT_FOUND' });
      return item;
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/api/v1/shapes/:id',
    {
      schema: {
        tags: ['Shapes'],
        summary: 'Delete a shape',
        params: uuidIdParamSchema,
        response: { 200: successResponseSchema, 404: errorResponseSchema },
      },
    },
    async (req, reply) => {
      const [item] = await db.delete(shapes).where(eq(shapes.id, req.params.id)).returning();
      if (!item) return reply.code(404).send({ error: 'Shape not found', code: 'NOT_FOUND' });
      return { success: true };
    },
  );
}
