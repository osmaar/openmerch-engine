import { Worker } from 'bullmq';
import type { Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import { renderDesignZone, renderDesignZoneMockup } from '@openmerch/renderer';
import type { Design, DesignLayer, DesignZone, ProductVariant, ProductZone } from '@openmerch/core';
import { db } from '../../db/index.js';
import { designs, products } from '../../db/schema.js';
import { minioClient, ensureBucket } from '../../storage/minio.js';
import { config } from '../../config.js';
import { ImageResolver } from '../resolvers/image-resolver.js';
import { FontResolver } from '../resolvers/font-resolver.js';
import { redisConnection } from '../connection.js';
import {
  PRODUCTION_FILES_QUEUE,
  type ProductionFilesJobData,
  type ProductionFilesJobResult,
  type ProductionZoneFiles,
} from '../queues.js';
import { decideProductionOutcome, resolveRenderZone } from './production-files.logic.js';

async function processJob(
  job: Job<ProductionFilesJobData>,
): Promise<ProductionFilesJobResult> {
  const { designId } = job.data;
  job.log(`Starting render for design ${designId}`);

  // Mark design as processing.
  await db
    .update(designs)
    .set({ productionStatus: 'processing', productionError: null, updatedAt: new Date() })
    .where(eq(designs.id, designId));

  // Load the design and its product (we need the product zones for print area dimensions).
  const [design] = await db.select().from(designs).where(eq(designs.id, designId));
  if (!design) throw new Error(`Design ${designId} not found`);

  const [product] = await db.select().from(products).where(eq(products.id, design.productId));
  if (!product) throw new Error(`Product ${design.productId} not found`);

  const productZones = (product.zones as ProductZone[]) ?? [];
  if (productZones.length === 0) throw new Error(`Product ${product.id} has no zones`);

  const designData = design.designData as Design;
  const designZones = designData.zones ?? {};

  await ensureBucket();

  // One resolver pair per job — caches buffers/font paths across zones so the
  // same src isn't fetched twice when used in front and back.
  const imageResolver = new ImageResolver();
  const fontResolver = new FontResolver();

  // Render TWO PNGs per product zone with per-zone error isolation:
  //   - print: bare design @ 300 DPI on transparent background, ready for the printer
  //   - mockup: low-res visual reference with the design composited on the
  //             product base image, so the merchant sees what they're shipping
  //
  // If "front" succeeds and "back" fails, we still ship the front files and
  // report the back error. Mockup failures don't fail the zone — the print
  // file is the contractual output, the mockup is "nice to have".
  const files: Record<string, ProductionZoneFiles> = {};
  const zoneErrors: string[] = [];
  const variants = (product.variants as ProductVariant[]) ?? [];

  for (const productZone of productZones) {
    const designZone: DesignZone | undefined = designZones[productZone.id];
    const layers: DesignLayer[] = designZone?.layers ?? [];

    // Skip zones with no design — no layers means nothing to render or print.
    if (layers.length === 0) {
      job.log(`Skipping zone "${productZone.id}" — no layers`);
      continue;
    }

    const { zone: renderZone, matchedVariantId } = resolveRenderZone(productZone, designZone, variants);
    if (matchedVariantId) {
      job.log(`Using variant "${matchedVariantId}" zones for "${productZone.id}"`);
    }

    job.log(`Rendering zone "${productZone.id}" (${layers.length} layer(s))`);

    try {
      // 1. Print file (the contract): bare design at 300 DPI.
      const printResult = await renderDesignZone({
        zone: renderZone,
        layers,
        dpi: 300,
        resolveImage: (src) => imageResolver.resolve(src),
        resolveFont: (family) => fontResolver.resolve(family),
        resolveFontById: (id) => fontResolver.resolveById(id),
      });

      const printKey = `production/${designId}/${productZone.id}.png`;
      await minioClient.putObject(
        config.minio.bucket,
        printKey,
        printResult.buffer,
        printResult.buffer.length,
        { 'Content-Type': 'image/png' },
      );

      const zoneFiles: ProductionZoneFiles = {
        print: `/api/v1/assets/${printKey}`,
      };

      // 2. Mockup preview (the merchant reference): design over product base.
      //    Best-effort — if it fails we still keep the print file.
      try {
        const mockupResult = await renderDesignZoneMockup({
          zone: renderZone,
          layers,
          dpi: 96,
          resolveImage: (src) => imageResolver.resolve(src),
          resolveFont: (family) => fontResolver.resolve(family),
          resolveFontById: (id) => fontResolver.resolveById(id),
          productColor: design.productColor ?? undefined,
        });
        const mockupKey = `production/${designId}/${productZone.id}-mockup.png`;
        await minioClient.putObject(
          config.minio.bucket,
          mockupKey,
          mockupResult.buffer,
          mockupResult.buffer.length,
          { 'Content-Type': 'image/png' },
        );
        zoneFiles.mockup = `/api/v1/assets/${mockupKey}`;
      } catch (mockupErr) {
        job.log(`⚠ mockup for zone "${productZone.id}" failed: ${(mockupErr as Error).message}`);
      }

      files[productZone.id] = zoneFiles;
    } catch (err) {
      const message = (err as Error).message;
      zoneErrors.push(`${productZone.id}: ${message}`);
      job.log(`✗ zone "${productZone.id}" failed: ${message}`);
    }
  }

  // Decide final state:
  //   - all zones succeeded → completed
  //   - some succeeded, some failed → completed with productionError describing the partial failures
  //   - all zones failed → throw, BullMQ will retry then mark failed
  const outcome = decideProductionOutcome(files, zoneErrors);
  if (outcome.status === 'failed') {
    throw new Error(outcome.productionError ?? 'All zones failed');
  }

  await db
    .update(designs)
    .set({
      productionStatus: outcome.status,
      productionFiles: files,
      productionError: outcome.productionError,
      updatedAt: new Date(),
    })
    .where(eq(designs.id, designId));

  job.log(
    `Render complete for design ${designId}: ${Object.keys(files).length}/${productZones.length} file(s)` +
      (zoneErrors.length > 0 ? ` (${zoneErrors.length} zone(s) failed)` : ''),
  );
  return { designId, files };
}

export function startProductionFilesWorker(): Worker {
  const worker = new Worker<ProductionFilesJobData, ProductionFilesJobResult>(
    PRODUCTION_FILES_QUEUE,
    processJob,
    {
      connection: redisConnection,
      concurrency: 2,
      lockDuration: 60_000,
    },
  );

  worker.on('completed', (job) => {
    console.log(`[worker] ✓ job ${job.id} completed for design ${job.data.designId}`);
  });

  worker.on('failed', async (job, err) => {
    console.error(`[worker] ✗ job ${job?.id} failed:`, err.message);
    if (job?.data.designId && job.attemptsMade >= (job.opts.attempts ?? 1)) {
      // Final failure: persist error on the design.
      await db
        .update(designs)
        .set({
          productionStatus: 'failed',
          productionError: err.message,
          updatedAt: new Date(),
        })
        .where(eq(designs.id, job.data.designId));
    }
  });

  worker.on('error', (err) => {
    console.error('[worker] error:', err);
  });

  return worker;
}
