import { randomUUID } from 'node:crypto';
import Fastify from 'fastify';
import sharp from 'sharp';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

type FakeAssetRow = Record<string, unknown>;

const insertReturningMock = vi.fn<() => Promise<FakeAssetRow[]>>();
const insertValuesMock = vi.fn<(vals: Record<string, unknown>) => void>();
const putObjectMock = vi.fn();
const ensureBucketMock = vi.fn();
const resolveMock = vi.fn<(src: string) => Promise<Buffer>>();

vi.mock('../db/index.js', () => ({
  db: {
    insert: () => ({
      values: (vals: Record<string, unknown>) => {
        insertValuesMock(vals);
        return { returning: () => insertReturningMock() };
      },
    }),
  },
}));

vi.mock('../storage/minio.js', () => ({
  minioClient: { putObject: (...args: unknown[]) => putObjectMock(...args) },
  ensureBucket: () => ensureBucketMock(),
}));

vi.mock('../jobs/resolvers/image-resolver.js', () => ({
  ImageResolver: vi.fn().mockImplementation(() => ({
    resolve: (src: string) => resolveMock(src),
  })),
}));

// A mutable stand-in for the real config module: tests flip `config.rembg.url`
// directly since the route reads it at request time, not at import time.
vi.mock('../config.js', () => ({
  config: {
    rembg: { url: '' },
    minio: { bucket: 'openmerch' },
  },
}));

const { removeBackgroundRoutes } = await import('./remove-background.js');
const { config } = await import('../config.js');

async function buildApp() {
  const app = Fastify();
  await app.register(removeBackgroundRoutes);
  await app.ready();
  return app;
}

function fakeInsertedAsset(overrides: Partial<FakeAssetRow> = {}): FakeAssetRow {
  return {
    id: randomUUID(),
    filename: 'abc.png',
    mimeType: 'image/png',
    size: 1234,
    url: '/api/v1/assets/uploads/abc.png',
    storageKey: 'uploads/abc.png',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

const originalFetch = global.fetch;

beforeEach(() => {
  insertReturningMock.mockReset();
  insertValuesMock.mockReset();
  putObjectMock.mockReset();
  ensureBucketMock.mockReset();
  resolveMock.mockReset();
  config.rembg.url = '';
});

afterEach(() => {
  global.fetch = originalFetch;
  vi.unstubAllGlobals();
});

describe('POST /api/v1/assets/remove-background', () => {
  it('returns 503 REMBG_NOT_CONFIGURED when REMBG_URL is unset', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/assets/remove-background',
      payload: { src: 'data:image/png;base64,AAAA' },
    });

    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({
      error: 'AI background removal service not configured',
      code: 'REMBG_NOT_CONFIGURED',
    });
    expect(resolveMock).not.toHaveBeenCalled();
    await app.close();
  });

  it('resolves the src, forwards it to the microservice, and stores the (unpremultiplied) resulting asset', async () => {
    config.rembg.url = 'http://rembg:7000';
    const sourceBuffer = Buffer.from('fake-source-image');
    resolveMock.mockResolvedValueOnce(sourceBuffer);

    // A real (tiny) PNG, since the route now decodes/re-encodes it via sharp to
    // fix rembg's premultiplied-alpha output — fake bytes would fail to decode.
    const fakePng = await sharp({
      create: { width: 4, height: 4, channels: 4, background: { r: 200, g: 100, b: 50, alpha: 128 } },
    }).png().toBuffer();
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(fakePng, { status: 200 }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const insertedAsset = fakeInsertedAsset();
    insertReturningMock.mockResolvedValueOnce([insertedAsset]);

    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/assets/remove-background',
      payload: { src: '/api/v1/assets/uploads/original.png' },
    });

    expect(res.statusCode).toBe(200);
    expect(resolveMock).toHaveBeenCalledWith('/api/v1/assets/uploads/original.png');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://rembg:7000/remove-background',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(ensureBucketMock).toHaveBeenCalled();
    expect(putObjectMock).toHaveBeenCalledWith(
      'openmerch',
      expect.stringMatching(/^uploads\/.+\.png$/),
      expect.any(Buffer),
      expect.any(Number),
      { 'Content-Type': 'image/png' },
    );
    expect(insertValuesMock).toHaveBeenCalledWith(
      expect.objectContaining({ mimeType: 'image/png' }),
    );
    expect(res.json()).toEqual(insertedAsset);
    await app.close();
  });

  it('returns 502 REMBG_INVALID_IMAGE when the microservice response is not a decodable image', async () => {
    config.rembg.url = 'http://rembg:7000';
    resolveMock.mockResolvedValueOnce(Buffer.from('src'));
    global.fetch = vi.fn().mockResolvedValueOnce(
      new Response(Buffer.from('not-a-real-png'), { status: 200 }),
    ) as unknown as typeof fetch;

    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/assets/remove-background',
      payload: { src: 'https://example.com/img.png' },
    });

    expect(res.statusCode).toBe(502);
    expect(res.json().code).toBe('REMBG_INVALID_IMAGE');
    await app.close();
  });

  it('returns 400 INVALID_IMAGE_SOURCE when the src cannot be resolved', async () => {
    config.rembg.url = 'http://rembg:7000';
    resolveMock.mockRejectedValueOnce(new Error('Unsupported image src: nope'));

    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/assets/remove-background',
      payload: { src: 'nope' },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('INVALID_IMAGE_SOURCE');
    await app.close();
  });

  it('returns 503 REMBG_UNAVAILABLE when the microservice is unreachable', async () => {
    config.rembg.url = 'http://rembg:7000';
    resolveMock.mockResolvedValueOnce(Buffer.from('src'));
    global.fetch = vi.fn().mockRejectedValueOnce(new TypeError('fetch failed')) as unknown as typeof fetch;

    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/assets/remove-background',
      payload: { src: 'https://example.com/img.png' },
    });

    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({
      error: 'AI background removal service unreachable',
      code: 'REMBG_UNAVAILABLE',
    });
    await app.close();
  });

  it('returns 504 REMBG_TIMEOUT when the microservice call times out', async () => {
    config.rembg.url = 'http://rembg:7000';
    resolveMock.mockResolvedValueOnce(Buffer.from('src'));
    const timeoutError = new Error('The operation was aborted due to timeout');
    timeoutError.name = 'TimeoutError';
    global.fetch = vi.fn().mockRejectedValueOnce(timeoutError) as unknown as typeof fetch;

    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/assets/remove-background',
      payload: { src: 'https://example.com/img.png' },
    });

    expect(res.statusCode).toBe(504);
    expect(res.json()).toEqual({
      error: 'AI background removal timed out',
      code: 'REMBG_TIMEOUT',
    });
    await app.close();
  });

  it('returns 502 REMBG_FAILED when the microservice responds with an error status', async () => {
    config.rembg.url = 'http://rembg:7000';
    resolveMock.mockResolvedValueOnce(Buffer.from('src'));
    global.fetch = vi.fn().mockResolvedValueOnce(
      new Response('boom', { status: 500 }),
    ) as unknown as typeof fetch;

    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/assets/remove-background',
      payload: { src: 'https://example.com/img.png' },
    });

    expect(res.statusCode).toBe(502);
    expect(res.json()).toEqual({
      error: 'AI background removal failed',
      code: 'REMBG_FAILED',
    });
    await app.close();
  });
});
