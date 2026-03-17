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
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  opacity: number;
  locked: boolean;
  visible: boolean;
}

export interface ImageLayer extends BaseLayer {
  type: 'image';
  src: string;
  originalWidthMM: number;
  originalHeightMM: number;
}

export interface TextLayer extends BaseLayer {
  type: 'text';
  text: string;
  fontFamily: string;
  fontSize: number;
  fill: string;
  align: 'left' | 'center' | 'right';
}

export interface ShapeLayer extends BaseLayer {
  type: 'shape';
  shapeType: 'rect' | 'circle' | 'ellipse';
  fill: string;
  stroke: string;
  strokeWidth: number;
  widthMM: number;
  heightMM: number;
}
