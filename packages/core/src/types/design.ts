export interface Design {
  id: string;
  productId: string;
  activeZone: string;
  zones: Record<string, DesignZone>;
}

export interface DesignZone {
  zoneId: string;
  canvasWidthMM: number;
  canvasHeightMM: number;
  layers: DesignLayer[];
}

export type DesignLayer = ImageLayer | TextLayer | ShapeLayer;

export interface BaseLayer {
  id: string;
  type: 'image' | 'text' | 'shape';
  /** Optional custom display name for the layers panel. */
  name?: string;
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  skewX: number;
  skewY: number;
  opacity: number;
  locked: boolean;
  visible: boolean;
}

export interface ImageLayer extends BaseLayer {
  type: 'image';
  src: string;
  originalSrc: string;
  originalWidthMM: number;
  originalHeightMM: number;
  activeFilter?: number;
  tint?: string;
  tintOpacity?: number;
}

export interface TextLayer extends BaseLayer {
  type: 'text';
  text: string;
  fontFamily: string;
  /** UUID of the custom font record in the fonts table. Present only for
   *  merchant-uploaded fonts. The renderer uses this to look up the font
   *  directly by ID, bypassing name-matching issues between the DB alias
   *  and the font file's internal CSS family name. */
  fontId?: string;
  /**
   * Font size in MILLIMETERS. Project rule: all internal dimensions are in mm.
   * Editor and renderer convert to pixels using `fontSize * pxPerMM`, which
   * makes the printed text size invariant across screen sizes and DPIs.
   */
  fontSize: number;
  fill: string;
  align: 'left' | 'center' | 'right';
  letterSpacing: number;
  lineHeight: number;
  fontStyle: string;
  textDecoration: string;
  textEffect: TextEffect;
}

export interface TextEffect {
  type: 'none' | 'curved' | 'bridge' | 'wave';
  radius: number;
  spacing: number;
  curve: number;
  height: number;
  offset: number;
}

export interface ShapeLayer extends BaseLayer {
  type: 'shape';
  shapeType: 'rect' | 'circle' | 'triangle' | 'star' | 'line' | 'pentagon' | 'hexagon' | 'diamond' | 'arrow' | 'rounded-rect' | 'cross';
  fill: string;
  stroke: string;
  strokeWidth: number;
  widthMM: number;
  heightMM: number;
  sides?: number;
  innerRadius?: number;
}
