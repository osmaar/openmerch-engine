/* eslint-disable @typescript-eslint/no-explicit-any */
import { loadImage, createCanvas } from 'canvas';
import type { ImageLayer } from '@openmerch/core';

/**
 * Adds an image layer to a Konva node-side layer.
 *
 * The buffer must be passed in by the caller (resolved separately because the
 * renderer package shouldn't know about MinIO/HTTP). Filters baked into the
 * src by the editor (Brighten, Contrast, etc.) come for free — the editor
 * persists the filtered version into `layer.src`, so we just load it.
 *
 * Tinting is replicated here exactly the same way the editor does
 * (useTintedImage hook): draw the image to a temp canvas and overlay a
 * source-atop fill at the requested opacity.
 */
export async function addImageLayer(
  konvaLayer: any,
  layer: ImageLayer,
  buffer: Buffer,
  pxPerMM: number,
  Konva: any,
): Promise<void> {
  const baseImage = await loadImage(buffer);

  // Apply tint if present (replicates packages/editor/src/hooks/useTintedImage.ts).
  let image: any = baseImage;
  if (layer.tint && layer.tintOpacity && layer.tintOpacity > 0) {
    const tintCanvas = createCanvas(baseImage.width, baseImage.height);
    const ctx = tintCanvas.getContext('2d');
    ctx.drawImage(baseImage, 0, 0);
    ctx.globalCompositeOperation = 'source-atop';
    ctx.globalAlpha = layer.tintOpacity;
    ctx.fillStyle = layer.tint;
    ctx.fillRect(0, 0, tintCanvas.width, tintCanvas.height);
    image = tintCanvas;
  }

  const w = layer.originalWidthMM * pxPerMM;
  const h = layer.originalHeightMM * pxPerMM;

  const node = new Konva.Image({
    image,
    x: layer.x * pxPerMM,
    y: layer.y * pxPerMM,
    width: w,
    height: h,
    rotation: layer.rotation,
    scaleX: layer.scaleX,
    scaleY: layer.scaleY,
    skewX: layer.skewX ?? 0,
    skewY: layer.skewY ?? 0,
    opacity: layer.opacity,
  });

  konvaLayer.add(node);
}
