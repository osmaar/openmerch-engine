import type { Canvas as NodeCanvas } from 'canvas';
import type { KonvaModule, KonvaStage } from './konva-types.js';

// Konva works in Node.js via the `konva/lib/index-node` build, which uses
// `node-canvas` instead of the DOM canvas. We import it dynamically to keep
// the renderer package itself ESM-friendly while Konva's node entry is CJS.

let cachedKonva: KonvaModule | null = null;

export async function getKonvaNode(): Promise<KonvaModule> {
  if (cachedKonva) return cachedKonva;
  // The node entry registers itself globally and exports the same API as the
  // browser build. Using a dynamic import keeps it lazy.
  const mod = await import('konva/lib/index-node.js');
  // Konva's own typings model the browser build; this dynamic import targets
  // the node-canvas build instead, so we assert it against our own minimal
  // interop contract (KonvaModule) rather than trusting Konva's browser types.
  cachedKonva = (mod.default ?? mod) as unknown as KonvaModule;
  return cachedKonva;
}

/**
 * Pulls the underlying node-canvas Canvas instance out of a Konva Stage.
 * Konva keeps it on `_canvas.canvas` (private but stable across versions).
 */
export function getNodeCanvas(stage: KonvaStage): NodeCanvas {
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
