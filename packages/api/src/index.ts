import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { config } from './config.js';
import { healthRoutes } from './routes/health.js';
import { productRoutes } from './routes/products.js';
import { designRoutes } from './routes/designs.js';
import { assetRoutes } from './routes/assets.js';

async function main() {
  const app = Fastify({
    logger: {
      transport: {
        target: 'pino-pretty',
        options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
      },
    },
  });

  // Plugins
  await app.register(cors, { origin: config.corsOrigin });
  await app.register(multipart, { limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB max

  // Routes
  await app.register(healthRoutes);
  await app.register(productRoutes);
  await app.register(designRoutes);
  await app.register(assetRoutes);

  // Start
  try {
    await app.listen({ port: config.port, host: config.host });
    console.log(`\n  🚀 OpenMerch API running at http://localhost:${config.port}`);
    console.log(`  📋 Health check: http://localhost:${config.port}/api/v1/health`);
    console.log(`  📦 Endpoints: /api/v1/products, /api/v1/designs, /api/v1/assets\n`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
