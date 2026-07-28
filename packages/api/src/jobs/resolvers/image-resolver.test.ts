import { Readable } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const existsSyncMock = vi.fn((_path: string) => false);
const readFileSyncMock = vi.fn((_path: string): Buffer => Buffer.alloc(0));

vi.mock('fs', () => ({
  existsSync: (path: string) => existsSyncMock(path),
  readFileSync: (path: string) => readFileSyncMock(path),
}));

const getObjectMock = vi.fn(async (_bucket: string, _key: string): Promise<Readable> => Readable.from([]));

vi.mock('../../storage/minio.js', () => ({
  minioClient: {
    getObject: (bucket: string, key: string) => getObjectMock(bucket, key),
  },
}));

const { ImageResolver } = await import('./image-resolver.js');

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

const VALID_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="red"/></svg>';

function fakeResponse(body: ArrayBuffer, ok = true, status = 200): Response {
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Not Found',
    arrayBuffer: async () => body,
  } as unknown as Response;
}

describe('ImageResolver', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    existsSyncMock.mockReset().mockReturnValue(false);
    readFileSyncMock.mockReset().mockReturnValue(Buffer.alloc(0));
    getObjectMock.mockReset().mockResolvedValue(Readable.from([]));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('fromDataUrl (via resolve)', () => {
    it('decodes a base64 data URL', async () => {
      const resolver = new ImageResolver();
      const original = Buffer.from('hello world, this is not an svg');
      const src = `data:text/plain;base64,${original.toString('base64')}`;

      const result = await resolver.resolve(src);

      expect(result.equals(original)).toBe(true);
    });

    it('decodes a URL-encoded (non-base64) data URL', async () => {
      const resolver = new ImageResolver();
      const plain = 'hello, url-encoded & special=chars';
      const src = `data:text/plain,${encodeURIComponent(plain)}`;

      const result = await resolver.resolve(src);

      expect(result.toString('utf-8')).toBe(plain);
    });

    it('throws a readable error for a malformed data URL missing the comma separator', async () => {
      const resolver = new ImageResolver();
      const src = 'data:image/png;base64';

      await expect(resolver.resolve(src)).rejects.toThrow('Malformed data URL');
    });
  });

  describe('SVG detection (via resolve)', () => {
    it('still detects an SVG when preceded by a BOM and leading whitespace', async () => {
      const resolver = new ImageResolver();
      const svgWithNoise = '﻿   ' + VALID_SVG;
      const src = `data:image/svg+xml;base64,${Buffer.from(svgWithNoise, 'utf-8').toString('base64')}`;

      const result = await resolver.resolve(src);

      // If SVG sniffing had failed, resolve() would hand back the raw SVG
      // text buffer instead of a rasterized PNG.
      expect(result.subarray(0, 4).equals(PNG_MAGIC)).toBe(true);
    });
  });

  describe('unrecognized src', () => {
    it('throws a readable error explaining the expected formats', async () => {
      const resolver = new ImageResolver();
      const src = 'ftp://example.com/image.png';

      await expect(resolver.resolve(src)).rejects.toThrow(/Unsupported image src/);
      await expect(resolver.resolve(src)).rejects.toThrow(/ftp:\/\/example\.com/);
    });
  });

  describe('caching', () => {
    it('does not re-fetch the same external URL on a second resolve() call', async () => {
      const resolver = new ImageResolver();
      const bytes = Buffer.from('not-an-svg-just-bytes');
      fetchMock.mockResolvedValue(fakeResponse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)));
      const src = 'https://example.com/photo.png';

      const first = await resolver.resolve(src);
      const second = await resolver.resolve(src);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(first).toBe(second);
    });

    it('does not read MinIO twice for the same internal asset src', async () => {
      const resolver = new ImageResolver();
      const bytes = Buffer.from('minio-bytes');
      getObjectMock.mockImplementation(async () => Readable.from([bytes]));
      const src = '/api/v1/assets/some-storage-key.png';

      const first = await resolver.resolve(src);
      const second = await resolver.resolve(src);

      expect(getObjectMock).toHaveBeenCalledTimes(1);
      expect(first).toBe(second);
    });
  });

  describe('SVG rasterization', () => {
    it('rasterizes a fetched SVG into a PNG bitmap', async () => {
      const resolver = new ImageResolver();
      const svgBytes = Buffer.from(VALID_SVG, 'utf-8');
      fetchMock.mockResolvedValue(
        fakeResponse(svgBytes.buffer.slice(svgBytes.byteOffset, svgBytes.byteOffset + svgBytes.byteLength)),
      );

      const result = await resolver.resolve('https://example.com/icon.svg');

      expect(result.subarray(0, 4).equals(PNG_MAGIC)).toBe(true);

      const sharp = (await import('sharp')).default;
      const metadata = await sharp(result).metadata();
      expect(metadata.format).toBe('png');
      expect(Math.max(metadata.width ?? 0, metadata.height ?? 0)).toBeLessThanOrEqual(4000);
    });
  });

  describe('fromMinio (asset interno)', () => {
    it('resolves an internal asset by concatenating its MinIO stream', async () => {
      const resolver = new ImageResolver();
      const bytes = Buffer.from('minio-image-bytes');
      getObjectMock.mockImplementation(async () => Readable.from([bytes]));

      const result = await resolver.resolve('/api/v1/assets/foo/bar.png');

      expect(result.equals(bytes)).toBe(true);
      expect(getObjectMock).toHaveBeenCalledWith(expect.any(String), 'foo/bar.png');
    });

    it('extracts the storage key from an absolute URL containing the assets prefix', async () => {
      const resolver = new ImageResolver();
      const bytes = Buffer.from('minio-image-bytes-2');
      getObjectMock.mockImplementation(async () => Readable.from([bytes]));

      await resolver.resolve('http://localhost:3001/api/v1/assets/nested/key.jpg');

      expect(getObjectMock).toHaveBeenCalledWith(expect.any(String), 'nested/key.jpg');
    });
  });

  describe('fromProductsDir', () => {
    it('reads product mockups from the filesystem when present locally', async () => {
      const resolver = new ImageResolver();
      const bytes = Buffer.from('mockup-bytes');
      existsSyncMock.mockReturnValue(true);
      readFileSyncMock.mockReturnValue(bytes);

      const result = await resolver.resolve('/products/hoodie/front.png');

      expect(result.equals(bytes)).toBe(true);
      expect(readFileSyncMock).toHaveBeenCalled();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('falls back to fetching from the local API server when the file is missing on disk', async () => {
      const resolver = new ImageResolver();
      const bytes = Buffer.from('mockup-bytes-via-http');
      existsSyncMock.mockReturnValue(false);
      fetchMock.mockResolvedValue(
        fakeResponse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)),
      );

      const result = await resolver.resolve('/products/hoodie/back.png');

      expect(result.equals(bytes)).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const calledUrl = fetchMock.mock.calls[0]?.[0] as string;
      expect(calledUrl).toContain('/products/hoodie/back.png');
    });
  });
});
