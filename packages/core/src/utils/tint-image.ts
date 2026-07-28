/**
 * Pure pixel math for the "tint a product image to a customer-chosen color"
 * feature. Both the renderer (Node canvas, server-side admin mockups) and the
 * editor (browser canvas, live preview) need to produce byte-identical output,
 * so the algorithm lives here once and each side only supplies pixels via its
 * own canvas APIs.
 *
 * Algorithm: convert each visible pixel to luminance (perceived brightness),
 * then scale the target color by that luminance. This preserves shading/folds
 * on the base garment photo while recoloring it. Pixels belonging to the
 * photo's background (as opposed to the garment itself) are left untouched so
 * a white studio background doesn't turn into a wall of solid color.
 */

/** Duck-typed subset of `ImageData` shared by DOM and node-canvas — no DOM lib dependency needed. */
export interface TintableImage {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

const TRANSPARENCY_ALPHA_THRESHOLD = 250;
const VISIBLE_ALPHA_THRESHOLD = 10;
const DARK_CORNER_LUMINANCE_THRESHOLD = 50;
const DARK_CORNERS_FOR_DARK_BACKGROUND = 3;
const DARK_PIXEL_THRESHOLD = 40;
const LIGHT_PIXEL_THRESHOLD = 240;

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function luminance(r: number, g: number, b: number): number {
  return r * 0.299 + g * 0.587 + b * 0.114;
}

/** White is the "no tint" product color — the base image is used as-is. */
export function isWhiteTintColor(color: string): boolean {
  return !color || color === '#ffffff' || color === '#FFFFFF';
}

/**
 * Tints `image` in place to `color`, using the same luminance-preserving
 * algorithm on both renderer and editor so the admin mockup matches what the
 * customer saw while designing.
 *
 * - Fully/mostly transparent pixels (alpha < 10) are left untouched.
 * - If the image has any semi-transparent pixels (alpha < 250 anywhere), every
 *   visible pixel is tinted — there's no flat-color background to protect.
 * - Otherwise, the four corners are sampled to guess whether the photo's
 *   background is dark or light, and pixels matching that background color
 *   are skipped so only the garment itself gets recolored.
 */
export function tintImagePixels(image: TintableImage, color: string): void {
  if (isWhiteTintColor(color)) return;

  const [cr, cg, cb] = hexToRgb(color);
  const { data, width, height } = image;

  let hasTransparency = false;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i]! < TRANSPARENCY_ALPHA_THRESHOLD) {
      hasTransparency = true;
      break;
    }
  }

  const corners = [
    0,
    (width - 1) * 4,
    (height - 1) * width * 4,
    ((height - 1) * width + width - 1) * 4,
  ];
  let darkCorners = 0;
  for (const idx of corners) {
    const lum = luminance(data[idx]!, data[idx + 1]!, data[idx + 2]!);
    if (lum < DARK_CORNER_LUMINANCE_THRESHOLD) darkCorners++;
  }
  const hasDarkBackground = darkCorners >= DARK_CORNERS_FOR_DARK_BACKGROUND;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    const a = data[i + 3]!;

    if (a < VISIBLE_ALPHA_THRESHOLD) continue;

    if (!hasTransparency && !hasDarkBackground && r > LIGHT_PIXEL_THRESHOLD && g > LIGHT_PIXEL_THRESHOLD && b > LIGHT_PIXEL_THRESHOLD) {
      continue;
    }
    if (!hasTransparency && hasDarkBackground && r < DARK_PIXEL_THRESHOLD && g < DARK_PIXEL_THRESHOLD && b < DARK_PIXEL_THRESHOLD) {
      continue;
    }

    const lum = luminance(r, g, b);
    data[i] = Math.round((lum / 255) * cr);
    data[i + 1] = Math.round((lum / 255) * cg);
    data[i + 2] = Math.round((lum / 255) * cb);
  }
}
