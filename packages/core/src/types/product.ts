export interface Product {
  id: string;
  name: string;
  slug: string;
  zones: ProductZone[];
  /** Product categories (e.g. ["T-Shirts"], ["Phone Cases"]). */
  categories?: string[];
  /** Product variants (e.g. phone models, mug sizes, poster dimensions).
   *  Each variant can override the product zones with its own mockup images
   *  and print area dimensions. For clothing, variants are sizes (S/M/L/XL)
   *  and don't change zones. */
  variants?: ProductVariant[];
  /** Label for the variant selector (e.g. "Device", "Size", "Dimensions"). */
  variantLabel?: string;
}

export interface ProductVariant {
  id: string;
  /** Display name (e.g. "iPhone 16 Pro", "15 oz", "18×24 in"). */
  name: string;
  /** If set, these zones replace the product's default zones when this variant
   *  is selected — different mockup image, different print area. */
  zones?: ProductZone[];
}

export interface ProductZone {
  id: string;
  name: string;
  baseImageWidthMM: number;
  baseImageHeightMM: number;
  printAreaWidthMM: number;
  printAreaHeightMM: number;
  printAreaXMM: number;
  printAreaYMM: number;
  baseImageUrl: string;
  /** Optional overlay PNG rendered ON TOP of design layers. Transparent areas
   *  let the design show through; opaque areas represent product features
   *  (camera cutout, edges, bumper) that should appear above the design. */
  overlayImageUrl?: string;
}

export type DecorationTechnique = 'sublimation' | 'screenPrinting' | 'embroidery';

export interface TechniqueConstraints {
  minDPI: number;
  colorLimit: number | null;
  allowsFullBleed?: boolean;
  requiresVectorText?: boolean;
  minStrokeWidthMM?: number;
  maxDimensionMM?: number;
  minDetailSizeMM?: number;
}

export const TECHNIQUE_CONSTRAINTS: Record<DecorationTechnique, TechniqueConstraints> = {
  sublimation: {
    minDPI: 150,
    colorLimit: null,
    allowsFullBleed: true,
  },
  screenPrinting: {
    minDPI: 300,
    colorLimit: 8,
    requiresVectorText: true,
    minStrokeWidthMM: 0.5,
  },
  embroidery: {
    minDPI: 72,
    colorLimit: 15,
    maxDimensionMM: 300,
    minDetailSizeMM: 2,
  },
};
