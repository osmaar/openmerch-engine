export const MM_PER_INCH = 25.4;

export function mmToPx(mm: number, dpi: number): number {
  return (mm / MM_PER_INCH) * dpi;
}

export function pxToMm(px: number, dpi: number): number {
  return (px / dpi) * MM_PER_INCH;
}

/**
 * Ceiling for a single rendered zone's pixel width/height, applied by the
 * renderer before allocating a Konva.Stage. A3's long edge (420mm) at 300 DPI
 * is ~4961px — plenty for any real print zone — so anything past this points
 * at a misconfigured product (e.g. mm values entered as px) rather than a
 * legitimate large-format job, and is rejected instead of risking a worker
 * OOM on `Stage`/canvas allocation.
 */
export const MAX_RENDER_DIMENSION_PX = 4961;
