import type { FastifyInstance, FastifyRequest } from 'fastify';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { db } from '../db/index.js';
import { orders, orderDesigns, designs, webhookDeliveries } from '../db/schema.js';
import { eq, and, or, isNull, notInArray, sql, desc } from 'drizzle-orm';
import { enqueueProductionFiles } from '../jobs/queues.js';
import { config } from '../config.js';
import { errorResponseSchema } from '../schemas/common.js';

/**
 * WooCommerce order statuses that mean "payment confirmed" — the trigger for
 * enqueuing production file generation. WooCommerce's default flow moves an
 * order to "processing" once payment clears (or straight to "completed" for
 * some manual/free flows).
 */
const PAID_STATUSES = new Set(['processing', 'completed']);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A request augmented by this route's raw-body content type parser (see below). */
type RequestWithRawBody = FastifyRequest & { rawBody: Buffer };

interface WooMetaDatum {
  key?: string;
  value?: unknown;
}

interface WooLineItem {
  name?: string;
  meta_data?: WooMetaDatum[];
}

interface WooOrderPayload {
  id?: number | string;
  order_id?: number | string;
  status?: string;
  total?: string | number;
  currency?: string;
  billing?: { first_name?: string; last_name?: string; email?: string };
  line_items?: WooLineItem[];
}

interface DesignLineItemMatch {
  item: WooLineItem;
  designKey: string;
  /** All meta_data entries for this line item, keyed for easy lookup (_design_url, etc). */
  meta: Record<string, unknown>;
}

/**
 * Finds every line item carrying a `_design_key` meta entry — i.e. every customized
 * product on the order. An order can have more than one (a customer buying two
 * different custom-designed products in the same checkout), so this returns all of
 * them rather than stopping at the first match.
 */
function findDesignLineItems(lineItems: WooLineItem[] | undefined): DesignLineItemMatch[] {
  if (!Array.isArray(lineItems)) return [];
  const matches: DesignLineItemMatch[] = [];
  for (const item of lineItems) {
    const metaEntries = Array.isArray(item.meta_data) ? item.meta_data : [];
    const meta: Record<string, unknown> = {};
    for (const entry of metaEntries) {
      if (entry.key) meta[entry.key] = entry.value;
    }
    const designKey = meta['_design_key'];
    if (typeof designKey === 'string' && designKey) {
      matches.push({ item, designKey, meta });
    }
  }
  return matches;
}

function resolveCustomerName(payload: WooOrderPayload): string {
  const first = payload.billing?.first_name?.trim();
  const last = payload.billing?.last_name?.trim();
  const full = [first, last].filter(Boolean).join(' ').trim();
  return full || payload.billing?.email || 'WooCommerce Customer';
}

/** WooCommerce reports `total` as a decimal-string in major currency units; `orders.total` is integer cents. */
function resolveTotalCents(total: string | number | undefined): number {
  const n = typeof total === 'string' ? Number.parseFloat(total) : total;
  if (typeof n !== 'number' || !Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

/** WooCommerce's webhook payload always carries a top-level `currency` (e.g. "USD", "MXN") — confirmed empirically against a real delivery. Falls back to USD for payloads that somehow omit it (e.g. a hand-crafted test). */
function resolveCurrency(currency: string | undefined): string {
  return typeof currency === 'string' && currency.trim() ? currency.trim().toUpperCase() : 'USD';
}

/**
 * Confirms `candidate` is both a syntactically valid UUID and an existing
 * `designs` row, returning the row (so callers avoid a second lookup when
 * they also need designData/productColor/productionStatus for the
 * production-enqueue step below). Never throws — an invalid/unknown design
 * reference must not fail the whole webhook, per the order-creation flow.
 */
async function resolveDesign(candidate: string): Promise<typeof designs.$inferSelect | null> {
  if (!UUID_RE.test(candidate)) return null;
  try {
    const [row] = await db.select().from(designs).where(eq(designs.id, candidate));
    return row ?? null;
  } catch {
    return null;
  }
}

/**
 * Enqueues production file generation for `design`, mirroring the atomic
 * claim used by `POST /api/v1/designs/:id/generate-files`: only flips
 * productionStatus to "queued" if the row isn't already queued/processing,
 * so a WooCommerce retry of the same webhook (or a webhook that fires twice
 * for the same order) never double-enqueues.
 */
async function triggerProductionIfNeeded(design: typeof designs.$inferSelect, app: FastifyInstance): Promise<void> {
  if (design.productionStatus === 'queued' || design.productionStatus === 'processing') return;

  try {
    const [claimed] = await db
      .update(designs)
      .set({ productionStatus: 'queued', productionError: null, updatedAt: new Date() })
      .where(
        and(
          eq(designs.id, design.id),
          or(isNull(designs.productionStatus), notInArray(designs.productionStatus, ['queued', 'processing'])),
        ),
      )
      .returning();

    if (!claimed) return; // lost the race to another trigger — fine, it's already in flight

    await enqueueProductionFiles(claimed.id, claimed.designData, claimed.productColor);
  } catch (err) {
    // Enqueueing (e.g. Redis unreachable) must not fail the webhook ack — WooCommerce would
    // otherwise retry indefinitely. The order row is already persisted; production can be
    // retried later via the manual generate-files endpoint.
    app.log.error(err, '[orders-webhook-woocommerce] failed to enqueue production files');
  }
}

/**
 * Records every inbound delivery attempt (accepted or rejected) so the admin panel can show
 * "a delivery came in and was rejected" — something WooCommerce itself never surfaces to
 * anyone on the OpenMerch side (its own delivery log lives in wp-admin, which self-hosted
 * operators may never think to check). Never throws: a logging failure must not turn a
 * successfully-processed webhook into a failed one.
 */
async function logWebhookDelivery(
  app: FastifyInstance,
  success: boolean,
  reasonCode: string,
  orderId: string | null,
): Promise<void> {
  try {
    await db.insert(webhookDeliveries).values({ source: 'woocommerce', success, reasonCode, orderId });
  } catch (err) {
    app.log.error(err, '[orders-webhook-woocommerce] failed to record delivery log entry');
  }
}

export async function orderWebhookWooCommerceRoutes(app: FastifyInstance) {
  // WooCommerce signs the *raw* request body, so JSON must be captured as a buffer before
  // parsing — the default JSON parser discards the original bytes. Scoped to this plugin's
  // encapsulation context only: it does not affect JSON parsing anywhere else in the app.
  app.addContentTypeParser('application/json', { parseAs: 'buffer' }, (req, body, done) => {
    const buf = body as Buffer;
    (req as RequestWithRawBody).rawBody = buf;
    if (buf.length === 0) {
      done(null, {});
      return;
    }
    try {
      done(null, JSON.parse(buf.toString('utf8')));
    } catch (err) {
      done(err as Error, undefined);
    }
  });

  app.post<{ Body: WooOrderPayload }>(
    '/api/v1/orders/webhook/woocommerce',
    {
      schema: {
        tags: ['Orders'],
        summary: 'WooCommerce order webhook',
        description:
          'Receives the native WooCommerce order webhook (topic order.updated / order.status_changed). ' +
          'Verifies the X-WC-Webhook-Signature HMAC-SHA256 header against WOOCOMMERCE_WEBHOOK_SECRET, then ' +
          'upserts an `orders` row keyed by the WooCommerce order id (idempotent — safe for WooCommerce\'s ' +
          'built-in retries). Line items are expected to carry `_design_key` (the OpenMerch design UUID) and, ' +
          'optionally, `_design_url`/`_design_filename`/`_design_dimensions` in their meta_data, as attached by ' +
          'the WooCommerce plugin when the customized product was added to the cart. Orders with no `_design_key` ' +
          'on any line item are not customized products and are acknowledged as a no-op. When a valid design is ' +
          'found and the order status indicates payment was confirmed ("processing" or "completed"), production ' +
          'file generation is enqueued the same way `POST /api/v1/designs/:id/generate-files` does.',
        body: { type: 'object', additionalProperties: true },
        response: {
          200: {
            type: 'object',
            properties: { received: { type: 'boolean' } },
            required: ['received'],
          },
          401: errorResponseSchema,
          503: errorResponseSchema,
        },
      },
    },
    async (req, reply) => {
      if (!config.woocommerce.webhookSecret) {
        await logWebhookDelivery(app, false, 'NOT_CONFIGURED', null);
        return reply.code(503).send({
          error: 'WooCommerce webhook not configured (WOOCOMMERCE_WEBHOOK_SECRET unset)',
          code: 'WOOCOMMERCE_NOT_CONFIGURED',
        });
      }

      const signatureHeader = req.headers['x-wc-webhook-signature'];
      const rawBody = (req as RequestWithRawBody).rawBody ?? Buffer.alloc(0);
      const expected = createHmac('sha256', config.woocommerce.webhookSecret).update(rawBody).digest();

      let signatureValid = false;
      if (typeof signatureHeader === 'string' && signatureHeader) {
        try {
          const received = Buffer.from(signatureHeader, 'base64');
          signatureValid = received.length === expected.length && timingSafeEqual(received, expected);
        } catch {
          signatureValid = false;
        }
      }

      if (!signatureValid) {
        const attemptedOrderId = String(req.body?.id ?? req.body?.order_id ?? '').trim() || null;
        await logWebhookDelivery(app, false, 'INVALID_SIGNATURE', attemptedOrderId);
        return reply.code(401).send({ error: 'Invalid webhook signature', code: 'INVALID_SIGNATURE' });
      }

      const payload = req.body;
      const orderId = String(payload.id ?? payload.order_id ?? '').trim();
      const matches = findDesignLineItems(payload.line_items);

      // Not a customized-product order (or a WooCommerce webhook "ping" test delivery, which
      // has no line_items at all) — nothing for us to do, but still acknowledge it.
      if (matches.length === 0 || !orderId) {
        await logWebhookDelivery(app, true, 'NO_DESIGN_LINE_ITEMS', orderId || null);
        return { received: true };
      }

      const status = typeof payload.status === 'string' && payload.status ? payload.status : 'pending';

      const [order] = await db
        .insert(orders)
        .values({
          orderId,
          customerName: resolveCustomerName(payload),
          status,
          total: resolveTotalCents(payload.total),
          currency: resolveCurrency(payload.currency),
        })
        .onConflictDoUpdate({
          target: orders.orderId,
          set: {
            customerName: resolveCustomerName(payload),
            status,
            total: resolveTotalCents(payload.total),
            currency: resolveCurrency(payload.currency),
            updatedAt: new Date(),
          },
        })
        .returning();

      // onConflictDoUpdate's .returning() is typed as possibly empty even though this
      // specific insert-or-update always affects exactly one row.
      if (!order) {
        return { received: true };
      }

      // One line item's design failing to resolve, or its production enqueue throwing,
      // must not stop the rest of the order's line items from being recorded/enqueued.
      for (const match of matches) {
        const design = await resolveDesign(match.designKey);

        const [lineItem] = await db
          .insert(orderDesigns)
          .values({
            orderId: order.id,
            designId: design?.id ?? null,
            designKey: match.designKey,
            productName: match.item.name ?? 'Custom product',
            designUrl: typeof match.meta['_design_url'] === 'string' ? match.meta['_design_url'] : null,
            designFilename: typeof match.meta['_design_filename'] === 'string' ? match.meta['_design_filename'] : null,
            designDimensions: typeof match.meta['_design_dimensions'] === 'string' ? match.meta['_design_dimensions'] : null,
          })
          .onConflictDoUpdate({
            target: [orderDesigns.orderId, orderDesigns.designKey],
            set: {
              productName: match.item.name ?? 'Custom product',
              // Never clobber a previously-resolved designId with null on a later webhook
              // delivery that (for whatever reason) failed to resolve it again.
              designId: design?.id ?? sql`${orderDesigns.designId}`,
            },
          })
          .returning();

        if (lineItem?.designId && PAID_STATUSES.has(status)) {
          const designRow = design ?? (await resolveDesign(lineItem.designId));
          if (designRow) await triggerProductionIfNeeded(designRow, app);
        }
      }

      // Drops any order_designs row whose line item is no longer on the order — e.g. an
      // admin edited the order in wp-admin and removed a customized item. Without this, a
      // removed line item's row would sit forever pointing at a design that's no longer
      // actually part of the order. Scoped to orders that still have at least one design
      // line item (the `matches.length === 0` guard above already short-circuits orders
      // with none left, before ever reaching here).
      await db.delete(orderDesigns).where(
        and(
          eq(orderDesigns.orderId, order.id),
          notInArray(orderDesigns.designKey, matches.map((m) => m.designKey)),
        ),
      );

      await logWebhookDelivery(app, true, 'PROCESSED', orderId);
      return { received: true };
    },
  );

  app.get(
    '/api/v1/orders/webhook/woocommerce/log',
    {
      schema: {
        tags: ['Orders'],
        summary: 'Recent WooCommerce webhook delivery attempts',
        description:
          'Every inbound request to the WooCommerce webhook endpoint, accepted or rejected — surfaces ' +
          'failures (bad signature, endpoint not configured) that WooCommerce itself never reports to the ' +
          'OpenMerch side. Most recent first, capped at 50.',
        response: {
          200: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                success: { type: 'boolean' },
                reasonCode: { type: 'string' },
                orderId: { type: ['string', 'null'] },
                createdAt: { type: 'string', format: 'date-time' },
              },
              required: ['id', 'success', 'reasonCode', 'orderId', 'createdAt'],
            },
          },
        },
      },
    },
    async () =>
      db
        .select({
          id: webhookDeliveries.id,
          success: webhookDeliveries.success,
          reasonCode: webhookDeliveries.reasonCode,
          orderId: webhookDeliveries.orderId,
          createdAt: webhookDeliveries.createdAt,
        })
        .from(webhookDeliveries)
        .where(eq(webhookDeliveries.source, 'woocommerce'))
        .orderBy(desc(webhookDeliveries.createdAt))
        .limit(50),
  );
}
