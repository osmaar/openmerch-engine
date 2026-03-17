export interface Product {
  id: string;
  name: string;
  slug: string;
  zones: ProductZone[];
}

export interface ProductZone {
  id: string;
  name: string;
  printAreaWidthMM: number;
  printAreaHeightMM: number;
  printAreaXMM: number;
  printAreaYMM: number;
  baseImageUrl: string;
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
