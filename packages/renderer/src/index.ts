/**
 * Renders a single product zone (front, back, sleeve, etc.) to a print-ready
 * PNG buffer at the given DPI (300 by default), compositing the design's
 * shape/image/text layers on a transparent background via server-side Konva.
 * This is the "contractual" output — the file that actually goes to print.
 */
export { renderDesignZone } from './render-zone.js';

/** Input options for {@link renderDesignZone} and the result it returns, plus
 *  the caller-supplied resolver callbacks (image bytes, font file paths) it
 *  needs — the renderer stays free of MinIO/HTTP/DB coupling by delegating
 *  resolution to the caller instead of importing storage clients itself. */
export type { RenderZoneOptions, RenderZoneResult, ImageBufferResolver, FontPathResolver } from './render-zone.js';

/**
 * Renders the merchant-facing mockup PNG for a product zone: the same design
 * layers composited over the product's base image (with optional color tint)
 * and under its overlay image, at a lower DPI (96 by default) since this is a
 * visual reference, not a print artifact.
 */
export { renderDesignZoneMockup } from './render-zone-mockup.js';

/** Input options for {@link renderDesignZoneMockup} and the result it returns.
 *  Reuses `ImageBufferResolver`/`FontPathResolver` from `render-zone.js` and
 *  additionally accepts `productColor` for the base-image tint. */
export type { RenderZoneMockupOptions, RenderZoneMockupResult } from './render-zone-mockup.js';
