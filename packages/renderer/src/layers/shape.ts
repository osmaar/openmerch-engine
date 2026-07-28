import type { ShapeLayer } from '@openmerch/core';
import type { KonvaContainer, KonvaModule, KonvaNode } from '../konva-types.js';
import { mmToPx, roundedRectCornerRadius, radiusFromWidth, starRadii, arrowPointerDims, crossPoints } from './geometry.js';

/**
 * Adds a shape layer to a Konva node-side layer.
 *
 * Replicates the editor's shape rendering (DesignLayer.tsx renderShape) so the
 * production output matches what the customer saw in the editor exactly.
 *
 * Coordinates: layer.x/y/widthMM/heightMM are in MILLIMETERS relative to the
 * print area. We convert to pixels using `pxPerMM` (which encodes the target DPI).
 */
export function addShapeLayer(
  konvaLayer: KonvaContainer,
  layer: ShapeLayer,
  pxPerMM: number,
  Konva: KonvaModule,
): void {
  const w = mmToPx(layer.widthMM, pxPerMM);
  const h = mmToPx(layer.heightMM, pxPerMM);

  // Common transform props applied to every shape primitive.
  const common = {
    x: mmToPx(layer.x, pxPerMM),
    y: mmToPx(layer.y, pxPerMM),
    rotation: layer.rotation,
    scaleX: layer.scaleX,
    scaleY: layer.scaleY,
    skewX: layer.skewX,
    skewY: layer.skewY,
    opacity: layer.opacity,
    fill: layer.fill,
    stroke: layer.stroke,
    strokeWidth: layer.strokeWidth,
  };

  let node: KonvaNode;
  switch (layer.shapeType) {
    case 'rect':
      node = new Konva.Rect({ ...common, width: w, height: h });
      break;
    case 'rounded-rect':
      node = new Konva.Rect({ ...common, width: w, height: h, cornerRadius: roundedRectCornerRadius(w) });
      break;
    case 'circle':
      node = new Konva.Circle({ ...common, radius: radiusFromWidth(w) });
      break;
    case 'triangle':
      node = new Konva.RegularPolygon({ ...common, sides: 3, radius: radiusFromWidth(w) });
      break;
    case 'pentagon':
      node = new Konva.RegularPolygon({ ...common, sides: 5, radius: radiusFromWidth(w) });
      break;
    case 'hexagon':
      node = new Konva.RegularPolygon({ ...common, sides: 6, radius: radiusFromWidth(w) });
      break;
    case 'diamond':
      node = new Konva.RegularPolygon({ ...common, sides: 4, radius: radiusFromWidth(w) });
      break;
    case 'star':
      node = new Konva.Star({
        ...common,
        numPoints: 5,
        ...starRadii(w),
      });
      break;
    case 'line':
      node = new Konva.Line({ ...common, points: [0, 0, w, 0] });
      break;
    case 'arrow':
      node = new Konva.Arrow({
        ...common,
        points: [0, 0, w, 0],
        ...arrowPointerDims(w),
      });
      break;
    case 'cross':
      node = new Konva.Line({
        ...common,
        points: crossPoints(w, h),
        closed: true,
      });
      break;
    default:
      return; // unknown shape type, skip
  }

  konvaLayer.add(node);
}
