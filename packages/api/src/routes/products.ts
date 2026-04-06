import type { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import { products } from '../db/schema.js';
import { eq } from 'drizzle-orm';

export async function productRoutes(app: FastifyInstance) {
  // GET /api/v1/products
  app.get('/api/v1/products', async () => {
    return db.select().from(products);
  });

  // GET /api/v1/products/:id
  app.get<{ Params: { id: string } }>('/api/v1/products/:id', async (req, reply) => {
    const [product] = await db.select().from(products).where(eq(products.id, req.params.id));
    if (!product) return reply.code(404).send({ error: 'Product not found', code: 'PRODUCT_NOT_FOUND' });
    return product;
  });

  // POST /api/v1/products
  app.post<{ Body: { name: string; slug: string; description?: string; price?: number; categories?: string[]; printingTechniques?: string[]; active?: boolean; zones: unknown[] } }>('/api/v1/products', async (req) => {
    const [product] = await db.insert(products).values({
      name: req.body.name,
      slug: req.body.slug,
      description: req.body.description ?? null,
      price: req.body.price ?? 0,
      categories: JSON.stringify(req.body.categories ?? []),
      printingTechniques: JSON.stringify(req.body.printingTechniques ?? []),
      active: req.body.active ?? true,
      zones: JSON.stringify(req.body.zones),
    }).returning();
    return product;
  });

  // PUT /api/v1/products/:id
  app.put<{ Params: { id: string }; Body: { name?: string; slug?: string; description?: string; price?: number; categories?: string[]; printingTechniques?: string[]; active?: boolean; zones?: unknown[] } }>(
    '/api/v1/products/:id',
    async (req, reply) => {
      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (req.body.name !== undefined) updates.name = req.body.name;
      if (req.body.slug !== undefined) updates.slug = req.body.slug;
      if (req.body.description !== undefined) updates.description = req.body.description;
      if (req.body.price !== undefined) updates.price = req.body.price;
      if (req.body.categories !== undefined) updates.categories = JSON.stringify(req.body.categories);
      if (req.body.printingTechniques !== undefined) updates.printingTechniques = JSON.stringify(req.body.printingTechniques);
      if (req.body.active !== undefined) updates.active = req.body.active;
      if (req.body.zones !== undefined) updates.zones = JSON.stringify(req.body.zones);

      const [product] = await db.update(products).set(updates).where(eq(products.id, req.params.id)).returning();
      if (!product) return reply.code(404).send({ error: 'Product not found', code: 'PRODUCT_NOT_FOUND' });
      return product;
    },
  );

  // DELETE /api/v1/products/:id
  app.delete<{ Params: { id: string } }>('/api/v1/products/:id', async (req, reply) => {
    const [product] = await db.delete(products).where(eq(products.id, req.params.id)).returning();
    if (!product) return reply.code(404).send({ error: 'Product not found', code: 'PRODUCT_NOT_FOUND' });
    return { success: true };
  });
}
