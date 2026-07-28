import { randomUUID } from 'node:crypto';
import Fastify from 'fastify';
import { describe, it, expect, vi, beforeEach } from 'vitest';

type FakeProductRow = { name: string };
type FakeCountRow = { total: number };
type FakeDesignRow = Record<string, unknown>;

const productSelectMock = vi.fn<() => Promise<FakeProductRow[]>>();
const countSelectMock = vi.fn<() => Promise<FakeCountRow[]>>();
const insertReturningMock = vi.fn<() => Promise<FakeDesignRow[]>>();
const insertValuesMock = vi.fn<(vals: Record<string, unknown>) => void>();

// `db.select({ name: products.name })` (product lookup) and
// `db.select({ total: count() })` (design count) are told apart by the shape
// of the selection object passed in — the only thing this route's two SELECTs
// differ on before `.where()` is called with an untyped `eq(...)` we don't
// need to inspect.
vi.mock('../db/index.js', () => ({
  db: {
    select: (selection: Record<string, unknown>) => ({
      from: () => ({
        where: () => ('name' in selection ? productSelectMock() : countSelectMock()),
      }),
    }),
    insert: () => ({
      values: (vals: Record<string, unknown>) => {
        insertValuesMock(vals);
        return { returning: () => insertReturningMock() };
      },
    }),
  },
}));

// designs.ts also imports these for the /generate-files route (unused by the
// tests below); stub them so importing the module doesn't try to open a real
// BullMQ/Redis connection.
vi.mock('../jobs/queues.js', () => ({
  computeProductionJobId: vi.fn(),
  enqueueProductionFiles: vi.fn(),
}));

const { designRoutes } = await import('./designs.js');

async function buildApp() {
  const app = Fastify();
  await app.register(designRoutes);
  await app.ready();
  return app;
}

function fakeInsertedDesign(overrides: Partial<FakeDesignRow> = {}): FakeDesignRow {
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    productId: randomUUID(),
    name: null,
    designData: {},
    thumbnailUrl: null,
    status: 'draft',
    sizes: {},
    productColor: null,
    productionFiles: null,
    productionStatus: null,
    productionError: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('POST /api/v1/designs — sequential naming', () => {
  beforeEach(() => {
    productSelectMock.mockReset();
    countSelectMock.mockReset();
    insertReturningMock.mockReset();
    insertValuesMock.mockReset();
  });

  it('pads the sequential design number to 3 digits ("Design #003")', async () => {
    const productId = randomUUID();
    productSelectMock.mockResolvedValueOnce([{ name: 'Cool Hoodie' }]);
    countSelectMock.mockResolvedValueOnce([{ total: 2 }]); // 2 existing designs -> next is #003
    insertReturningMock.mockImplementationOnce(async () => [fakeInsertedDesign({ productId })]);

    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/designs',
      payload: { productId, designData: {} },
    });

    expect(res.statusCode).toBe(200);
    expect(insertValuesMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Cool Hoodie - Design #003' }),
    );
    await app.close();
  });

  it("falls back to 'Product' when the product can't be found", async () => {
    const productId = randomUUID();
    productSelectMock.mockResolvedValueOnce([]); // no matching product row
    countSelectMock.mockResolvedValueOnce([{ total: 0 }]);
    insertReturningMock.mockImplementationOnce(async () => [fakeInsertedDesign({ productId })]);

    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/designs',
      payload: { productId, designData: {} },
    });

    expect(res.statusCode).toBe(200);
    expect(insertValuesMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Product - Design #001' }),
    );
    await app.close();
  });

  it('does not overwrite a name explicitly provided in the request body', async () => {
    const productId = randomUUID();
    insertReturningMock.mockImplementationOnce(async () => [
      fakeInsertedDesign({ productId, name: 'My Custom Name' }),
    ]);

    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/designs',
      payload: { productId, designData: {}, name: 'My Custom Name' },
    });

    expect(res.statusCode).toBe(200);
    // The naming/count lookups must be skipped entirely when a name is given.
    expect(productSelectMock).not.toHaveBeenCalled();
    expect(countSelectMock).not.toHaveBeenCalled();
    expect(insertValuesMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'My Custom Name' }),
    );
    await app.close();
  });
});
