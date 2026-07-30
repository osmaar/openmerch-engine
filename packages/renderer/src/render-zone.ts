import { mmToPx, resolvePrintDpi, MM_PER_INCH } from '@openmerch/core';
import type { DesignLayer, ImageLayer, ProductZone, ShapeLayer, TextLayer } from '@openmerch/core';
import { addShapeLayer } from './layers/shape.js';
import { addImageLayer } from './layers/image.js';
import { addTextLayer, registerFontsForTextLayers } from './layers/text.js';
import { getKonvaNode, getNodeCanvas } from './konva-node.js';

/** Caller-provided resolver that turns a layer's `src` into a raw Buffer. */
export type ImageBufferResolver = (src: string) => Promise<Buffer>;

/**
 * Caller-provided resolver that returns a local font file path for a font
 * family, or null if the font isn't available (in which case node-canvas falls
 * back to a system font).
 */
export type FontPathResolver = (family: string) => Promise<string | null>;

export interface RenderZoneOptions {
  /** The product zone we're rendering. Defines printAreaWidthMM/HeightMM. */
  zone: ProductZone;
  /** Layers from the design's zone, already in MM relative to the print area top-left. */
  layers: DesignLayer[];
  /** Output DPI. Defaults to 300 (industry print standard). */
  dpi?: number;
  /**
   * Resolves a layer.src to a Buffer. Required if the layers contain any
   * ImageLayer. The renderer package stays free of MinIO/HTTP coupling by
   * delegating this to the caller.
   */
  resolveImage?: ImageBufferResolver;
  /**
   * Resolves a font family to a local font file path. Required if the layers
   * contain any TextLayer with a custom font. Returning null is OK (system fallback).
   */
  resolveFont?: FontPathResolver;
  /** UUID-based font resolver. When a layer has fontId set, this is used
   *  instead of resolveFont to avoid CSS-name matching issues. */
  resolveFontById?: FontPathResolver;
}

export interface RenderZoneResult {
  /** PNG buffer encoded with the DPI baked into pHYs metadata. */
  buffer: Buffer;
  /** Pixel dimensions of the produced image. */
  widthPx: number;
  heightPx: number;
  /** DPI used. */
  dpi: number;
}

/**
 * Renders a single product zone (front, back, etc.) to a print-ready PNG buffer.
 * Coordinate system: layer.x/y/widthMM/heightMM are in MILLIMETERS relative to
 * the print area top-left. We convert to pixels using `dpi` and feed to Konva.
 *
 * Step 4 (this PR) adds ImageLayer. Step 5 will add TextLayer.
 */
export async function renderDesignZone(options: RenderZoneOptions): Promise<RenderZoneResult> {
  // zone.printDPI (merchant-configured, e.g. a specific print vendor's requirement)
  // wins over the caller's default; if it doesn't fit the zone's physical size, that's
  // a hard error — an explicit request should never be silently changed. Without an
  // explicit printDPI, an oversized zone (desk mats, mousepads, posters) is
  // automatically rendered at the highest DPI that still fits, rather than rejected.
  const explicitDpi = options.zone.printDPI;
  const requestedDpi = explicitDpi ?? options.dpi ?? 300;
  const { dpi, wasClamped } = resolvePrintDpi(
    options.zone.printAreaWidthMM,
    options.zone.printAreaHeightMM,
    requestedDpi,
  );

  if (wasClamped && explicitDpi != null) {
    const widthPx = Math.round(mmToPx(options.zone.printAreaWidthMM, explicitDpi));
    const heightPx = Math.round(mmToPx(options.zone.printAreaHeightMM, explicitDpi));
    throw new Error(
      `renderDesignZone: zone "${options.zone.id}" has printDPI=${explicitDpi} explicitly set, but that ` +
        `would render at ${widthPx}x${heightPx}px, exceeding the safe canvas limit. Lower printDPI for ` +
        `this zone, or unset it to use the automatic DPI (currently would resolve to ${dpi}).`,
    );
  }

  const Konva = await getKonvaNode();
  const widthPx = Math.round(mmToPx(options.zone.printAreaWidthMM, dpi));
  const heightPx = Math.round(mmToPx(options.zone.printAreaHeightMM, dpi));
  const pxPerMM = dpi / MM_PER_INCH;

  // Pre-register all fonts BEFORE creating the Stage. node-canvas requires
  // registerFont() to be called before any canvas is instantiated — calling
  // it later (e.g. inside addTextLayer) has no effect on already-created canvases.
  if (options.resolveFont) {
    const textLayers = options.layers.filter((l) => l.type === 'text') as TextLayer[];
    await registerFontsForTextLayers(textLayers, options.resolveFont, options.resolveFontById);
  }

  const stage = new Konva.Stage({ width: widthPx, height: heightPx });
  const layer = new Konva.Layer();
  stage.add(layer);

  // Render each design layer in document order (first layer = bottom).
  for (const designLayer of options.layers) {
    if (designLayer.visible === false) continue;

    if (designLayer.type === 'shape') {
      addShapeLayer(layer, designLayer as ShapeLayer, pxPerMM, Konva);
    } else if (designLayer.type === 'image') {
      if (!options.resolveImage) {
        throw new Error('renderDesignZone: image layer requires resolveImage option');
      }
      const imageLayer = designLayer as ImageLayer;
      const buffer = await options.resolveImage(imageLayer.src);
      await addImageLayer(layer, imageLayer, buffer, pxPerMM, Konva);
    } else if (designLayer.type === 'text') {
      const textLayer = designLayer as TextLayer;
      const fontPath = options.resolveFont
        ? await options.resolveFont(textLayer.fontFamily)
        : null;
      addTextLayer(layer, textLayer, fontPath, pxPerMM, Konva);
    }
  }

  layer.draw();

  const nodeCanvas = getNodeCanvas(stage);
  const buffer = nodeCanvas.toBuffer('image/png', { compressionLevel: 9 });

  return { buffer, widthPx, heightPx, dpi };
}
