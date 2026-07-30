/**
 * Reverses "premultiplied alpha" pixel encoding, which some third-party tools
 * output (confirmed empirically for rembg's PNGs) — RGB channels scaled down
 * by `alpha/255` at encode time. The PNG spec (and every standard consumer:
 * browsers, Photopea, node-canvas/Konva, sharp's compositor) expects
 * "straight" alpha instead, where RGB holds the true color regardless of
 * transparency. Left uncorrected, every semi-transparent edge pixel — exactly
 * the pixels that matter most for a soft/furry background-removal cutout —
 * renders as a dark, muddy fringe when composited onto any new background,
 * because the compositor applies the alpha scaling a second time on top of
 * the one already baked into the stored RGB.
 */

/** Duck-typed subset of `ImageData` shared by DOM and node-canvas — no DOM lib dependency needed. */
export interface UnpremultipliableImage {
  data: Uint8ClampedArray | Buffer;
  width: number;
  height: number;
}

/**
 * Un-premultiplies `image` in place. Fully opaque (alpha=255) and fully
 * transparent (alpha=0) pixels are left untouched — there's nothing to
 * recover for the former, and the latter has no defined "true color" to
 * divide out (and would divide by zero).
 */
export function unpremultiplyAlpha(image: UnpremultipliableImage): void {
  const { data } = image;
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3]!;
    if (a === 0 || a === 255) continue;

    const factor = 255 / a;
    data[i] = Math.min(255, Math.round(data[i]! * factor));
    data[i + 1] = Math.min(255, Math.round(data[i + 1]! * factor));
    data[i + 2] = Math.min(255, Math.round(data[i + 2]! * factor));
  }
}
