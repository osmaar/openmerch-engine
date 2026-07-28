import {
  mmToPx,
  tintImagePixels,
  isWhiteTintColor,
  applyDisplacementMap,
  MAX_RENDER_DIMENSION_PX,
  MM_PER_INCH,
} from '@openmerch/core';
import type { DesignLayer, DisplaceableImage, ImageLayer, ProductZone, ShapeLayer, TextLayer } from '@openmerch/core';
import { addShapeLayer } from './layers/shape.js';
import { addImageLayer } from './layers/image.js';
import { addTextLayer, registerFontsForTextLayers } from './layers/text.js';
import { getKonvaNode, getNodeCanvas } from './konva-node.js';
import type { KonvaImageSource, KonvaLayer, KonvaModule } from './konva-types.js';
import type { ImageBufferResolver, FontPathResolver } from './render-zone.js';
import { loadImage, createCanvas } from 'canvas';

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
  if (widthPx > MAX_RENDER_DIMENSION_PX || heightPx > MAX_RENDER_DIMENSION_PX) {
    throw new Error(
      `renderDesignZoneMockup: zone "${options.zone.id}" would render at ${widthPx}x${heightPx}px ` +
        `(dpi=${dpi}), exceeding the ${MAX_RENDER_DIMENSION_PX}px maximum per side. ` +
        `Check the product's baseImageWidthMM/baseImageHeightMM.`,
    );
  }
  const pxPerMM = dpi / MM_PER_INCH;

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

      let imageSource: KonvaImageSource = baseImage;

      if (options.productColor && !isWhiteTintColor(options.productColor)) {
        // Apply the same tint algorithm as the editor (packages/core's
        // tintImagePixels) so the admin mockup matches what the customer saw
        // when they picked their product color.
        const offscreen = createCanvas(baseImage.width, baseImage.height);
        const ctx = offscreen.getContext('2d');
        ctx.drawImage(baseImage, 0, 0);
        const imageData = ctx.getImageData(0, 0, offscreen.width, offscreen.height);
        tintImagePixels(imageData, options.productColor);
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

  const displacementMapUrl = options.zone.displacementMapUrl;
  const resolveImage = options.resolveImage;

  if (displacementMapUrl && resolveImage) {
    await drawDisplacedDesignGroup({
      Konva,
      layer,
      layers: options.layers,
      resolveImage,
      resolveFont: options.resolveFont,
      pxPerMM,
      offsetX,
      offsetY,
      clipWidthPx,
      clipHeightPx,
      displacementMapUrl,
      displacementStrengthMM: options.zone.displacementStrengthMM,
    });
  } else {
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
        if (!resolveImage) continue;
        const buffer = await resolveImage((designLayer as ImageLayer).src);
        await addImageLayer(designGroup, designLayer as ImageLayer, buffer, pxPerMM, Konva);
      } else if (designLayer.type === 'text') {
        const textLayer = designLayer as TextLayer;
        const fontPath = options.resolveFont
          ? await options.resolveFont(textLayer.fontFamily)
          : null;
        addTextLayer(designGroup, textLayer, fontPath, pxPerMM, Konva);
      }
    }
  }

  // 3. Draw product overlay ON TOP of designs (camera cutout, edges, bumper).
  //    Transparent areas let the design show through.
  if (options.resolveImage && options.zone.overlayImageUrl) {
    try {
      const overlayBuffer = await options.resolveImage(options.zone.overlayImageUrl);
      const overlayImg = await loadImage(overlayBuffer);
      const overlayNode = new Konva.Image({
        image: overlayImg,
        x: 0,
        y: 0,
        width: widthPx,
        height: heightPx,
      });
      layer.add(overlayNode);
    } catch (err) {
      console.warn('[mockup] failed to load overlay image:', (err as Error).message);
    }
  }

  layer.draw();

  const nodeCanvas = getNodeCanvas(stage);
  const buffer = nodeCanvas.toBuffer('image/png', { compressionLevel: 9 });

  return { buffer, widthPx, heightPx, dpi };
}

interface DrawDisplacedDesignGroupOptions {
  Konva: KonvaModule;
  /** The mockup's main layer — the finished, cropped design image is added here. */
  layer: KonvaLayer;
  layers: DesignLayer[];
  resolveImage: ImageBufferResolver;
  resolveFont?: FontPathResolver;
  pxPerMM: number;
  offsetX: number;
  offsetY: number;
  clipWidthPx: number;
  clipHeightPx: number;
  displacementMapUrl: string;
  displacementStrengthMM?: number;
}

/**
 * Renders the design layers to an offscreen canvas, runs the result through
 * `applyDisplacementMap`, and adds the finished bitmap to `layer` in place of
 * the plain clipped design Group — this is what makes the design appear to
 * follow the garment's fabric folds instead of sitting flat on top.
 *
 * The offscreen canvas is drawn `padPx` larger than the print area on every
 * side, with every design layer shifted inward by `padPx`, before the crop
 * back down to size. This margin exists solely so `applyDisplacementMap`'s
 * clamp-to-edge sampling has real design pixels to read from near the print
 * area's border — without it, displacement near an edge would sample (and
 * stretch) the print area's own boundary pixels, showing up as a visibly
 * smeared strip along the crop.
 */
async function drawDisplacedDesignGroup(options: DrawDisplacedDesignGroupOptions): Promise<void> {
  const {
    Konva,
    layer,
    layers,
    resolveImage,
    resolveFont,
    pxPerMM,
    offsetX,
    offsetY,
    clipWidthPx,
    clipHeightPx,
    displacementMapUrl,
    displacementStrengthMM,
  } = options;

  const strengthPx = (displacementStrengthMM ?? 0) * pxPerMM;
  const padPx = Math.ceil(strengthPx);

  const designWidthPx = Math.round(clipWidthPx);
  const designHeightPx = Math.round(clipHeightPx);
  const paddedWidthPx = designWidthPx + 2 * padPx;
  const paddedHeightPx = designHeightPx + 2 * padPx;

  const offscreenStage = new Konva.Stage({ width: paddedWidthPx, height: paddedHeightPx });
  const offscreenLayer = new Konva.Layer();
  offscreenStage.add(offscreenLayer);

  // All design layers are added to this offset wrapper (instead of directly to
  // offscreenLayer) so every layer lands padPx to the right/down of where it
  // would sit on the real print area — see the padding rationale above.
  const paddedGroup = new Konva.Group({ x: padPx, y: padPx });
  offscreenLayer.add(paddedGroup);

  for (const designLayer of layers) {
    if (designLayer.visible === false) continue;

    if (designLayer.type === 'shape') {
      addShapeLayer(paddedGroup, designLayer as ShapeLayer, pxPerMM, Konva);
    } else if (designLayer.type === 'image') {
      const buffer = await resolveImage((designLayer as ImageLayer).src);
      await addImageLayer(paddedGroup, designLayer as ImageLayer, buffer, pxPerMM, Konva);
    } else if (designLayer.type === 'text') {
      const textLayer = designLayer as TextLayer;
      const fontPath = resolveFont ? await resolveFont(textLayer.fontFamily) : null;
      addTextLayer(paddedGroup, textLayer, fontPath, pxPerMM, Konva);
    }
  }

  offscreenLayer.draw();
  const offscreenCanvas = getNodeCanvas(offscreenStage);
  const offscreenCtx = offscreenCanvas.getContext('2d');
  const designImageData: DisplaceableImage = offscreenCtx.getImageData(0, 0, paddedWidthPx, paddedHeightPx);

  const mapBuffer = await resolveImage(displacementMapUrl);
  const mapImage = await loadImage(mapBuffer);
  const mapCanvas = createCanvas(paddedWidthPx, paddedHeightPx);
  const mapCtx = mapCanvas.getContext('2d');
  // The map asset may be a different resolution than the padded design area —
  // stretch it to cover exactly the padded canvas so it samples 1:1 against
  // designImageData (applyDisplacementMap already bilinearly resamples the
  // map internally, so this stretch doesn't lose precision beyond that).
  mapCtx.drawImage(mapImage, 0, 0, paddedWidthPx, paddedHeightPx);
  const mapImageData: DisplaceableImage = mapCtx.getImageData(0, 0, paddedWidthPx, paddedHeightPx);

  applyDisplacementMap(designImageData, mapImageData, strengthPx);
  offscreenCtx.putImageData(designImageData, 0, 0);

  // Crop the padding back off: only the centered designWidthPx x designHeightPx
  // region — the actual print area — belongs in the mockup.
  const croppedCanvas = createCanvas(designWidthPx, designHeightPx);
  const croppedCtx = croppedCanvas.getContext('2d');
  croppedCtx.drawImage(offscreenCanvas, -padPx, -padPx);

  const designNode = new Konva.Image({
    image: croppedCanvas,
    x: offsetX * pxPerMM,
    y: offsetY * pxPerMM,
    width: designWidthPx,
    height: designHeightPx,
  });
  layer.add(designNode);
}
