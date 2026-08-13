import { randomUUID, createHmac } from 'node:crypto';
import Fastify from 'fastify';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { orderDesigns, webhookDeliveries } from '../db/schema.js';

type FakeRow = Record<string, unknown>;

const selectDesignMock = vi.fn<() => Promise<FakeRow[]>>();
const webhookLogSelectMock = vi.fn<() => Promise<FakeRow[]>>();
const orderInsertValuesMock = vi.fn<(vals: Record<string, unknown>) => void>();
const orderOnConflictMock = vi.fn<(conflict: Record<string, unknown>) => void>();
const orderInsertReturningMock = vi.fn<() => Promise<FakeRow[]>>();
const orderDesignInsertValuesMock = vi.fn<(vals: Record<string, unknown>) => void>();
const orderDesignOnConflictMock = vi.fn<(conflict: Record<string, unknown>) => void>();
const orderDesignInsertReturningMock = vi.fn<() => Promise<FakeRow[]>>();
const webhookDeliveryInsertValuesMock = vi.fn<(vals: Record<string, unknown>) => void>();
const updateSetMock = vi.fn<(vals: Record<string, unknown>) => void>();
const updateReturningMock = vi.fn<() => Promise<FakeRow[]>>();
const deleteWhereMock = vi.fn<(condition: unknown) => Promise<unknown>>();
const enqueueProductionFilesMock = vi.fn<(designId: string, designData: unknown, productColor: string | null) => Promise<string>>();

// Branches on the actual Drizzle table object (identity, not shape) so `orders` vs
// `orderDesigns` inserts get their own mock chain regardless of what columns either happens
// to share.
vi.mock('../db/index.js', () => ({
  db: {
    select: () => ({
      from: (table: unknown) => {
        if (table === webhookDeliveries) {
          return { where: () => ({ orderBy: () => ({ limit: () => webhookLogSelectMock() }) }) };
        }
        return { where: () => selectDesignMock() };
      },
    }),
    insert: (table: unknown) => ({
      values: (vals: Record<string, unknown>) => {
        if (table === webhookDeliveries) {
          webhookDeliveryInsertValuesMock(vals);
          return Promise.resolve();
        }
        const isOrderDesigns = table === orderDesigns;
        (isOrderDesigns ? orderDesignInsertValuesMock : orderInsertValuesMock)(vals);
        return {
          onConflictDoUpdate: (conflict: Record<string, unknown>) => {
            (isOrderDesigns ? orderDesignOnConflictMock : orderOnConflictMock)(conflict);
            return { returning: () => (isOrderDesigns ? orderDesignInsertReturningMock() : orderInsertReturningMock()) };
          },
        };
      },
    }),
    update: () => ({
      set: (vals: Record<string, unknown>) => {
        updateSetMock(vals);
        return { where: () => ({ returning: () => updateReturningMock() }) };
      },
    }),
    delete: () => ({
      where: (condition: unknown) => deleteWhereMock(condition),
    }),
  },
}));

vi.mock('../jobs/queues.js', () => ({
  enqueueProductionFiles: (designId: string, designData: unknown, productColor: string | null) =>
    enqueueProductionFilesMock(designId, designData, productColor),
}));

vi.mock('../config.js', () => ({
  config: {
    woocommerce: { webhookSecret: '' },
  },
}));

const { orderWebhookWooCommerceRoutes } = await import('./orders-webhook-woocommerce.js');
const { config } = await import('../config.js');

async function buildApp() {
  const app = Fastify();
  await app.register(orderWebhookWooCommerceRoutes);
  await app.ready();
  return app;
}

function sign(secret: string, rawBody: string): string {
  return createHmac('sha256', secret).update(rawBody).digest('base64');
}

function fakeDesignRow(overrides: Partial<FakeRow> = {}): FakeRow {
  return {
    id: randomUUID(),
    productId: randomUUID(),
    designData: { layers: [] },
    productColor: 'black',
    productionStatus: null,
    ...overrides,
  };
}

function wooOrderPayload(opts: {
  id?: number;
  status?: string;
  designKey?: string | null;
  total?: string;
  currency?: string;
  extraLineItem?: { name: string; designKey: string };
} = {}): Record<string, unknown> {
  const lineItem: Record<string, unknown> = { name: 'Custom Tee' };
  if (opts.designKey !== null) {
    lineItem.meta_data = [
      { key: '_design_key', value: opts.designKey ?? randomUUID() },
      { key: '_design_url', value: 'https://example.com/design.png' },
      { key: '_design_filename', value: 'design.png' },
      { key: '_design_dimensions', value: { width: 100, height: 100 } },
    ];
  } else {
    lineItem.meta_data = [];
  }

  const lineItems = [lineItem];
  if (opts.extraLineItem) {
    lineItems.push({
      name: opts.extraLineItem.name,
      meta_data: [{ key: '_design_key', value: opts.extraLineItem.designKey }],
    });
  }

  return {
    id: opts.id ?? 12345,
    status: opts.status ?? 'processing',
    total: opts.total ?? '49.99',
    currency: opts.currency ?? 'USD',
    billing: { first_name: 'Ada', last_name: 'Lovelace', email: 'ada@example.com' },
    line_items: lineItems,
  };
}

async function postWebhook(app: Awaited<ReturnType<typeof buildApp>>, payload: unknown, secret: string) {
  const rawBody = JSON.stringify(payload);
  return app.inject({
    method: 'POST',
    url: '/api/v1/orders/webhook/woocommerce',
    headers: {
      'content-type': 'application/json',
      'x-wc-webhook-signature': sign(secret, rawBody),
    },
    payload: rawBody,
  });
}

beforeEach(() => {
  selectDesignMock.mockReset();
  webhookLogSelectMock.mockReset();
  webhookLogSelectMock.mockResolvedValue([]);
  orderInsertValuesMock.mockReset();
  orderOnConflictMock.mockReset();
  orderInsertReturningMock.mockReset();
  orderDesignInsertValuesMock.mockReset();
  orderDesignOnConflictMock.mockReset();
  orderDesignInsertReturningMock.mockReset();
  webhookDeliveryInsertValuesMock.mockReset();
  updateSetMock.mockReset();
  updateReturningMock.mockReset();
  deleteWhereMock.mockReset();
  deleteWhereMock.mockResolvedValue(undefined);
  enqueueProductionFilesMock.mockReset();
  config.woocommerce.webhookSecret = '';
});

describe('POST /api/v1/orders/webhook/woocommerce', () => {
  it('returns 503 WOOCOMMERCE_NOT_CONFIGURED when the webhook secret is unset', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/orders/webhook/woocommerce',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify(wooOrderPayload()),
    });

    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({
      error: 'WooCommerce webhook not configured (WOOCOMMERCE_WEBHOOK_SECRET unset)',
      code: 'WOOCOMMERCE_NOT_CONFIGURED',
    });
    expect(orderInsertValuesMock).not.toHaveBeenCalled();
    expect(webhookDeliveryInsertValuesMock).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'woocommerce', success: false, reasonCode: 'NOT_CONFIGURED', orderId: null }),
    );
    await app.close();
  });

  it('returns 401 INVALID_SIGNATURE when the HMAC signature does not match', async () => {
    config.woocommerce.webhookSecret = 'correct-secret';
    const app = await buildApp();

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/orders/webhook/woocommerce',
      headers: {
        'content-type': 'application/json',
        'x-wc-webhook-signature': sign('wrong-secret', JSON.stringify(wooOrderPayload())),
      },
      payload: JSON.stringify(wooOrderPayload()),
    });

    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: 'Invalid webhook signature', code: 'INVALID_SIGNATURE' });
    expect(orderInsertValuesMock).not.toHaveBeenCalled();
    expect(webhookDeliveryInsertValuesMock).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'woocommerce', success: false, reasonCode: 'INVALID_SIGNATURE', orderId: '12345' }),
    );
    await app.close();
  });

  it('creates the order, one order_designs line item, and enqueues production files for a valid payload with a design', async () => {
    config.woocommerce.webhookSecret = 'correct-secret';
    const designId = randomUUID();
    const orderRowId = randomUUID();
    const designRow = fakeDesignRow({ id: designId, productionStatus: null });
    selectDesignMock.mockResolvedValue([designRow]);
    orderInsertReturningMock.mockResolvedValueOnce([{ id: orderRowId, orderId: '12345', status: 'processing' }]);
    orderDesignInsertReturningMock.mockResolvedValueOnce([{ id: randomUUID(), orderId: orderRowId, designId, designKey: designId }]);
    updateReturningMock.mockResolvedValueOnce([designRow]);
    enqueueProductionFilesMock.mockResolvedValueOnce('job-1');

    const app = await buildApp();
    const res = await postWebhook(app, wooOrderPayload({ id: 12345, status: 'processing', designKey: designId }), 'correct-secret');

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ received: true });

    expect(orderInsertValuesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: '12345',
        customerName: 'Ada Lovelace',
        status: 'processing',
        total: 4999,
        currency: 'USD',
      }),
    );
    expect(orderOnConflictMock).toHaveBeenCalledWith(expect.objectContaining({ target: expect.anything() }));
    expect(orderDesignInsertValuesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: orderRowId,
        designId,
        designKey: designId,
        productName: 'Custom Tee',
      }),
    );
    expect(updateSetMock).toHaveBeenCalledWith(expect.objectContaining({ productionStatus: 'queued' }));
    expect(enqueueProductionFilesMock).toHaveBeenCalledWith(designId, designRow.designData, designRow.productColor);
    expect(webhookDeliveryInsertValuesMock).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'woocommerce', success: true, reasonCode: 'PROCESSED', orderId: '12345' }),
    );
    await app.close();
  });

  it('records and enqueues production for every customized line item on an order with more than one', async () => {
    config.woocommerce.webhookSecret = 'correct-secret';
    const designId1 = randomUUID();
    const designId2 = randomUUID();
    const orderRowId = randomUUID();
    const designRow1 = fakeDesignRow({ id: designId1, productionStatus: null });
    const designRow2 = fakeDesignRow({ id: designId2, productionStatus: null });

    selectDesignMock.mockResolvedValueOnce([designRow1]).mockResolvedValueOnce([designRow2]);
    orderInsertReturningMock.mockResolvedValueOnce([{ id: orderRowId, orderId: '555', status: 'processing' }]);
    orderDesignInsertReturningMock
      .mockResolvedValueOnce([{ id: randomUUID(), orderId: orderRowId, designId: designId1, designKey: designId1 }])
      .mockResolvedValueOnce([{ id: randomUUID(), orderId: orderRowId, designId: designId2, designKey: designId2 }]);
    updateReturningMock.mockResolvedValueOnce([designRow1]).mockResolvedValueOnce([designRow2]);
    enqueueProductionFilesMock.mockResolvedValueOnce('job-1').mockResolvedValueOnce('job-2');

    const app = await buildApp();
    const res = await postWebhook(
      app,
      wooOrderPayload({ id: 555, status: 'processing', designKey: designId1, extraLineItem: { name: 'Custom Hoodie', designKey: designId2 } }),
      'correct-secret',
    );

    expect(res.statusCode).toBe(200);
    expect(orderDesignInsertValuesMock).toHaveBeenCalledTimes(2);
    expect(updateSetMock).toHaveBeenCalledTimes(2);
    expect(enqueueProductionFilesMock).toHaveBeenCalledTimes(2);
    expect(enqueueProductionFilesMock).toHaveBeenCalledWith(designId1, designRow1.designData, designRow1.productColor);
    expect(enqueueProductionFilesMock).toHaveBeenCalledWith(designId2, designRow2.designData, designRow2.productColor);
    await app.close();
  });

  it('removes order_designs rows whose line item is no longer on the order (e.g. an admin removed it in wp-admin)', async () => {
    config.woocommerce.webhookSecret = 'correct-secret';
    const designId = randomUUID();
    const orderRowId = randomUUID();
    const designRow = fakeDesignRow({ id: designId, productionStatus: null });

    selectDesignMock.mockResolvedValueOnce([designRow]);
    orderInsertReturningMock.mockResolvedValueOnce([{ id: orderRowId, orderId: '888', status: 'processing' }]);
    orderDesignInsertReturningMock.mockResolvedValueOnce([{ id: randomUUID(), orderId: orderRowId, designId, designKey: designId }]);
    updateReturningMock.mockResolvedValueOnce([designRow]);
    enqueueProductionFilesMock.mockResolvedValueOnce('job-1');

    const app = await buildApp();
    // Only one design line item on this delivery — any order_designs row for order 888
    // whose designKey isn't this one is stale and should be dropped.
    const res = await postWebhook(app, wooOrderPayload({ id: 888, status: 'processing', designKey: designId }), 'correct-secret');

    expect(res.statusCode).toBe(200);
    expect(deleteWhereMock).toHaveBeenCalledTimes(1);
    await app.close();
  });

  it('does not duplicate the order or double-enqueue production when the same order is delivered twice', async () => {
    config.woocommerce.webhookSecret = 'correct-secret';
    const designId = randomUUID();
    const orderRowId = randomUUID();
    const firstDesignRow = fakeDesignRow({ id: designId, productionStatus: null });
    const secondDesignRow = fakeDesignRow({ id: designId, productionStatus: 'queued' }); // already claimed by the first delivery

    selectDesignMock.mockResolvedValueOnce([firstDesignRow]).mockResolvedValueOnce([secondDesignRow]);
    orderInsertReturningMock
      .mockResolvedValueOnce([{ id: orderRowId, orderId: '777', status: 'processing' }])
      .mockResolvedValueOnce([{ id: orderRowId, orderId: '777', status: 'processing' }]);
    orderDesignInsertReturningMock
      .mockResolvedValueOnce([{ id: randomUUID(), orderId: orderRowId, designId, designKey: designId }])
      .mockResolvedValueOnce([{ id: randomUUID(), orderId: orderRowId, designId, designKey: designId }]);
    updateReturningMock.mockResolvedValueOnce([firstDesignRow]);
    enqueueProductionFilesMock.mockResolvedValueOnce('job-1');

    const app = await buildApp();
    const payload = wooOrderPayload({ id: 777, status: 'processing', designKey: designId });

    const res1 = await postWebhook(app, payload, 'correct-secret');
    const res2 = await postWebhook(app, payload, 'correct-secret');

    expect(res1.statusCode).toBe(200);
    expect(res2.statusCode).toBe(200);

    // Both deliveries upsert against the same unique orderId (the DB-level guarantee against
    // duplicate rows) — never a plain insert that would collide/duplicate.
    expect(orderOnConflictMock).toHaveBeenCalledTimes(2);
    expect(orderInsertValuesMock).toHaveBeenNthCalledWith(1, expect.objectContaining({ orderId: '777' }));
    expect(orderInsertValuesMock).toHaveBeenNthCalledWith(2, expect.objectContaining({ orderId: '777' }));

    // Production is only claimed/enqueued once — the second delivery finds productionStatus
    // already "queued" and skips the atomic claim + enqueue entirely.
    expect(updateSetMock).toHaveBeenCalledTimes(1);
    expect(enqueueProductionFilesMock).toHaveBeenCalledTimes(1);
    await app.close();
  });

  it('stores a non-USD currency from the payload as-is', async () => {
    config.woocommerce.webhookSecret = 'correct-secret';
    const designId = randomUUID();
    const orderRowId = randomUUID();
    const designRow = fakeDesignRow({ id: designId, productionStatus: null });
    selectDesignMock.mockResolvedValue([designRow]);
    orderInsertReturningMock.mockResolvedValueOnce([{ id: orderRowId, orderId: '900', status: 'processing' }]);
    orderDesignInsertReturningMock.mockResolvedValueOnce([{ id: randomUUID(), orderId: orderRowId, designId, designKey: designId }]);
    updateReturningMock.mockResolvedValueOnce([designRow]);
    enqueueProductionFilesMock.mockResolvedValueOnce('job-1');

    const app = await buildApp();
    const res = await postWebhook(app, wooOrderPayload({ id: 900, designKey: designId, currency: 'mxn' }), 'correct-secret');

    expect(res.statusCode).toBe(200);
    expect(orderInsertValuesMock).toHaveBeenCalledWith(expect.objectContaining({ currency: 'MXN' }));
    await app.close();
  });

  it('falls back to USD when the payload omits currency', async () => {
    config.woocommerce.webhookSecret = 'correct-secret';
    const designId = randomUUID();
    const orderRowId = randomUUID();
    const designRow = fakeDesignRow({ id: designId, productionStatus: null });
    selectDesignMock.mockResolvedValue([designRow]);
    orderInsertReturningMock.mockResolvedValueOnce([{ id: orderRowId, orderId: '901', status: 'processing' }]);
    orderDesignInsertReturningMock.mockResolvedValueOnce([{ id: randomUUID(), orderId: orderRowId, designId, designKey: designId }]);
    updateReturningMock.mockResolvedValueOnce([designRow]);
    enqueueProductionFilesMock.mockResolvedValueOnce('job-1');

    const payload = wooOrderPayload({ id: 901, designKey: designId });
    delete ( payload as Record<string, unknown> ).currency;

    const app = await buildApp();
    const res = await postWebhook(app, payload, 'correct-secret');

    expect(res.statusCode).toBe(200);
    expect(orderInsertValuesMock).toHaveBeenCalledWith(expect.objectContaining({ currency: 'USD' }));
    await app.close();
  });

  it('acknowledges with 200 and does nothing when no line item has a _design_key', async () => {
    config.woocommerce.webhookSecret = 'correct-secret';
    const app = await buildApp();

    const res = await postWebhook(app, wooOrderPayload({ designKey: null }), 'correct-secret');

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ received: true });
    expect(orderInsertValuesMock).not.toHaveBeenCalled();
    expect(selectDesignMock).not.toHaveBeenCalled();
    expect(enqueueProductionFilesMock).not.toHaveBeenCalled();
    expect(deleteWhereMock).not.toHaveBeenCalled();
    expect(webhookDeliveryInsertValuesMock).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'woocommerce', success: true, reasonCode: 'NO_DESIGN_LINE_ITEMS' }),
    );
    await app.close();
  });
});

describe('GET /api/v1/orders/webhook/woocommerce/log', () => {
  it('returns the most recent delivery attempts as recorded', async () => {
    const rows = [
      { id: randomUUID(), success: true, reasonCode: 'PROCESSED', orderId: '12345', createdAt: new Date() },
      { id: randomUUID(), success: false, reasonCode: 'INVALID_SIGNATURE', orderId: null, createdAt: new Date() },
    ];
    webhookLogSelectMock.mockResolvedValueOnce(rows);

    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/api/v1/orders/webhook/woocommerce/log' });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(2);
    expect(res.json()[0]).toMatchObject({ success: true, reasonCode: 'PROCESSED', orderId: '12345' });
    await app.close();
  });

  it('returns an empty array when no deliveries have been recorded yet', async () => {
    webhookLogSelectMock.mockResolvedValueOnce([]);
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/api/v1/orders/webhook/woocommerce/log' });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
    await app.close();
  });
});
