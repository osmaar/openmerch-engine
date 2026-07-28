/**
 * Domain types shared across editor/api/renderer: {@link Design} and its
 * {@link DesignZone}/{@link DesignLayer} tree (the mm-based document the
 * editor produces and the renderer consumes), plus {@link Product} and
 * {@link ProductZone} (catalog data describing print areas) and the
 * {@link TECHNIQUE_CONSTRAINTS} table for decoration-method validation.
 */
export * from './types/index.js';

/**
 * `mm` ⇄ `px` conversion. All persisted design/product dimensions are in
 * millimeters (see {@link TextLayer.fontSize} and friends); a DPI is required
 * because "pixels" only have a physical size once you fix a resolution — the
 * editor uses the screen's reference DPI, the renderer uses the print DPI.
 */
export { mmToPx, pxToMm, MAX_RENDER_DIMENSION_PX, MM_PER_INCH } from './utils/units.js';

/**
 * Per-character layout math for curved/bridge/wave text effects. Prefer
 * {@link computeEffectPositions}, which dispatches to the right one of these
 * three based on `effect.type` — call them directly only if you already know
 * which curve you need.
 */
export {
  curvedPositions,
  bridgePositions,
  obliquePositions,
  computeEffectPositions,
} from './utils/text-effects.js';
/** A single character's placement, as returned by {@link computeEffectPositions}. */
export type { EffectCharPosition } from './utils/text-effects.js';

/**
 * Recolor a product mockup image to a customer-chosen color while preserving
 * its shading (luminance-preserving tint). {@link isWhiteTintColor} lets
 * callers skip the tint pass entirely for the "no tint" (white) case.
 */
export { tintImagePixels, isWhiteTintColor } from './utils/tint-image.js';
/**
 * Minimal `ImageData`-like shape accepted by {@link tintImagePixels} —
 * duck-typed so both a DOM `ImageData` and a node-canvas image buffer work
 * without pulling in `lib.dom` as a dependency.
 */
export type { TintableImage } from './utils/tint-image.js';

/**
 * Distort a mockup preview image with a two-channel displacement map so a
 * design appears to follow a garment's fabric folds (preview-only — never
 * applied to the print-ready file). See {@link ProductZone.displacementMapUrl}
 * for the map format.
 */
export { applyDisplacementMap } from './utils/displacement-map.js';
/**
 * Minimal `ImageData`-like shape accepted by {@link applyDisplacementMap} —
 * same duck-typing rationale as {@link TintableImage}.
 */
export type { DisplaceableImage } from './utils/displacement-map.js';
