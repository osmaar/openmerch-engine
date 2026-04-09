import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { config } from './config.js';
import { healthRoutes } from './routes/health.js';
import { productRoutes } from './routes/products.js';
import { designRoutes } from './routes/designs.js';
import { assetRoutes } from './routes/assets.js';
import { templateRoutes } from './routes/templates.js';
import { clipartRoutes } from './routes/cliparts.js';
import { shapeRoutes } from './routes/shapes.js';
import { fontRoutes } from './routes/fonts.js';
import { printingTypeRoutes } from './routes/printing-types.js';
import { orderRoutes } from './routes/orders.js';
import { languageRoutes } from './routes/languages.js';
import { settingRoutes } from './routes/settings.js';

async function main() {
  const app = Fastify({
    logger: {
      transport: {
        target: 'pino-pretty',
        options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
      },
    },
    // Design payloads include the full designData JSON (layers, image URLs, etc.)
    // which can grow well beyond Fastify's 1 MB default.
    bodyLimit: 10 * 1024 * 1024, // 10 MB
  });

  // Plugins
  await app.register(cors, { origin: config.corsOrigin, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'] });
  await app.register(multipart, { limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB max

  // Routes
  await app.register(healthRoutes);
  await app.register(productRoutes);
  await app.register(designRoutes);
  await app.register(assetRoutes);
  await app.register(templateRoutes);
  await app.register(clipartRoutes);
  await app.register(shapeRoutes);
  await app.register(fontRoutes);
  await app.register(printingTypeRoutes);
  await app.register(orderRoutes);
  await app.register(languageRoutes);
  await app.register(settingRoutes);

  // Start
  try {
    await app.listen({ port: config.port, host: config.host });
    console.log(`\n  🚀 OpenMerch API running at http://localhost:${config.port}`);
    console.log(`  📋 Health check: http://localhost:${config.port}/api/v1/health`);
    console.log(`  📦 Endpoints: /api/v1/{products,designs,assets,templates,cliparts,shapes,fonts,printing-types,orders,languages,settings}\n`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
