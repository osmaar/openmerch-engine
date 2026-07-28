import { join, dirname } from 'path';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import Fastify, { type FastifyError } from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { config } from './config.js';
import { assertEncryptionKeyConfigured } from './utils/crypto.js';
import { closeDb } from './db/index.js';
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
  assertEncryptionKeyConfigured();

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

  if (config.corsOrigin === '*') {
    app.log.warn(
      '[cors] CORS_ORIGIN is "*" — any website can call this API from a browser. ' +
        'The API has no auth, so this is a CSRF drive-by risk. Set CORS_ORIGIN to your frontend origin(s) instead.',
    );
  }

  // Plugins
  await app.register(cors, { origin: config.corsOrigin, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'] });
  await app.register(multipart, { limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB max

  app.setErrorHandler((err: FastifyError, _req, reply) => {
    app.log.error(err);

    const statusCode = err.statusCode ?? 500;
    const isValidationError = Boolean(err.validation);
    const isProduction = process.env.NODE_ENV === 'production';

    // Validation errors are always safe to surface (they describe the client's
    // own malformed input). Everything else — Postgres constraint violations,
    // Drizzle errors, etc. — leaks driver internals, so it's hidden in prod.
    const message = isValidationError || !isProduction ? err.message : 'Internal server error';

    reply.status(statusCode).send({ error: message, code: err.code ?? 'INTERNAL_SERVER_ERROR' });
  });

  const packageDir = join(dirname(fileURLToPath(import.meta.url)), '..');
  const { version: apiVersion } = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf-8')) as { version: string };

  await app.register(swagger, {
    openapi: {
      openapi: '3.0.0',
      info: {
        title: 'OpenMerch Engine API',
        version: apiVersion,
        description: 'REST API for OpenMerch Engine: product configuration, design persistence, asset storage and production file generation.',
      },
      servers: [{ url: `http://localhost:${config.port}`, description: 'Local server' }],
      tags: [
        { name: 'Health', description: 'Service status' },
        { name: 'Products', description: 'Product catalog and print zones' },
        { name: 'Designs', description: 'Customer design persistence and production file generation' },
        { name: 'Assets', description: 'File upload and storage' },
        { name: 'Templates', description: 'Reusable design templates' },
        { name: 'Cliparts', description: 'Clipart library' },
        { name: 'Shapes', description: 'Vector shape library' },
        { name: 'Fonts', description: 'Font library' },
        { name: 'PrintingTypes', description: 'Printing technique configuration and pricing' },
        { name: 'Orders', description: 'Customer orders' },
        { name: 'Languages', description: 'Languages and UI translations' },
        { name: 'Settings', description: 'API keys, branding config and third-party proxies' },
      ],
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/api/v1/docs',
  });

  // Serve product mockup images from the repo's products/ directory
  const repoRoot = join(packageDir, '..', '..');
  await app.register(fastifyStatic, {
    root: join(repoRoot, 'products'),
    prefix: '/products/',
    decorateReply: false,
  });

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
    console.log(`  📚 API docs: http://localhost:${config.port}/api/v1/docs`);
    console.log(`  📦 Endpoints: /api/v1/{products,designs,assets,templates,cliparts,shapes,fonts,printing-types,orders,languages,settings}\n`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  async function shutdown(signal: string) {
    console.log(`\n[api] received ${signal}, draining...`);
    try {
      await app.close();
      await closeDb();
      console.log('[api] shutdown complete');
      process.exit(0);
    } catch (err) {
      console.error('[api] error during shutdown:', err);
      process.exit(1);
    }
  }

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main();
