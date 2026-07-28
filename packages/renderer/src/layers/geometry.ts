// Pure numeric helpers for shape/image layer geometry — extracted out of
// addShapeLayer()/addImageLayer() so the mm→px conversion and the per-shape
// derived-dimension formulas can be unit tested without constructing a real
// Konva node (which needs `canvas`'s native bindings).

/** Converts a millimeter measurement to pixels at the DPI-derived `pxPerMM` scale factor. */
export function mmToPx(mm: number, pxPerMM: number): number {
  return mm * pxPerMM;
}

/** Corner radius for a "rounded-rect" shape, as a fraction of its pixel width. */
export function roundedRectCornerRadius(widthPx: number): number {
  return widthPx * 0.15;
}

/** Radius for shapes defined by a single Konva radius (circle, triangle/pentagon/hexagon/diamond as regular polygons). */
export function radiusFromWidth(widthPx: number): number {
  return widthPx / 2;
}

/** Inner/outer radii for the 5-point "star" shape. */
export function starRadii(widthPx: number): { innerRadius: number; outerRadius: number } {
  return { innerRadius: widthPx * 0.38, outerRadius: widthPx / 2 };
}

/** Pointer-head length/width for the "arrow" shape. */
export function arrowPointerDims(widthPx: number): { pointerLength: number; pointerWidth: number } {
  return { pointerLength: widthPx * 0.2, pointerWidth: widthPx * 0.15 };
}

/**
 * Outline points (Konva.Line `points`) for the "cross"/plus shape, given its
 * bounding box in pixels. The 12-point polygon traces the plus sign's own
 * outline, so every coordinate stays within [0, widthPx] x [0, heightPx].
 */
export function crossPoints(widthPx: number, heightPx: number): number[] {
  const t = widthPx * 0.3;
  const cx = widthPx / 2;
  const cy = heightPx / 2;
  return [
    cx - t / 2, 0, cx + t / 2, 0,
    cx + t / 2, cy - t / 2, widthPx, cy - t / 2,
    widthPx, cy + t / 2, cx + t / 2, cy + t / 2,
    cx + t / 2, heightPx, cx - t / 2, heightPx,
    cx - t / 2, cy + t / 2, 0, cy + t / 2,
    0, cy - t / 2, cx - t / 2, cy - t / 2,
  ];
}
