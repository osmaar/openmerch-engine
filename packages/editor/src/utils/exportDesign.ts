import type { DesignExportMeta } from '@openmerch/core';
import { useEditorStore } from '../store/editorStore.js';

interface ExportOptions {
  format: 'png' | 'svg';
  includeBase: boolean;
  hideOverflow: boolean;
  includeBack?: boolean;
  dpi?: number;
  /**
   * True only for the "Add to Cart" export (see NavBar.tsx) — the one export call that's
   * actually meant to hand the design off to a host storefront instead of downloading it
   * to the customer's own device. Every other caller (the Print/Download menu,
   * Ctrl+Shift+S, Ctrl+P) always downloads locally, even when embedded — without this
   * flag, ALL of them shared the same `onExportCallback` hand-off unconditionally, so
   * clicking "Print" while embedded silently uploaded the design and fired the same
   * postMessage the host's `openmerch:export` listener treats as "add to cart" (see
   * openmerch-embed.js's addToCart()) — no download ever appeared, and an item could get
   * added to the WooCommerce cart the customer never asked to add.
   */
  forHost?: boolean;
}

/** Characters that don't survive a filesystem path unescaped, replaced with "-". */
const UNSAFE_FILENAME_CHARS = /[^a-z0-9_-]+/gi;

function slugifyForFilename(value: string): string {
  return value.replace(UNSAFE_FILENAME_CHARS, '-');
}

/**
 * `{producto}_{variante}_{designKey}` — lets merchants match a downloaded
 * file back to the exact product/variant/design it came from without opening
 * it. Falls back to "product"/"default" when a product or variant isn't set
 * (e.g. single-variant products never populate `selectedVariantId`). Takes
 * `designKey` as a parameter (rather than resolving it itself) so callers
 * that also need it for {@link DesignExportMeta} — see `deliverExportBlob` —
 * use the exact same value instead of each minting their own fallback UUID.
 */
function buildExportFilename(designKey: string): string {
  const { product, selectedVariantId } = useEditorStore.getState();
  const productPart = slugifyForFilename(product?.slug ?? 'product');
  const variantPart = slugifyForFilename(selectedVariantId ?? 'default');
  return `${productPart}_${variantPart}_${designKey}`;
}

/**
 * Pure assembly of the {@link DesignExportMeta} handed to `onExport` —
 * split out from `deliverExportBlob` so it's unit-testable without mocking
 * `HTMLCanvasElement.toBlob`/jsdom.
 */
export function buildExportMeta(
  layout: CanvasLayout,
  filename: string,
  designKey: string,
  productId: string,
  variantId: string | null,
): DesignExportMeta {
  return {
    designKey,
    filename: `${filename}.png`,
    widthMm: layout.printW / layout.pxPerMM,
    heightMm: layout.printH / layout.pxPerMM,
    productId,
    ...(variantId ? { variantId } : {}),
  };
}

/**
 * If `forHost` is true (the "Add to Cart" export only — see `ExportOptions.forHost`) and
 * the host embedding the editor supplied an `onExport` callback (wired through
 * `ProductEditor`'s prop into `onExportCallback` in the store), hand it the final
 * composited PNG as a `Blob` alongside sizing/identity metadata — the prerequisite for an
 * external storefront to pick up the finished design without the editor knowing anything
 * about carts/checkout.
 *
 * Returns whether the callback actually ran. Callers use this to skip the browser-download
 * path when it did — an embedded storefront's customer clicking "Add to Cart" should never
 * also trigger a random file download; the callback takes full ownership of the export in
 * that case. Every other export (Print/Download menu, keyboard shortcuts) always downloads
 * locally instead, even when embedded, since `forHost` is false for those.
 */
async function deliverExportBlob(
  canvas: HTMLCanvasElement,
  layout: CanvasLayout,
  filename: string,
  designKey: string,
  forHost: boolean,
): Promise<boolean> {
  const { onExportCallback, product, selectedVariantId } = useEditorStore.getState();
  if (!forHost || !onExportCallback) return false;

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) return false;

  await onExportCallback(blob, buildExportMeta(layout, filename, designKey, product?.id ?? '', selectedVariantId));
  return true;
}

export async function exportDesign(options: ExportOptions): Promise<void> {
  const { stageRef, canvasLayout, showPrintZone } = useEditorStore.getState();

  if (!stageRef?.current || !canvasLayout) {
    throw new Error('Canvas not ready');
  }

  const stage = stageRef.current as KonvaStage & {
    scaleX: () => number;
    scaleY: () => number;
    x: () => number;
    y: () => number;
    scale: (s: { x: number; y: number }) => void;
    position: (p: { x: number; y: number }) => void;
  };

  // Temporarily hide print zone guides
  const wasShowingPrintZone = showPrintZone;
  if (wasShowingPrintZone) {
    useEditorStore.setState({ showPrintZone: false });
  }

  // Deselect to remove transformer handles
  const selectedId = useEditorStore.getState().selectedLayerId;
  if (selectedId) {
    useEditorStore.getState().selectLayer(null);
  }

  // Save and reset zoom/pan to ensure export is at 100%
  const savedScale = { x: stage.scaleX(), y: stage.scaleY() };
  const savedPosition = { x: stage.x(), y: stage.y() };
  stage.scale({ x: 1, y: 1 });
  stage.position({ x: 0, y: 0 });

  await new Promise((r) => setTimeout(r, 200));

  try {
    // Export current zone
    const currentZone = useEditorStore.getState().activeZoneId;
    // Shared across front+back so both files' names and (if `onExport` is
    // wired up) both DesignExportMeta.designKey values agree — otherwise a
    // saveless design would mint a different random UUID for each side.
    const designKey = useEditorStore.getState().design?.id ?? crypto.randomUUID();
    const baseFilename = buildExportFilename(designKey);
    // Only disambiguate with the zone id when both sides are being exported —
    // otherwise front/back would download as two files with the identical name.
    const filename = options.includeBack ? `${baseFilename}_${currentZone}` : baseFilename;

    if (options.includeBase) {
      await exportMockupPreview(stage, canvasLayout, options, filename, designKey);
    } else {
      await exportDesignOnly(stage, canvasLayout, options, filename, designKey);
    }

    // Export back zone if requested
    if (options.includeBack) {
      const product = useEditorStore.getState().product;
      if (product && product.zones.length > 1) {
        const otherZone = product.zones.find((z) => z.id !== currentZone);
        if (otherZone) {
          // Switch to other zone
          useEditorStore.getState().setActiveZone(otherZone.id);
          await new Promise((r) => setTimeout(r, 500)); // Wait for canvas to update

          // Re-read layout after zone switch
          const newLayout = useEditorStore.getState().canvasLayout;
          const newStage = useEditorStore.getState().stageRef?.current as KonvaStage | null;
          if (newLayout && newStage) {
            const backFilename = `${baseFilename}_${otherZone.id}`;
            if (options.includeBase) {
              await exportMockupPreview(newStage, newLayout, options, backFilename, designKey);
            } else {
              await exportDesignOnly(newStage, newLayout, options, backFilename, designKey);
            }
          }

          // Switch back to original zone
          useEditorStore.getState().setActiveZone(currentZone);
          await new Promise((r) => setTimeout(r, 300));
        }
      }
    }
  } finally {
    // Restore zoom/pan
    stage.scale(savedScale);
    stage.position(savedPosition);

    if (wasShowingPrintZone) {
      useEditorStore.setState({ showPrintZone: true });
    }
    if (selectedId) {
      useEditorStore.getState().selectLayer(selectedId);
    }
  }
}

/**
 * Computes the print-zone clip rectangle (in the composited canvas's own
 * pixel space) that the design layer gets clipped to when compositing the
 * mockup export. `crop{X,Y}` is the mockup image's own crop origin (from
 * `stage.toCanvas({ x: cropX, y: cropY, ... })`), so the print zone's
 * position has to be re-expressed relative to that crop before scaling up
 * by `pixelRatio` — otherwise the clip rect would be offset by the crop.
 */
export function computePrintZoneCropRect(
  layout: Pick<CanvasLayout, 'printX' | 'printY' | 'printW' | 'printH'>,
  cropX: number,
  cropY: number,
  pixelRatio: number,
): { pzX: number; pzY: number; pzW: number; pzH: number } {
  return {
    pzX: (layout.printX - cropX) * pixelRatio,
    pzY: (layout.printY - cropY) * pixelRatio,
    pzW: layout.printW * pixelRatio,
    pzH: layout.printH * pixelRatio,
  };
}

// Export full mockup: complete t-shirt with design clipped to print zone
async function exportMockupPreview(
  stage: KonvaStage,
  layout: CanvasLayout,
  options: ExportOptions,
  filename: string,
  designKey: string,
): Promise<void> {
  const pixelRatio = (options.dpi ?? 600) / 96;

  // Step 1: Capture just the mockup (base image only, no design)
  // Hide design layers, keep background + mockup
  const designLayers: KonvaLayer[] = [];
  let layerIndex = 0;
  stage.getLayers().forEach((layer: KonvaLayer) => {
    // Layer 0 = background + mockup (non-listening)
    // Layer 1 = design layers
    // Layer 2 = print zone guides + snap guides (non-listening)
    if (layerIndex === 1) {
      designLayers.push(layer);
    }
    layerIndex++;
  });

  // Step 2: Hide the gray background rect
  const hiddenNodes: KonvaNode[] = [];
  stage.find('#background').forEach((node: KonvaNode) => {
    node.visible(false);
    hiddenNodes.push(node);
  });

  stage.getLayers().forEach((l: { batchDraw: () => void }) => l.batchDraw());
  await new Promise((r) => setTimeout(r, 50));

  // Step 3: Capture full stage (mockup image + design layers)
  // but we need to clip design to print zone
  // Strategy: capture in two passes and composite

  // Pass 1: Capture mockup only (hide design layers)
  designLayers.forEach((layer) => {
    (layer as unknown as KonvaNode).visible(false);
  });
  stage.getLayers().forEach((l: { batchDraw: () => void }) => l.batchDraw());
  await new Promise((r) => setTimeout(r, 50));

  // Find the mockup image bounds to crop tightly
  let imgX = 0;
  let imgY = 0;
  let imgW = 0;
  let imgH = 0;
  stage.getLayers().forEach((layer: KonvaLayer) => {
    if (!layer.listening()) {
      layer.getChildren().forEach((node: KonvaNode & { x?: () => number; y?: () => number; width?: () => number; height?: () => number; getClassName?: () => string }) => {
        // Skip the displacement-preview snapshot (see ProductEditor.tsx) — it's
        // also a non-listening Image, sized to the print area rather than the
        // full mockup, and would otherwise win this "last Image wins" scan and
        // crop the export down to just the print area (no visible garment).
        if (node.name?.() === 'displacement-preview') return;
        if (node.getClassName?.() === 'Image' && node.width && node.height) {
          imgX = node.x?.() ?? 0;
          imgY = node.y?.() ?? 0;
          imgW = node.width?.() ?? 0;
          imgH = node.height?.() ?? 0;
        }
      });
    }
  });

  // Use mockup bounds if found, otherwise use full stage
  const cropX = imgW > 0 ? imgX : 0;
  const cropY = imgH > 0 ? imgY : 0;
  const cropW = imgW > 0 ? imgW : layout.printW * 3;
  const cropH = imgH > 0 ? imgH : layout.printH * 3;

  const mockupCanvas = stage.toCanvas({
    x: cropX,
    y: cropY,
    width: cropW,
    height: cropH,
    pixelRatio,
  });

  // Pass 2: Capture design only (hide mockup, show design)
  designLayers.forEach((layer) => {
    (layer as unknown as KonvaNode).visible(true);
  });

  // Hide mockup layer
  stage.getLayers().forEach((layer: KonvaLayer) => {
    if (!layer.listening()) {
      layer.getChildren().forEach((node: KonvaNode) => {
        node.visible(false);
        if (!hiddenNodes.includes(node)) hiddenNodes.push(node);
      });
    }
  });

  stage.getLayers().forEach((l: { batchDraw: () => void }) => l.batchDraw());
  await new Promise((r) => setTimeout(r, 50));

  const designCanvas = stage.toCanvas({
    x: cropX,
    y: cropY,
    width: cropW,
    height: cropH,
    pixelRatio,
  });

  // Restore everything
  hiddenNodes.forEach((n) => n.visible(true));
  stage.getLayers().forEach((l: { batchDraw: () => void }) => l.batchDraw());

  // Composite: mockup + design clipped to print zone + overlay on top
  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = mockupCanvas.width;
  finalCanvas.height = mockupCanvas.height;
  const ctx = finalCanvas.getContext('2d');
  if (!ctx) throw new Error('No canvas context');

  // Draw mockup (base product image)
  ctx.drawImage(mockupCanvas, 0, 0);

  // Clip design to print zone area
  const { pzX, pzY, pzW, pzH } = computePrintZoneCropRect(layout, cropX, cropY, pixelRatio);

  ctx.save();
  ctx.beginPath();
  ctx.rect(pzX, pzY, pzW, pzH);
  ctx.clip();
  ctx.drawImage(designCanvas, 0, 0);
  ctx.restore();

  // Pass 3: Draw overlay on top (product mask — camera cutouts, edges, shapes)
  // The overlay sits in the non-listening layers. We capture just those layers
  // with design hidden, then composite on top.
  designLayers.forEach((layer) => { (layer as unknown as KonvaNode).visible(false); });
  // Also hide the base image layer (layer 0) — we only want overlay from layer 2+
  let firstLayer: KonvaLayer | undefined;
  let layerIdx = 0;
  stage.getLayers().forEach((l: KonvaLayer) => { if (layerIdx === 0) firstLayer = l; layerIdx++; });
  if (firstLayer) firstLayer.getChildren().forEach((n: KonvaNode) => n.visible(false));
  // Hide print zone guide and snap guides (keep only the actual overlay images).
  // The displacement-preview snapshot is also a non-listening Image, so it
  // must be excluded explicitly here too — otherwise it would leak into this
  // "overlay only" composite even though it isn't part of the product overlay.
  const guideNodes: KonvaNode[] = [];
  stage.getLayers().forEach((layer: KonvaLayer) => {
    if (!layer.listening()) {
      layer.getChildren().forEach((node: KonvaNode & { getClassName?: () => string }) => {
        if (node.getClassName?.() !== 'Image' || node.name?.() === 'displacement-preview') {
          node.visible(false);
          guideNodes.push(node);
        }
      });
    }
  });
  stage.getLayers().forEach((l: { batchDraw: () => void }) => l.batchDraw());
  await new Promise((r) => setTimeout(r, 50));

  const overlayCanvas = stage.toCanvas({ x: cropX, y: cropY, width: cropW, height: cropH, pixelRatio });
  ctx.drawImage(overlayCanvas, 0, 0);

  // Restore everything
  designLayers.forEach((layer) => { (layer as unknown as KonvaNode).visible(true); });
  if (firstLayer) firstLayer.getChildren().forEach((n: KonvaNode) => n.visible(true));
  guideNodes.forEach((n) => n.visible(true));
  hiddenNodes.forEach((n) => n.visible(true));
  stage.getLayers().forEach((l: { batchDraw: () => void }) => l.batchDraw());

  if (options.format === 'png') {
    if (!(await deliverExportBlob(finalCanvas, layout, filename, designKey, !!options.forHost))) {
      downloadCanvas(finalCanvas, `${filename}.png`);
    }
  } else {
    downloadAsSVG(finalCanvas, layout, pixelRatio, filename);
  }
}

// Export design only — clipped to print zone, transparent background
async function exportDesignOnly(
  stage: KonvaStage,
  layout: CanvasLayout,
  options: ExportOptions,
  filename: string,
  designKey: string,
): Promise<void> {
  const pixelRatio = (options.dpi ?? 600) / 96;

  // Hide everything except design layers
  const hiddenNodes: KonvaNode[] = [];

  stage.find('#background').forEach((node: KonvaNode) => {
    node.visible(false);
    hiddenNodes.push(node);
  });

  stage.getLayers().forEach((layer: KonvaLayer) => {
    if (!layer.listening()) {
      layer.getChildren().forEach((node: KonvaNode) => {
        node.visible(false);
        hiddenNodes.push(node);
      });
    }
  });

  stage.getLayers().forEach((l: { batchDraw: () => void }) => l.batchDraw());
  await new Promise((r) => setTimeout(r, 50));

  const canvas = stage.toCanvas({
    x: layout.printX,
    y: layout.printY,
    width: layout.printW,
    height: layout.printH,
    pixelRatio,
  });

  // Restore
  hiddenNodes.forEach((n) => n.visible(true));
  stage.getLayers().forEach((l: { batchDraw: () => void }) => l.batchDraw());

  if (options.format === 'png') {
    if (!(await deliverExportBlob(canvas, layout, filename, designKey, !!options.forHost))) {
      downloadCanvas(canvas, `${filename}.png`);
    }
  } else {
    downloadAsSVG(canvas, layout, pixelRatio, filename);
  }
}

function downloadAsSVG(
  canvas: HTMLCanvasElement,
  layout: CanvasLayout,
  _pixelRatio: number,
  filename: string,
): void {
  const widthMM = layout.printW / layout.pxPerMM;
  const heightMM = layout.printH / layout.pxPerMM;
  const pngDataUrl = canvas.toDataURL('image/png');

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
  width="${widthMM}mm" height="${heightMM}mm"
  viewBox="0 0 ${canvas.width} ${canvas.height}">
  <image width="${canvas.width}" height="${canvas.height}"
    xlink:href="${pngDataUrl}" />
</svg>`;

  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  downloadUrl(url, `${filename}.svg`);
  URL.revokeObjectURL(url);
}

function downloadCanvas(canvas: HTMLCanvasElement, filename: string): void {
  const url = canvas.toDataURL('image/png');
  downloadUrl(url, filename);
}

function downloadUrl(url: string, filename: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

type KonvaNode = { visible: (v: boolean) => void; getClassName?: () => string; name?: () => string; x?: () => number; y?: () => number; width?: () => number; height?: () => number };
type KonvaLayer = { listening: () => boolean; batchDraw: () => void; getChildren: () => { forEach: (fn: (n: KonvaNode) => void) => void } };
type KonvaStage = {
  toCanvas: (config: Record<string, unknown>) => HTMLCanvasElement;
  find: (selector: string) => { forEach: (fn: (n: KonvaNode) => void) => void };
  getLayers: () => { forEach: (fn: (layer: KonvaLayer) => void) => void };
};
type CanvasLayout = { printX: number; printY: number; printW: number; printH: number; pxPerMM: number };
