import { Readable } from 'node:stream';
import * as path from 'node:path';
import * as os from 'node:os';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type FakeFontRow = { id: string; name: string; fileUrl: string | null; isGoogle: boolean; updatedAt: Date };

// `db.select().from(fonts).where(...)` is used for exact-match lookups (by id
// or by name); `db.select().from(fonts)` (no `.where()`) is used for the full
// custom-font scan that powers the fuzzy prefix match. We fake both shapes on
// the same mock object: `.where()` returns whereMock()'s promise directly,
// while awaiting the object itself (no `.where()`) resolves via allMock().
const whereMock = vi.fn<() => Promise<FakeFontRow[]>>();
const allMock = vi.fn<() => Promise<FakeFontRow[]>>();

vi.mock('../../db/index.js', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => whereMock(),
        then: (resolve: (rows: FakeFontRow[]) => void, reject: (err: unknown) => void) =>
          allMock().then(resolve, reject),
        catch: (reject: (err: unknown) => void) => allMock().catch(reject),
      }),
    }),
  },
}));

const statMock = vi.fn<(p: string) => Promise<{ isFile(): boolean; size: number }>>();
const readFileMock = vi.fn<(p: string) => Promise<Buffer>>();
const writeFileMock = vi.fn<(p: string, data: Buffer) => Promise<void>>();
const renameMock = vi.fn<(from: string, to: string) => Promise<void>>();
const unlinkMock = vi.fn<(p: string) => Promise<void>>();
const mkdirMock = vi.fn<(p: string, opts?: unknown) => Promise<void>>();
const readdirMock = vi.fn<(p: string) => Promise<string[]>>();

vi.mock('node:fs', () => ({
  promises: {
    stat: (p: string) => statMock(p),
    readFile: (p: string) => readFileMock(p),
    writeFile: (p: string, data: Buffer) => writeFileMock(p, data),
    rename: (from: string, to: string) => renameMock(from, to),
    unlink: (p: string) => unlinkMock(p),
    mkdir: (p: string, opts?: unknown) => mkdirMock(p, opts),
    readdir: (p: string) => readdirMock(p),
  },
}));

const getObjectMock = vi.fn(async (_bucket: string, _key: string): Promise<Readable> => Readable.from([]));

vi.mock('../../storage/minio.js', () => ({
  minioClient: {
    getObject: (bucket: string, key: string) => getObjectMock(bucket, key),
  },
}));

const { FontResolver } = await import('./font-resolver.js');

const CACHE_DIR = path.join(os.tmpdir(), 'openmerch-fonts');

// A minimal valid TTF signature (magic 0x00010000) — enough for
// isSupportedFontFormat() to accept it as a real TrueType file.
const TTF_BYTES = Buffer.from([0x00, 0x01, 0x00, 0x00, 0xaa, 0xbb, 0xcc, 0xdd]);

/** Custom-font cache filenames are versioned by the row's `updatedAt` (ms since epoch). */
function customFontPath(id: string, updatedAt: Date, ext = '.ttf'): string {
  return path.join(CACHE_DIR, `${id}-${updatedAt.getTime()}${ext}`);
}

function fakeCssResponse(body: string, ok = true, status = 200): Response {
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Not Found',
    text: async () => body,
  } as unknown as Response;
}

function fakeBinaryResponse(buffer: Buffer, ok = true, status = 200): Response {
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Not Found',
    headers: { get: () => 'font/ttf' },
    arrayBuffer: async () => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
  } as unknown as Response;
}

describe('FontResolver', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    whereMock.mockReset();
    allMock.mockReset();
    statMock.mockReset().mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
    readFileMock.mockReset().mockResolvedValue(Buffer.alloc(0));
    writeFileMock.mockReset().mockResolvedValue(undefined);
    renameMock.mockReset().mockResolvedValue(undefined);
    unlinkMock.mockReset().mockResolvedValue(undefined);
    mkdirMock.mockReset().mockResolvedValue(undefined);
    readdirMock.mockReset().mockResolvedValue([]);
    getObjectMock.mockReset().mockResolvedValue(Readable.from([]));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('resolveById()', () => {
    it('returns null (silent fallback to system font) when the fontId is not found', async () => {
      whereMock.mockResolvedValueOnce([]);
      const resolver = new FontResolver();

      await expect(resolver.resolveById('missing-font-id-1')).resolves.toBeNull();
    });

    it('returns null when the row exists but has no fileUrl', async () => {
      whereMock.mockResolvedValueOnce([
        { id: 'id-no-file', name: 'Orphan Font', fileUrl: null, isGoogle: false, updatedAt: new Date('2024-01-01') },
      ]);
      const resolver = new FontResolver();

      await expect(resolver.resolveById('id-no-file')).resolves.toBeNull();
    });
  });

  describe('resolve() — system fonts', () => {
    it('returns null for a known system font without touching the DB', async () => {
      const resolver = new FontResolver();

      await expect(resolver.resolve('Helvetica')).resolves.toBeNull();

      expect(whereMock).not.toHaveBeenCalled();
      expect(allMock).not.toHaveBeenCalled();
    });
  });

  describe('resolve() — CSS family names with bold/italic variants', () => {
    it('matches a custom font whose stored name is itself a weight/style variant', async () => {
      const updatedAt = new Date('2024-01-01T00:00:00.000Z');
      whereMock.mockResolvedValueOnce([
        { id: 'museo-bold-id', name: 'Museo Sans Bold', fileUrl: '/api/v1/assets/museo-bold.ttf', isGoogle: false, updatedAt },
      ]);
      getObjectMock.mockResolvedValueOnce(Readable.from([TTF_BYTES]));
      const resolver = new FontResolver();

      const result = await resolver.resolve('Museo Sans Bold');

      expect(result).toBe(customFontPath('museo-bold-id', updatedAt));
      expect(getObjectMock).toHaveBeenCalledWith(expect.any(String), 'museo-bold.ttf');
      expect(allMock).not.toHaveBeenCalled();
    });

    it('falls back to a fuzzy prefix match when the exact variant name has no DB row', async () => {
      const updatedAt = new Date('2024-02-02T00:00:00.000Z');
      whereMock.mockResolvedValueOnce([]); // no exact match for the full CSS name
      allMock.mockResolvedValueOnce([
        { id: 'lacheyard-id', name: 'Lacheyard Script', fileUrl: '/api/v1/assets/lacheyard.ttf', isGoogle: false, updatedAt },
      ]);
      getObjectMock.mockResolvedValueOnce(Readable.from([TTF_BYTES]));
      const resolver = new FontResolver();

      const result = await resolver.resolve('Lacheyard Script PERSONAL USE');

      expect(result).toBe(customFontPath('lacheyard-id', updatedAt));
    });

    it('downloads from Google Fonts when a bold/italic variant has no DB match, preserving the full family string', async () => {
      whereMock.mockResolvedValueOnce([]);
      allMock.mockResolvedValueOnce([]);
      const css = 'src: url(https://fonts.gstatic.com/s/opensans/v1/xyz.ttf) format("truetype");';
      fetchMock
        .mockResolvedValueOnce(fakeCssResponse(css))
        .mockResolvedValueOnce(fakeBinaryResponse(TTF_BYTES));
      const resolver = new FontResolver();

      const result = await resolver.resolve('Open Sans Bold Italic');

      expect(result).toBe(path.join(CACHE_DIR, 'google_Open_Sans_Bold_Italic.ttf'));
      const cssUrl = fetchMock.mock.calls[0]?.[0] as string;
      expect(cssUrl).toContain(encodeURIComponent('Open Sans Bold Italic'));
      const fontUrl = fetchMock.mock.calls[1]?.[0] as string;
      expect(fontUrl).toBe('https://fonts.gstatic.com/s/opensans/v1/xyz.ttf');
    });
  });

  describe('caching', () => {
    // resolveById() re-checks the DB on every call (by design: that's how a
    // merchant replacing a font file gets picked up without an explicit
    // invalidation call), but the *download itself* is deduped by the
    // `${id}:${updatedAt}` version key — two calls for the still-current
    // version share one in-flight/resolved MinIO download.
    it('dedupes the underlying MinIO download across repeated resolveById() calls for the same font version', async () => {
      const updatedAt = new Date('2024-03-03T00:00:00.000Z');
      const row = { id: 'cache-id-1', name: 'Cached Font', fileUrl: '/api/v1/assets/cached.ttf', isGoogle: false, updatedAt };
      whereMock.mockResolvedValueOnce([row]).mockResolvedValueOnce([row]);
      getObjectMock.mockResolvedValueOnce(Readable.from([TTF_BYTES]));
      const resolver = new FontResolver();

      const first = await resolver.resolveById('cache-id-1');
      const second = await resolver.resolveById('cache-id-1');

      expect(first).toBe(second);
      expect(first).toBe(customFontPath('cache-id-1', updatedAt));
      expect(whereMock).toHaveBeenCalledTimes(2); // DB re-checked each time...
      expect(getObjectMock).toHaveBeenCalledTimes(1); // ...but the download itself is deduped
    });

    // Google Fonts have no in-memory promise cache — repeated resolve() calls
    // re-query the DB — but loadGoogleFont() checks the on-disk cache file
    // before fetching, so a font already downloaded to CACHE_DIR is reused
    // instead of hitting the network again.
    it('reuses an already-downloaded Google Font file from disk instead of re-fetching it', async () => {
      const family = 'Disk Cached Font';
      whereMock.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
      allMock.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
      const css = 'src: url(https://fonts.gstatic.com/s/diskcached/v1/abc.ttf) format("truetype");';
      fetchMock
        .mockResolvedValueOnce(fakeCssResponse(css))
        .mockResolvedValueOnce(fakeBinaryResponse(TTF_BYTES));
      // First call: nothing on disk yet.
      statMock.mockRejectedValueOnce(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
      // Second call: the file from the first download is now "on disk".
      statMock.mockResolvedValueOnce({ isFile: () => true, size: TTF_BYTES.length });
      readFileMock.mockResolvedValueOnce(TTF_BYTES);
      const resolver = new FontResolver();

      const first = await resolver.resolve(family);
      const second = await resolver.resolve(family);

      expect(first).toBe(path.join(CACHE_DIR, 'google_Disk_Cached_Font.ttf'));
      expect(second).toBe(first);
      expect(fetchMock).toHaveBeenCalledTimes(2); // only the first call's CSS + font-file fetch
    });
  });
});
