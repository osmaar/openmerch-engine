/**
 * Pure pixel math for the "fabric follows the design" preview effect. A
 * displacement map is a two-channel PNG (R = horizontal displacement,
 * G = horizontal displacement's vertical counterpart, both centered at 128 =
 * no displacement) — the same format Photoshop's `Filter > Distort >
 * Displace` consumes. Painting the map from a photo/scan of the actual
 * fabric's folds and wrinkles lets a flat design appear to bend with the
 * garment when composited into the mockup.
 *
 * This is a PREVIEW-ONLY effect. It is applied to the mockup/editor preview
 * compositing so the customer sees a realistic garment render; it must never
 * be applied to the print-ready file handed to production, which stays a
 * flat, undistorted design.
 *
 * Both the renderer (Node canvas, server-side admin mockups) and the editor
 * (browser canvas, live preview) need byte-identical output, so — same as
 * {@link tintImagePixels} — the algorithm lives here once and each side only
 * supplies pixels via its own canvas APIs.
 */

/** Duck-typed subset of `ImageData` shared by DOM and node-canvas — no DOM lib dependency needed. */
export interface DisplaceableImage {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

const CENTER = 128;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Bilinearly samples the R and G channels of `map` at the normalized UV
 * coordinate `(u, v)` (each in `[0, 1]`), returning raw channel values in
 * `[0, 255]`. `map` may have a different resolution than the image being
 * displaced, so the sample coordinate is derived from `map`'s own dimensions.
 */
function sampleMapBilinear(map: DisplaceableImage, u: number, v: number): { r: number; g: number } {
  const fx = clamp(u * map.width, 0, map.width - 1);
  const fy = clamp(v * map.height, 0, map.height - 1);

  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const x1 = Math.min(x0 + 1, map.width - 1);
  const y1 = Math.min(y0 + 1, map.height - 1);

  const tx = fx - x0;
  const ty = fy - y0;

  const i00 = (y0 * map.width + x0) * 4;
  const i10 = (y0 * map.width + x1) * 4;
  const i01 = (y1 * map.width + x0) * 4;
  const i11 = (y1 * map.width + x1) * 4;

  const r00 = map.data[i00]!;
  const r10 = map.data[i10]!;
  const r01 = map.data[i01]!;
  const r11 = map.data[i11]!;
  const g00 = map.data[i00 + 1]!;
  const g10 = map.data[i10 + 1]!;
  const g01 = map.data[i01 + 1]!;
  const g11 = map.data[i11 + 1]!;

  const rTop = r00 + (r10 - r00) * tx;
  const rBottom = r01 + (r11 - r01) * tx;
  const r = rTop + (rBottom - rTop) * ty;

  const gTop = g00 + (g10 - g00) * tx;
  const gBottom = g01 + (g11 - g01) * tx;
  const g = gTop + (gBottom - gTop) * ty;

  return { r, g };
}

/**
 * Displaces `image` in place following `map`, a two-channel (R=horizontal,
 * G=vertical) displacement map — see the module doc for the format.
 *
 * For each output pixel `(x, y)`:
 * - `map` is sampled with bilinear interpolation at the normalized UV
 *   coordinate `(x / image.width, y / image.height)`, since `map` may have a
 *   different resolution than `image`.
 * - `dx = (mapR - 128) / 128 * strengthPx`, `dy = (mapG - 128) / 128 * strengthPx`.
 * - The output pixel is the source pixel of `image` nearest to `(x + dx, y + dy)`
 *   (rounded to the nearest integer coordinate), clamped to `image`'s edges
 *   (clamp-to-edge — never wraps, never produces transparent edges).
 * - The full RGBA pixel (including alpha) is displaced, so a shape's edge
 *   carries its transparency with it instead of leaving a ghost behind.
 *
 * `image.data` is read from and written to at different coordinates, so this
 * clones the original pixels into an internal source buffer first — mutating
 * `image.data` directly while reading from it would corrupt pixels that have
 * already been displaced.
 */
export function applyDisplacementMap(image: DisplaceableImage, map: DisplaceableImage, strengthPx: number): void {
  const { width, height } = image;
  const source = Uint8ClampedArray.from(image.data);
  const dest = image.data;

  for (let y = 0; y < height; y++) {
    const v = y / height;
    for (let x = 0; x < width; x++) {
      const u = x / width;
      const { r: mapR, g: mapG } = sampleMapBilinear(map, u, v);

      const dx = ((mapR - CENTER) / CENTER) * strengthPx;
      const dy = ((mapG - CENTER) / CENTER) * strengthPx;

      const srcX = clamp(Math.round(x + dx), 0, width - 1);
      const srcY = clamp(Math.round(y + dy), 0, height - 1);

      const srcIdx = (srcY * width + srcX) * 4;
      const outIdx = (y * width + x) * 4;
      dest[outIdx] = source[srcIdx]!;
      dest[outIdx + 1] = source[srcIdx + 1]!;
      dest[outIdx + 2] = source[srcIdx + 2]!;
      dest[outIdx + 3] = source[srcIdx + 3]!;
    }
  }
}
