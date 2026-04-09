import { mmToPx } from '@openmerch/core';
import type { DesignLayer, ImageLayer, ProductZone, ShapeLayer, TextLayer } from '@openmerch/core';
import { addShapeLayer } from './layers/shape.js';
import { addImageLayer } from './layers/image.js';
import { addTextLayer, registerFontsForTextLayers } from './layers/text.js';
import { getKonvaNode, getNodeCanvas } from './konva-node.js';
import type { ImageBufferResolver, FontPathResolver } from './render-zone.js';
import { loadImage, createCanvas } from 'canvas';

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/**
 * Applies the same luminance-based tint as the editor's `useColoredProduct`
 * hook so the admin mockup reflects the customer's chosen product color.
 */
function tintImage(src: { data: Uint8ClampedArray; width: number; height: number }, color: string): void {
  if (!color || color === '#ffffff' || color === '#FFFFFF') return;
  const [cr, cg, cb] = hexToRgb(color);
  const { data, width, height } = src;

  // Detect transparency
  let hasTransparency = false;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i]! < 250) { hasTransparency = true; break; }
  }

  // Detect dark background (sample corners)
  const corners = [0, (width - 1) * 4, (height - 1) * width * 4, ((height - 1) * width + width - 1) * 4];
  let darkCorners = 0;
  for (const idx of corners) {
    const lum = data[idx]! * 0.299 + data[idx + 1]! * 0.587 + data[idx + 2]! * 0.114;
    if (lum < 50) darkCorners++;
  }
  const hasDarkBg = darkCorners >= 3;
  const DARK = 40, LIGHT = 240;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]!, g = data[i + 1]!, b = data[i + 2]!, a = data[i + 3]!;
    if (a < 10) continue;
    if (!hasTransparency && !hasDarkBg && r > LIGHT && g > LIGHT && b > LIGHT) continue;
    if (!hasTransparency && hasDarkBg && r < DARK && g < DARK && b < DARK) continue;
    const lum = r * 0.299 + g * 0.587 + b * 0.114;
    data[i] = Math.round((lum / 255) * cr);
    data[i + 1] = Math.round((lum / 255) * cg);
    data[i + 2] = Math.round((lum / 255) * cb);
  }
}

export interface RenderZoneMockupOptions {
  zone: ProductZone;
  layers: DesignLayer[];
  /**
   * Mockup output DPI. Lower than print output (default 96) — this image is
   * for visual reference (the merchant viewing the order in admin), not for
   * the printer. Smaller files, faster generation.
   */
  dpi?: number;
  resolveImage?: ImageBufferResolver;
  resolveFont?: FontPathResolver;
  resolveFontById?: FontPathResolver;
  /** Hex color the customer chose for the product (e.g. "#FF69B4"). Applied as
   *  a luminance-preserving tint to the base image, same algorithm as the
   *  editor's useColoredProduct hook so admin and editor views match. */
  productColor?: string;
}

export interface RenderZoneMockupResult {
  buffer: Buffer;
  widthPx: number;
  heightPx: number;
  dpi: number;
}

/**
 * Renders the merchant-facing mockup PNG for a product zone: the product base
 * image with the customer's design composited on top inside the print area.
 *
 * Unlike `renderDesignZone` (which outputs only the bare print artwork at
 * 300 DPI on a transparent background), this output gives the merchant
 * visual context — they can immediately see what the printed product will
 * look like, where the design sits, and how big it is relative to the garment.
 *
 * Coordinate system:
 *   - The full canvas matches the product's `baseImageWidthMM × baseImageHeightMM`
 *   - The product base image is drawn covering the whole canvas
 *   - Each layer's `(x, y)` is print-area-local in MM, so it's offset by
 *     `(printAreaXMM, printAreaYMM)` to land in the right spot on the mockup
 */
export async function renderDesignZoneMockup(
  options: RenderZoneMockupOptions,
): Promise<RenderZoneMockupResult> {
  const dpi = options.dpi ?? 96;
  const Konva = await getKonvaNode();

  const widthPx = Math.round(mmToPx(options.zone.baseImageWidthMM, dpi));
  const heightPx = Math.round(mmToPx(options.zone.baseImageHeightMM, dpi));
  const pxPerMM = dpi / 25.4;

  // Pre-register all fonts BEFORE creating the Stage (same constraint as render-zone.ts).
  if (options.resolveFont) {
    const textLayers = options.layers.filter((l) => l.type === 'text') as TextLayer[];
    await registerFontsForTextLayers(textLayers, options.resolveFont, options.resolveFontById);
  }

  const stage = new Konva.Stage({ width: widthPx, height: heightPx });
  const layer = new Konva.Layer();
  stage.add(layer);

  // 1. Draw the product base image as the background (with optional color tint).
  if (options.resolveImage && options.zone.baseImageUrl) {
    try {
      const baseBuffer = await options.resolveImage(options.zone.baseImageUrl);
      const baseImage = await loadImage(baseBuffer);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let imageSource: any = baseImage;

      if (options.productColor && options.productColor !== '#ffffff' && options.productColor !== '#FFFFFF') {
        // Apply the same tint algorithm as the editor so admin mockup matches
        // what the customer saw when they picked their product color.
        const offscreen = createCanvas(baseImage.width, baseImage.height);
        const ctx = offscreen.getContext('2d');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ctx.drawImage(baseImage as any, 0, 0);
        const imageData = ctx.getImageData(0, 0, offscreen.width, offscreen.height);
        tintImage(imageData, options.productColor);
        ctx.putImageData(imageData, 0, 0);
        imageSource = offscreen;
      }

      const baseNode = new Konva.Image({
        image: imageSource,
        x: 0,
        y: 0,
        width: widthPx,
        height: heightPx,
      });
      layer.add(baseNode);
    } catch (err) {
      console.warn(`[mockup] failed to load base image:`, (err as Error).message);
    }
  }

  // 2. Draw design layers inside a clipped Group positioned at the print area.
  //    The clip ensures no layer content bleeds outside the print zone, even if
  //    a layer (e.g. a full-background image) is larger than the print area.
  const offsetX = options.zone.printAreaXMM;
  const offsetY = options.zone.printAreaYMM;
  const clipWidthPx = options.zone.printAreaWidthMM * pxPerMM;
  const clipHeightPx = options.zone.printAreaHeightMM * pxPerMM;

  const designGroup = new Konva.Group({
    x: offsetX * pxPerMM,
    y: offsetY * pxPerMM,
    clipX: 0,
    clipY: 0,
    clipWidth: clipWidthPx,
    clipHeight: clipHeightPx,
  });
  layer.add(designGroup);

  for (const designLayer of options.layers) {
    if (designLayer.visible === false) continue;

    if (designLayer.type === 'shape') {
      addShapeLayer(designGroup, designLayer as ShapeLayer, pxPerMM, Konva);
    } else if (designLayer.type === 'image') {
      if (!options.resolveImage) continue;
      const buffer = await options.resolveImage((designLayer as ImageLayer).src);
      await addImageLayer(designGroup, designLayer as ImageLayer, buffer, pxPerMM, Konva);
    } else if (designLayer.type === 'text') {
      const textLayer = designLayer as TextLayer;
      const fontPath = options.resolveFont
        ? await options.resolveFont(textLayer.fontFamily)
        : null;
      addTextLayer(designGroup, textLayer, fontPath, pxPerMM, Konva);
    }
  }

  layer.draw();

  const nodeCanvas = getNodeCanvas(stage);
  const buffer = nodeCanvas.toBuffer('image/png', { compressionLevel: 9 });

  return { buffer, widthPx, heightPx, dpi };
}
