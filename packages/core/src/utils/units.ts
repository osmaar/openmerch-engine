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
 * is ~4961px. Real large-format zones (desk mats, mousepads, posters) can
 * legitimately exceed this at a fixed 300 DPI — see {@link resolvePrintDpi},
 * which automatically lowers the DPI for those instead of rejecting them
 * outright. This cap still guards against a genuinely misconfigured product
 * (e.g. mm values entered as px) via {@link MIN_SAFE_DPI}: if a zone is so
 * large it can't fit even at the lowest acceptable print quality, that's a
 * data-entry mistake, not a legitimate large-format job.
 */
export const MAX_RENDER_DIMENSION_PX = 4961;

/**
 * Floor DPI `resolvePrintDpi` will fall back to for an oversized zone before
 * giving up. 72 DPI is screen resolution — the lowest quality still
 * reasonable to hand to a print vendor. At this floor, `MAX_RENDER_DIMENSION_PX`
 * corresponds to ~1.75m per side, comfortably larger than any physical
 * product zone in this catalog (the largest today is ~500mm).
 */
export const MIN_SAFE_DPI = 72;

/** Result of {@link resolvePrintDpi}. */
export interface ResolvedPrintDpi {
  /** The DPI to actually render at. */
  dpi: number;
  /** True when `requestedDpi` didn't fit under `MAX_RENDER_DIMENSION_PX` and had to be lowered. */
  wasClamped: boolean;
}

/**
 * Picks the DPI to render a print zone at: `requestedDpi` as-is when the
 * zone's physical size fits under `MAX_RENDER_DIMENSION_PX`, otherwise the
 * highest DPI (down to `MIN_SAFE_DPI`) that does fit — proportional to the
 * zone's longest side, matching how real large-format printing already
 * trades resolution for size (a desk mat or poster is viewed from farther
 * away than a t-shirt print, so it doesn't need 300 DPI to look sharp).
 *
 * Kept as a pure function (no throwing) so it's trivially testable; the
 * caller decides what `wasClamped` means for it — e.g. `render-zone.ts`
 * treats a clamp as silent/expected when `requestedDpi` came from a
 * product-wide default, but as a hard error when a merchant explicitly
 * configured that exact DPI for the zone (see `ProductZone.printDPI`).
 */
export function resolvePrintDpi(
  printAreaWidthMM: number,
  printAreaHeightMM: number,
  requestedDpi: number,
): ResolvedPrintDpi {
  const widthPx = mmToPx(printAreaWidthMM, requestedDpi);
  const heightPx = mmToPx(printAreaHeightMM, requestedDpi);
  if (Math.max(widthPx, heightPx) <= MAX_RENDER_DIMENSION_PX) {
    return { dpi: requestedDpi, wasClamped: false };
  }

  const largestMM = Math.max(printAreaWidthMM, printAreaHeightMM);
  const fittingDpi = Math.floor((MAX_RENDER_DIMENSION_PX / largestMM) * MM_PER_INCH);
  return { dpi: Math.max(MIN_SAFE_DPI, fittingDpi), wasClamped: true };
}
