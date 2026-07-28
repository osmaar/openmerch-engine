import { useState, useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import type Konva from 'konva';
import type { ProductZone, DesignLayer as DesignLayerType } from '@openmerch/core';
import { applyDisplacementMap, mmToPx, MAX_RENDER_DIMENSION_PX } from '@openmerch/core';
import { useImage } from './useImage.js';
import { useDebouncedCallback } from './useDebouncedCallback.js';

/**
 * Floor for the capture's physical pixel density, independent of the on-screen
 * `layout.pxPerMM` (which tracks the container's CSS size, see `ProductEditor.tsx`
 * — it can be far below print quality on a small/narrow viewport). 150 DPI
 * matches the low end of the renderer's own print-quality range
 * (`packages/renderer` uses 96 DPI for admin mockup previews, 300 DPI for the
 * print-ready file) while keeping the per-pixel `applyDisplacementMap` loop
 * below MAX_RENDER_DIMENSION_PX-scale cost for typical print areas.
 */
const PREVIEW_CAPTURE_DPI = 150;

/** The subset of `CanvasLayout` (see `ProductEditor.tsx`) this hook needs. */
export interface DisplacedPreviewLayout {
  printX: number;
  printY: number;
  printW: number;
  printH: number;
  pxPerMM: number;
}

interface UseDisplacedDesignPreviewParams {
  /** Ref to the interactive, clipped `<Group>` that holds the design layers. */
  groupRef: RefObject<Konva.Group | null>;
  zone: ProductZone;
  /** The active zone's layers — recompute triggers whenever this array changes. */
  layers: DesignLayerType[];
  layout: DisplacedPreviewLayout | null;
  /** While `true` (drag/transform gesture in progress), recompute is skipped. */
  isDragging: boolean;
}

/**
 * Snapshots the interactive design `<Group>` and runs it through
 * {@link applyDisplacementMap}, producing a "fabric follows the design"
 * preview canvas to render in a separate, non-listening `<Layer>` on top of
 * the (untouched) interactive group.
 *
 * Deliberately NOT implemented via `Konva.Filters`/`.cache()` on the
 * interactive group — that flattens the subtree into a single cached bitmap
 * and kills live drag/transform rendering. `Group.toCanvas()` is a read-only
 * export to a brand-new offscreen canvas (see `Node.js#_toKonvaCanvas`,
 * `this.drawScene(canvas, undefined, bufferCanvas)`); it never touches the
 * live node tree's cache, listening state, or attrs, so the interactive group
 * keeps behaving exactly as before.
 *
 * Returns `null` when `zone.displacementMapUrl` is unset, the map hasn't
 * loaded yet, or no layout is available.
 */
export function useDisplacedDesignPreview({
  groupRef,
  zone,
  layers,
  layout,
  isDragging,
}: UseDisplacedDesignPreviewParams): HTMLCanvasElement | null {
  const [previewCanvas, setPreviewCanvas] = useState<HTMLCanvasElement | null>(null);
  const [mapImage] = useImage(zone.displacementMapUrl ?? '');

  const recompute = useDebouncedCallback(() => {
    const group = groupRef.current;
    const stage = group?.getStage();
    if (!group || !stage || !layout || !zone.displacementMapUrl || !mapImage) {
      setPreviewCanvas(null);
      return;
    }

    // The capture must never be softer than (a) what the interactive group
    // already renders on this screen (layout.pxPerMM * devicePixelRatio — the
    // real physical pixel density Konva's own on-screen canvases use, since
    // Konva's SceneCanvas defaults its pixelRatio to devicePixelRatio) nor (b)
    // a fixed print-quality floor (PREVIEW_CAPTURE_DPI) that's independent of
    // the current on-screen container size/zoom. `layout.pxPerMM` alone is
    // neither: it's derived from the container's CSS size (ProductEditor's
    // `imgW = width * 0.85`), which can sit far below both bars on a small or
    // zoomed-out viewport — that mismatch, not the displacement math, is what
    // produces the pixelated/dithered look the user reported for fine line art.
    const dpr = window.devicePixelRatio || 1;
    const targetPxPerMM = mmToPx(1, PREVIEW_CAPTURE_DPI);
    const capturePxPerMM = Math.max(layout.pxPerMM * dpr, targetPxPerMM);
    let captureScale = capturePxPerMM / layout.pxPerMM;

    let printWpx = Math.round(layout.printW * captureScale);
    let printHpx = Math.round(layout.printH * captureScale);
    const largestSidePx = Math.max(printWpx, printHpx);
    if (largestSidePx > MAX_RENDER_DIMENSION_PX) {
      // Defensive only — printAreaWidthMM/HeightMM come from product config,
      // not end-user input, so this should be rare in practice. Scale the
      // whole capture down uniformly rather than clipping either side.
      captureScale *= MAX_RENDER_DIMENSION_PX / largestSidePx;
      printWpx = Math.round(layout.printW * captureScale);
      printHpx = Math.round(layout.printH * captureScale);
    }

    const strengthPx = (zone.displacementStrengthMM ?? 0) * layout.pxPerMM * captureScale;
    const padPx = Math.ceil(strengthPx);

    // Group.toCanvas() draws through the group's ABSOLUTE transform, which
    // includes the Stage's current pan/zoom (see CanvasView's mouse-wheel
    // handler) — capturing while zoomed would bake that zoom into the
    // snapshot's resolution on top of captureScale. Temporarily drive the
    // Stage's transform to captureScale/identity-position for this
    // synchronous capture (so `layout.printX/Y * captureScale` lines up with
    // the group's absolute position), then restore immediately: Konva only
    // repaints the on-screen canvas on the next animation frame, so nothing
    // flickers.
    const prevScale = stage.scale();
    const prevPos = stage.position();
    stage.scale({ x: captureScale, y: captureScale });
    stage.position({ x: 0, y: 0 });

    let result: HTMLCanvasElement | null = null;
    try {
      const exported = group.toCanvas({
        x: layout.printX * captureScale - padPx,
        y: layout.printY * captureScale - padPx,
        width: printWpx + 2 * padPx,
        height: printHpx + 2 * padPx,
        pixelRatio: 1,
      });

      const ctx = exported.getContext('2d');
      const mapCanvas = document.createElement('canvas');
      mapCanvas.width = mapImage.width;
      mapCanvas.height = mapImage.height;
      const mapCtx = mapCanvas.getContext('2d');

      if (ctx && mapCtx) {
        mapCtx.drawImage(mapImage, 0, 0);
        const mapData = mapCtx.getImageData(0, 0, mapImage.width, mapImage.height);
        const imageData = ctx.getImageData(0, 0, exported.width, exported.height);
        applyDisplacementMap(imageData, mapData, strengthPx);
        ctx.putImageData(imageData, 0, 0);
      }

      // Crop the padding back off so the result matches the print area's
      // exact size again — it only existed to give the displacement room to
      // pull pixels in from just outside the clipped design group.
      const cropped = document.createElement('canvas');
      cropped.width = printWpx;
      cropped.height = printHpx;
      cropped.getContext('2d')?.drawImage(exported, -padPx, -padPx);
      result = cropped;
    } finally {
      stage.scale(prevScale);
      stage.position(prevPos);
    }

    setPreviewCanvas(result);
  }, 300);

  // Drop the stale canvas the instant a gesture starts, well before it ends.
  // Without this, `previewCanvas` still holds the PRE-drag snapshot when the
  // gesture finishes: the preview `<Layer>` (gated on `!isDragging` in
  // ProductEditor.tsx) turns visible again in the very same render as
  // `isDragging` flips back to false, but `recompute` below is debounced
  // 300ms — for that whole window the old, wrongly-positioned distortion
  // would flash on top of the already-moved interactive layer (the "ghost"
  // artifact). Clearing here costs nothing: the layer is already hidden
  // while `isDragging` is true, so blanking it mid-drag is invisible: the
  // user just sees the flat interactive layer with no overlay until the
  // fresh, correctly-positioned distortion is ready.
  useEffect(() => {
    if (isDragging) setPreviewCanvas(null);
  }, [isDragging]);

  // Same "clear immediately, recompute debounced" reasoning as above, but for
  // switching the active zone (e.g. front → back) instead of dragging. Zones
  // sharing the same displacement texture (common — see catalog.json, most
  // products reuse one map across front/back) never change
  // `zone.displacementMapUrl`, so the recompute effect below doesn't treat a
  // zone switch as a reason to reset first: `layers` changes to the new
  // zone's layers, but the 300ms debounce means `previewCanvas` keeps
  // rendering the PREVIOUS zone's distorted snapshot for that whole window —
  // stretched/positioned for the old zone's print area, on top of the new
  // zone's already-correct interactive layer and base mockup. That's the
  // "front design flashes on the back" artifact. Tracking the zone id in a
  // ref and clearing on change (independent of whether the map URL itself
  // changed) fixes it the same way the drag case is fixed.
  const zoneIdRef = useRef(zone.id);
  useEffect(() => {
    if (zoneIdRef.current !== zone.id) {
      zoneIdRef.current = zone.id;
      setPreviewCanvas(null);
    }
  }, [zone.id]);

  useEffect(() => {
    if (isDragging) return;

    if (!zone.displacementMapUrl || !mapImage || !layout) {
      setPreviewCanvas(null);
      return;
    }

    // `recompute` itself is a stable reference (useDebouncedCallback only
    // recreates it if the delay changes) that always reads the latest
    // zone/layers/layout/mapImage via its own closure, so it's deliberately
    // left out of this dependency list — it would never change anyway.
    recompute();
  }, [zone.displacementMapUrl, zone.displacementStrengthMM, layers, layout, mapImage, isDragging]);

  return previewCanvas;
}
