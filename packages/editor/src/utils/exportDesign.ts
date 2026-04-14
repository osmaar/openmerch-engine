import { useEditorStore } from '../store/editorStore.js';

interface ExportOptions {
  format: 'png' | 'svg';
  includeBase: boolean;
  hideOverflow: boolean;
  includeBack?: boolean;
  dpi?: number;
}

let exportCounter = 0;

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

  exportCounter++;

  try {
    // Export current zone
    const currentZone = useEditorStore.getState().activeZoneId;
    const filename = `design_openmerch_${exportCounter}_${currentZone}`;

    if (options.includeBase) {
      await exportMockupPreview(stage, canvasLayout, options, filename);
    } else {
      await exportDesignOnly(stage, canvasLayout, options, filename);
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
            const backFilename = `design_openmerch_${exportCounter}_${otherZone.id}`;
            if (options.includeBase) {
              await exportMockupPreview(newStage, newLayout, options, backFilename);
            } else {
              await exportDesignOnly(newStage, newLayout, options, backFilename);
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

// Export full mockup: complete t-shirt with design clipped to print zone
async function exportMockupPreview(
  stage: KonvaStage,
  layout: CanvasLayout,
  options: ExportOptions,
  filename: string,
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
  const pzX = (layout.printX - cropX) * pixelRatio;
  const pzY = (layout.printY - cropY) * pixelRatio;
  const pzW = layout.printW * pixelRatio;
  const pzH = layout.printH * pixelRatio;

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
  // Hide print zone guide and snap guides (keep only overlay images)
  const guideNodes: KonvaNode[] = [];
  stage.getLayers().forEach((layer: KonvaLayer) => {
    if (!layer.listening()) {
      layer.getChildren().forEach((node: KonvaNode & { getClassName?: () => string }) => {
        if (node.getClassName?.() !== 'Image') {
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
    downloadCanvas(finalCanvas, `${filename}.png`);
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
    downloadCanvas(canvas, `${filename}.png`);
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

type KonvaNode = { visible: (v: boolean) => void; getClassName?: () => string; x?: () => number; y?: () => number; width?: () => number; height?: () => number };
type KonvaLayer = { listening: () => boolean; batchDraw: () => void; getChildren: () => { forEach: (fn: (n: KonvaNode) => void) => void } };
type KonvaStage = {
  toCanvas: (config: Record<string, unknown>) => HTMLCanvasElement;
  find: (selector: string) => { forEach: (fn: (n: KonvaNode) => void) => void };
  getLayers: () => { forEach: (fn: (layer: KonvaLayer) => void) => void };
};
type CanvasLayout = { printX: number; printY: number; printW: number; printH: number; pxPerMM: number };
