// Resolves a font family name (as stored in TextLayer.fontFamily) to a local
// file path that node-canvas can `registerFont()` from. Once registered, the
// font is available to Konva.Text by its family name globally in the worker
// process.
//
// Resolution order:
//   1. Custom fonts uploaded by the merchant (fonts table, MinIO)
//   2. Google Fonts — downloaded via the CSS API and cached locally as TTF
//   3. System fonts (Arial, Helvetica, etc.) — return null, node-canvas uses OS

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { fonts } from '../../db/schema.js';
import { minioClient } from '../../storage/minio.js';
import { config } from '../../config.js';

const CACHE_DIR = path.join(os.tmpdir(), 'openmerch-fonts');

// These are available via OS fontconfig — no need to download them.
const SYSTEM_FONTS = new Set([
  'Arial', 'Helvetica', 'Georgia', 'Times New Roman', 'Impact',
  'Courier New', 'Verdana',
]);

export class FontResolver {
  // "<fontId>:<updatedAtMs>" -> in-flight or resolved Promise of the local
  // path (or null). Caching the *Promise* (not the value) deduplicates
  // concurrent loads: when two jobs running in parallel both ask for the same
  // font, the second call awaits the same in-flight promise instead of racing
  // to writeFile and hitting EBUSY on Windows. Versioning the key by
  // `updatedAt` means a replaced font (same id, new file) never resolves to
  // this cache's old entry, without needing an explicit invalidation call.
  private static cache = new Map<string, Promise<string | null>>();
  private static cacheDirReady = false;

  /**
   * Resolves by UUID (preferred — exact, no name-matching issues).
   * Returns a local file path or null.
   */
  async resolveById(fontId: string): Promise<string | null> {
    await this.ensureCacheDir();
    const [row] = await db.select().from(fonts).where(eq(fonts.id, fontId));
    if (!row || !row.fileUrl) {
      console.warn(`[font-resolver] font id "${fontId}" not found or has no fileUrl`);
      return null;
    }
    console.log(`[font-resolver] resolving by id "${fontId}" → "${row.name}"`);
    return this.resolveCustomFontRow({ id: row.id, fileUrl: row.fileUrl, updatedAt: row.updatedAt });
  }

  /**
   * Resolves by CSS family name (fallback for Google Fonts and legacy layers
   * that don't have a fontId stored yet).
   */
  async resolve(family: string): Promise<string | null> {
    await this.ensureCacheDir();

    // System fonts: already available in OS, no registration needed.
    if (SYSTEM_FONTS.has(family)) return null;

    // 1. Look up in the merchant's custom font catalog.
    //    First try exact match; if that fails, try prefix match so that a font
    //    stored as "Lacheyard Script" is found when the layer uses the font
    //    file's internal CSS name "Lacheyard Script PERSONAL USE".
    let [row] = await db.select().from(fonts).where(eq(fonts.name, family));
    if (!row) {
      const allCustom = await db.select().from(fonts);
      const lc = family.toLowerCase();
      const match = allCustom.find(
        (f) => !f.isGoogle && f.fileUrl && lc.startsWith(f.name.toLowerCase()),
      );
      if (match) {
        console.log(`[font-resolver] fuzzy match: "${family}" → DB entry "${match.name}"`);
        row = match;
      }
    }

    if (row) {
      console.log(`[font-resolver] DB hit for "${family}": isGoogle=${row.isGoogle}, fileUrl=${row.fileUrl ?? 'null'}`);
      if (row.fileUrl && !row.isGoogle) {
        return this.resolveCustomFontRow({ id: row.id, fileUrl: row.fileUrl, updatedAt: row.updatedAt });
      }
    } else {
      console.log(`[font-resolver] "${family}" not in DB — trying Google Fonts`);
    }

    // 2. Try Google Fonts — download as TTF and cache locally.
    return this.loadGoogleFont(family);
  }

  /**
   * Looks up (or starts) the in-flight/resolved load for a custom font row,
   * keyed by id AND `updatedAt`. A merchant replacing the font file updates
   * `fileUrl`/`updatedAt` on the same row (PUT /api/v1/fonts/:id) — versioning
   * the cache key this way means the old entry is simply never hit again,
   * with no explicit invalidation call needed.
   */
  private resolveCustomFontRow(row: { id: string; fileUrl: string; updatedAt: Date }): Promise<string | null> {
    const version = new Date(row.updatedAt).getTime();
    const cacheKey = `${row.id}:${version}`;
    const cached = FontResolver.cache.get(cacheKey);
    if (cached) return cached;
    const promise = this.loadFromMinio({ id: row.id, fileUrl: row.fileUrl, version });
    FontResolver.cache.set(cacheKey, promise);
    return promise;
  }

  /** Download a merchant-uploaded font from MinIO. */
  private async loadFromMinio(row: { id: string; fileUrl: string; version: number }): Promise<string | null> {
    const ASSETS_PREFIX = '/api/v1/assets/';
    const idx = row.fileUrl.indexOf(ASSETS_PREFIX);
    if (idx < 0) {
      console.warn(`[font-resolver] fileUrl "${row.fileUrl}" missing "${ASSETS_PREFIX}" — cannot extract MinIO key`);
      return null;
    }
    const storageKey = row.fileUrl.slice(idx + ASSETS_PREFIX.length);

    const ext = path.extname(storageKey) || '.ttf';
    // Filename includes the version so a replaced font (same id) never
    // collides with — or gets served from — the previous file's cache entry.
    const localPath = path.join(CACHE_DIR, `${row.id}-${row.version}${ext}`);

    try {
      const stat = await fs.stat(localPath);
      if (stat.isFile() && stat.size > 0) {
        // Validate cached file — could be a stale WOFF/WOFF2 uploaded by mistake.
        const cached = await fs.readFile(localPath);
        if (this.isSupportedFontFormat(cached)) return localPath;
        console.warn(`[font-resolver] cached custom font "${row.id}" is not TTF/OTF — re-downloading`);
        await fs.unlink(localPath).catch(() => {});
      }
    } catch {
      // File doesn't exist yet — proceed with download.
    }

    try {
      const buffer = await this.downloadFromMinio(storageKey);
      const magic = buffer.length >= 4 ? buffer.slice(0, 4).toString('hex') : 'n/a';
      if (!this.isSupportedFontFormat(buffer)) {
        console.warn(
          `[font-resolver] custom font "${row.id}" (${storageKey}) is not TTF/OTF ` +
          `(magic: ${magic}, ${buffer.length} bytes) — node-canvas only supports TTF/OTF`,
        );
        return null;
      }
      await this.atomicWrite(localPath, buffer);
      console.log(`[font-resolver] cached custom font "${row.id}" → ${localPath} (${buffer.length} bytes, magic: ${magic})`);
      await this.cleanupStaleVersions(row.id, ext, localPath);
      return localPath;
    } catch (err) {
      console.warn(`[font-resolver] failed to load custom font:`, (err as Error).message);
      return null;
    }
  }

  /** Best-effort removal of older cached versions of the same font id. */
  private async cleanupStaleVersions(id: string, ext: string, keepPath: string): Promise<void> {
    try {
      const files = await fs.readdir(CACHE_DIR);
      const prefix = `${id}-`;
      await Promise.all(
        files
          .filter((f) => f.startsWith(prefix) && f.endsWith(ext) && path.join(CACHE_DIR, f) !== keepPath)
          .map((f) => fs.unlink(path.join(CACHE_DIR, f)).catch(() => {})),
      );
    } catch {
      // A leftover stale file just wastes disk — not worth failing the resolve over.
    }
  }

  /**
   * Returns true if the buffer starts with a TTF or OTF magic number.
   * node-canvas/FreeType cannot parse WOFF or WOFF2 — they must be TTF/OTF.
   */
  private isSupportedFontFormat(buf: Buffer): boolean {
    if (buf.length < 4) return false;
    const magic = buf.readUInt32BE(0);
    // Supported: TTF/OTF variants readable by FreeType
    if (
      magic === 0x00010000 || // TrueType
      magic === 0x4F54544F || // "OTTO" — OpenType/CFF
      magic === 0x74727565 || // "true" — old Mac TrueType
      magic === 0x74797031    // "typ1" — PostScript Type 1
    ) return true;
    // Log known unsupported formats for easier diagnosis
    if (magic === 0x774F4646) console.warn('[font-resolver] format WOFF — not supported by node-canvas');
    else if (magic === 0x774F4632) console.warn('[font-resolver] format WOFF2 — not supported by node-canvas');
    else if (buf.readUInt32LE(0) === buf.length) console.warn('[font-resolver] format EOT (Embedded OpenType) — not supported by node-canvas');
    return false;
  }

  /**
   * Download a Google Font as TTF/OTF via the CSS API.
   *
   * We try the CSS API v1 with an IE6 User-Agent which historically returns
   * TTF URLs. If the downloaded bytes turn out to be WOFF/WOFF2 (node-canvas
   * can't use them), we log and return null rather than caching bad data.
   */
  private async loadGoogleFont(family: string): Promise<string | null> {
    const safeName = family.replace(/[^a-zA-Z0-9-_]/g, '_');
    const localPath = path.join(CACHE_DIR, `google_${safeName}.ttf`);

    try {
      const stat = await fs.stat(localPath);
      if (stat.isFile() && stat.size > 0) {
        // Validate cached file — could be a stale WOFF/WOFF2 from an earlier download.
        const cached = await fs.readFile(localPath);
        if (this.isSupportedFontFormat(cached)) return localPath;
        console.warn(`[font-resolver] cached Google Font "${family}" is not TTF/OTF — re-downloading`);
        await fs.unlink(localPath).catch(() => {});
      }
    } catch { /* cached file missing or unreadable — proceed to download */ }

    try {
      // Android 2.2 UA causes Google Fonts to return TTF URLs (the format
      // node-canvas/FreeType can parse). Modern UAs get WOFF2, IE6 gets EOT —
      // both are unsupported by node-canvas.
      const cssUrl = `https://fonts.googleapis.com/css?family=${encodeURIComponent(family)}`;
      const cssRes = await fetch(cssUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Linux; U; Android 2.2; en-US; Nexus One Build/FRF91) AppleWebKit/533.1 (KHTML, like Gecko) Version/4.0 Mobile Safari/533.1',
        },
      });
      if (!cssRes.ok) {
        console.warn(`[font-resolver] Google Fonts CSS fetch failed for "${family}": ${cssRes.status}`);
        return null;
      }
      const css = await cssRes.text();

      // Prefer a URL that explicitly ends in .ttf or .otf; fall back to any
      // gstatic URL if none found (might still be TTF without the extension).
      const ttfMatch = css.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]*\.(?:ttf|otf)[^)]*)\)/i);
      const anyMatch = css.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/);
      const urlMatch = ttfMatch ?? anyMatch;
      if (!urlMatch) {
        console.warn(`[font-resolver] no font URL found in Google Fonts CSS for "${family}"`);
        return null;
      }

      const fontUrl = urlMatch[1]!;
      console.log(`[font-resolver] downloading Google Font "${family}" from: ${fontUrl}`);

      const fontRes = await fetch(fontUrl);
      if (!fontRes.ok) {
        console.warn(`[font-resolver] font file fetch failed: ${fontRes.status} ${fontRes.statusText}`);
        return null;
      }

      const contentType = fontRes.headers.get('content-type') ?? 'unknown';
      const buffer = Buffer.from(await fontRes.arrayBuffer());
      const magic = buffer.length >= 4 ? buffer.slice(0, 4).toString('hex') : 'n/a';
      const firstBytes = buffer.slice(0, 12).toString('hex');
      console.log(`[font-resolver] font file: content-type="${contentType}" magic="${magic}" firstBytes="${firstBytes}" size=${buffer.length}`);

      if (!this.isSupportedFontFormat(buffer)) {
        console.warn(
          `[font-resolver] Google Font "${family}" is not TTF/OTF — cannot use with node-canvas. ` +
          `Try uploading the font manually as a custom font (TTF/OTF file).`,
        );
        return null;
      }

      await this.atomicWrite(localPath, buffer);
      console.log(`[font-resolver] downloaded Google Font "${family}" (${buffer.length} bytes)`);
      return localPath;
    } catch (err) {
      console.warn(`[font-resolver] failed to download Google Font "${family}":`, (err as Error).message);
      return null;
    }
  }

  private async atomicWrite(dest: string, buffer: Buffer): Promise<void> {
    const tmpPath = `${dest}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(tmpPath, buffer);
    try {
      await fs.rename(tmpPath, dest);
    } catch (err) {
      await fs.unlink(tmpPath).catch(() => {});
      const stat = await fs.stat(dest).catch(() => null);
      if (!stat) throw err;
    }
  }

  private async ensureCacheDir(): Promise<void> {
    if (FontResolver.cacheDirReady) return;
    await fs.mkdir(CACHE_DIR, { recursive: true });
    FontResolver.cacheDirReady = true;
  }

  private async downloadFromMinio(key: string): Promise<Buffer> {
    const stream = await minioClient.getObject(config.minio.bucket, key);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    return Buffer.concat(chunks);
  }
}
