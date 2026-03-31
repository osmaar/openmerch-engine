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
  app.post<{ Body: { name: string; slug: string; zones: unknown[] } }>('/api/v1/products', async (req) => {
    const [product] = await db.insert(products).values({
      name: req.body.name,
      slug: req.body.slug,
      zones: JSON.stringify(req.body.zones),
    }).returning();
    return product;
  });
}
