// Konva works in Node.js via the `konva/lib/index-node` build, which uses
// `node-canvas` instead of the DOM canvas. We import it dynamically to keep
// the renderer package itself ESM-friendly while Konva's node entry is CJS.
//
// All exports cast to `any` because Konva's node-side types are limited.
/* eslint-disable @typescript-eslint/no-explicit-any */

let cachedKonva: any | null = null;

export async function getKonvaNode(): Promise<any> {
  if (cachedKonva) return cachedKonva;
  // The node entry registers itself globally and exports the same API as the
  // browser build. Using a dynamic import keeps it lazy.
  const mod = await import('konva/lib/index-node.js');
  cachedKonva = mod.default ?? mod;
  return cachedKonva;
}

/**
 * Pulls the underlying node-canvas Canvas instance out of a Konva Stage.
 * Konva keeps it on `_canvas.canvas` (private but stable across versions).
 */
export function getNodeCanvas(stage: any): {
  toBuffer: (mime: string, opts?: { compressionLevel?: number }) => Buffer;
} {
  // First try the documented API (works in newer Konva): stage.toCanvas()
  if (typeof stage.toCanvas === 'function') {
    const canvas = stage.toCanvas();
    if (canvas && typeof canvas.toBuffer === 'function') return canvas;
  }
  // Fall back to the layer's internal canvas if needed.
  const firstLayer = stage.getLayers()[0];
  if (firstLayer) {
    const layerCanvas = firstLayer.getCanvas()._canvas;
    if (layerCanvas && typeof layerCanvas.toBuffer === 'function') return layerCanvas;
  }
  throw new Error('Could not extract node-canvas from Konva stage');
}
