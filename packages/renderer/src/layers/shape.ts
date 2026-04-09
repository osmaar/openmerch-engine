/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ShapeLayer } from '@openmerch/core';

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
  konvaLayer: any,
  layer: ShapeLayer,
  pxPerMM: number,
  Konva: any,
): void {
  const w = layer.widthMM * pxPerMM;
  const h = layer.heightMM * pxPerMM;

  // Common transform props applied to every shape primitive.
  const common = {
    x: layer.x * pxPerMM,
    y: layer.y * pxPerMM,
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

  let node: any;
  switch (layer.shapeType) {
    case 'rect':
      node = new Konva.Rect({ ...common, width: w, height: h });
      break;
    case 'rounded-rect':
      node = new Konva.Rect({ ...common, width: w, height: h, cornerRadius: w * 0.15 });
      break;
    case 'circle':
      node = new Konva.Circle({ ...common, radius: w / 2 });
      break;
    case 'triangle':
      node = new Konva.RegularPolygon({ ...common, sides: 3, radius: w / 2 });
      break;
    case 'pentagon':
      node = new Konva.RegularPolygon({ ...common, sides: 5, radius: w / 2 });
      break;
    case 'hexagon':
      node = new Konva.RegularPolygon({ ...common, sides: 6, radius: w / 2 });
      break;
    case 'diamond':
      node = new Konva.RegularPolygon({ ...common, sides: 4, radius: w / 2 });
      break;
    case 'star':
      node = new Konva.Star({
        ...common,
        numPoints: 5,
        innerRadius: w * 0.38,
        outerRadius: w / 2,
      });
      break;
    case 'line':
      node = new Konva.Line({ ...common, points: [0, 0, w, 0] });
      break;
    case 'arrow':
      node = new Konva.Arrow({
        ...common,
        points: [0, 0, w, 0],
        pointerLength: w * 0.2,
        pointerWidth: w * 0.15,
      });
      break;
    case 'cross': {
      const t = w * 0.3;
      const cx = w / 2;
      const cy = h / 2;
      node = new Konva.Line({
        ...common,
        points: [
          cx - t / 2, 0, cx + t / 2, 0,
          cx + t / 2, cy - t / 2, w, cy - t / 2,
          w, cy + t / 2, cx + t / 2, cy + t / 2,
          cx + t / 2, h, cx - t / 2, h,
          cx - t / 2, cy + t / 2, 0, cy + t / 2,
          0, cy - t / 2, cx - t / 2, cy - t / 2,
        ],
        closed: true,
      });
      break;
    }
    default:
      return; // unknown shape type, skip
  }

  konvaLayer.add(node);
}
