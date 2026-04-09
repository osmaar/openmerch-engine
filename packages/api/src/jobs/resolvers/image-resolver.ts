// Resolves a layer's `src` field to a raw image Buffer.
//
// The editor stores image layers with a `src` that can be one of:
//   - `data:image/...;base64,...`           inline base64 (small uploads)
//   - `https?://...`                         external URL (Unsplash, Pollinations, etc.)
//   - `/api/v1/assets/<storageKey>`          internal MinIO asset
//
// The resolver normalizes all three into a Buffer and caches results per job
// so the same image isn't fetched twice. SVG sources are rasterized via sharp
// at high resolution so they don't pixelate when scaled up by Konva.

import sharp from 'sharp';
import { minioClient } from '../../storage/minio.js';
import { config } from '../../config.js';

const ASSETS_PREFIX = '/api/v1/assets/';

// Maximum dimension for SVG rasterization. 4000px on the largest side covers
// any clipart placed at full t-shirt size (200mm @ 300 DPI ≈ 2362px) with
// plenty of headroom for crops and high-DPI export.
const SVG_RASTER_MAX = 4000;

export class ImageResolver {
  private cache = new Map<string, Buffer>();

  async resolve(src: string): Promise<Buffer> {
    const cached = this.cache.get(src);
    if (cached) return cached;

    let buffer: Buffer;

    if (src.startsWith('data:')) {
      buffer = this.fromDataUrl(src);
    } else if (src.startsWith(ASSETS_PREFIX) || src.includes(ASSETS_PREFIX)) {
      // Match either a relative path or an absolute URL like
      // http://localhost:3001/api/v1/assets/...
      const idx = src.indexOf(ASSETS_PREFIX);
      const key = src.slice(idx + ASSETS_PREFIX.length);
      buffer = await this.fromMinio(key);
    } else if (src.startsWith('http://') || src.startsWith('https://')) {
      buffer = await this.fromHttp(src);
    } else {
      throw new Error(`Unsupported image src: ${src.slice(0, 100)}`);
    }

    // If the buffer is an SVG, rasterize it to a high-resolution PNG before
    // handing it to Konva. node-canvas (and most image libraries) rasterize
    // SVG at the SVG's intrinsic dimensions, which for a 24×24 icon means
    // a 24×24 bitmap that pixelates at any larger size. We rasterize at
    // SVG_RASTER_MAX so it stays sharp at the print size.
    if (this.looksLikeSvg(buffer)) {
      buffer = await this.rasterizeSvg(buffer);
    }

    this.cache.set(src, buffer);
    return buffer;
  }

  private looksLikeSvg(buffer: Buffer): boolean {
    // Check the first few hundred bytes for an SVG signature. SVG files can
    // start with `<?xml`, `<!DOCTYPE`, or directly with `<svg`.
    const head = buffer.subarray(0, 512).toString('utf-8').trimStart().toLowerCase();
    return head.startsWith('<svg') || head.startsWith('<?xml') || head.startsWith('<!doctype');
  }

  private async rasterizeSvg(svgBuffer: Buffer): Promise<Buffer> {
    // Sharp rasterizes SVG via librsvg with a tunable density. Asking for
    // a large output and letting sharp pick the optimal density gives us
    // a crisp PNG without manual SVG editing.
    return sharp(svgBuffer, { density: 300 })
      .resize({
        width: SVG_RASTER_MAX,
        height: SVG_RASTER_MAX,
        fit: 'inside',
        withoutEnlargement: false,
      })
      .png()
      .toBuffer();
  }

  private fromDataUrl(src: string): Buffer {
    const comma = src.indexOf(',');
    if (comma < 0) throw new Error('Malformed data URL');
    const meta = src.slice(0, comma);
    const data = src.slice(comma + 1);
    if (meta.includes(';base64')) {
      return Buffer.from(data, 'base64');
    }
    return Buffer.from(decodeURIComponent(data), 'utf-8');
  }

  private async fromMinio(key: string): Promise<Buffer> {
    const stream = await minioClient.getObject(config.minio.bucket, key);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    return Buffer.concat(chunks);
  }

  private async fromHttp(url: string): Promise<Buffer> {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to fetch image ${url}: ${res.status} ${res.statusText}`);
    }
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}
