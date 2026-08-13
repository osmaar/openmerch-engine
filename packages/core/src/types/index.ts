/** A saved design: which product it's for, which zone is active, and the per-zone layer trees. */
export type { Design } from './design.js';
/** One printable zone of a {@link Design} — its canvas size in mm plus the layers placed on it. */
export type { DesignZone } from './design.js';
/** Union of the three layer kinds a {@link DesignZone} can contain. */
export type { DesignLayer } from './design.js';
/** Transform, visibility and lock fields shared by every layer type. */
export type { BaseLayer } from './design.js';
/** A placed raster image layer (uploaded artwork or clipart), with its original (pre-crop) size in mm. */
export type { ImageLayer } from './design.js';
/** A placed text layer; `fontSize` is in mm (see project unit convention) and may carry a {@link TextEffect}. */
export type { TextLayer } from './design.js';
/** Curved/bridge/wave text-effect parameters attached to a {@link TextLayer}; consumed by `computeEffectPositions`. */
export type { TextEffect } from './design.js';
/** A placed vector shape layer (rect, circle, star, etc.), sized in mm. */
export type { ShapeLayer } from './design.js';
/** Metadata delivered alongside the exported PNG `Blob` to an embedding host's `onExport` callback. */
export type { DesignExportMeta } from './design.js';

/** Catalog entry: a customizable product with its print zones, optional variants and categories. */
export type { Product } from './product.js';
/** A print area on a {@link Product} (or on one of its {@link ProductVariant}s), positioned in mm on the base mockup image. */
export type { ProductZone } from './product.js';
/** A product variant (e.g. phone model, garment size) that may override the product's default zones. */
export type { ProductVariant } from './product.js';
/** Supported decoration/print methods; keys into {@link TECHNIQUE_CONSTRAINTS}. */
export type { DecorationTechnique } from './product.js';
/** Physical/production constraints (min DPI, color limits, etc.) for one {@link DecorationTechnique}. */
export type { TechniqueConstraints } from './product.js';

/** Per-technique constraint table, used to validate a design is producible before checkout. */
export { TECHNIQUE_CONSTRAINTS } from './product.js';
