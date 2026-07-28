import { describe, it, expect } from 'vitest';
import {
  mmToPx,
  roundedRectCornerRadius,
  radiusFromWidth,
  starRadii,
  arrowPointerDims,
  crossPoints,
} from './geometry.js';

describe('mmToPx()', () => {
  it('multiplies the millimeter measurement by pxPerMM', () => {
    // 300 DPI -> pxPerMM = 300 / 25.4 (a realistic value used by the renderer for print output).
    const pxPerMM = 300 / 25.4;

    expect(mmToPx(10, pxPerMM)).toBeCloseTo(10 * pxPerMM, 10);
    expect(mmToPx(200, pxPerMM)).toBeCloseTo(200 * pxPerMM, 10);
  });

  it('returns 0 for a 0mm measurement regardless of scale', () => {
    expect(mmToPx(0, 11.81)).toBe(0);
  });

  it('preserves sign for negative mm (layers positioned off the print area)', () => {
    expect(mmToPx(-5, 10)).toBe(-50);
  });

  it('scales linearly with pxPerMM', () => {
    expect(mmToPx(4, 2)).toBe(8);
    expect(mmToPx(4, 4)).toBe(16);
  });
});

describe('roundedRectCornerRadius()', () => {
  it('is 15% of the pixel width', () => {
    expect(roundedRectCornerRadius(100)).toBe(15);
    expect(roundedRectCornerRadius(200)).toBe(30);
  });
});

describe('radiusFromWidth()', () => {
  it('is half of the pixel width (used by circle and regular polygons)', () => {
    expect(radiusFromWidth(100)).toBe(50);
    expect(radiusFromWidth(37)).toBe(18.5);
  });
});

describe('starRadii()', () => {
  it('computes inner radius as 38% and outer radius as 50% of the pixel width', () => {
    expect(starRadii(100)).toEqual({ innerRadius: 38, outerRadius: 50 });
  });

  it('keeps the inner radius smaller than the outer radius for any positive width', () => {
    const { innerRadius, outerRadius } = starRadii(64);
    expect(innerRadius).toBeLessThan(outerRadius);
  });
});

describe('arrowPointerDims()', () => {
  it('computes pointerLength as 20% and pointerWidth as 15% of the pixel width', () => {
    expect(arrowPointerDims(100)).toEqual({ pointerLength: 20, pointerWidth: 15 });
  });
});

describe('crossPoints()', () => {
  it('returns 12 (x, y) pairs — 24 numbers — tracing the plus-sign outline', () => {
    const points = crossPoints(100, 60);
    expect(points).toHaveLength(24);
  });

  it('matches the exact outline for a known width/height (regression against the inline formula)', () => {
    // w=100, h=60 -> t = 30, cx = 50, cy = 30
    expect(crossPoints(100, 60)).toEqual([
      35, 0, 65, 0,
      65, 15, 100, 15,
      100, 45, 65, 45,
      65, 60, 35, 60,
      35, 45, 0, 45,
      0, 15, 35, 15,
    ]);
  });

  it('keeps every point within the shape\'s own [0,w] x [0,h] bounding box', () => {
    const w = 120;
    const h = 80;
    const points = crossPoints(w, h);

    for (let i = 0; i < points.length; i += 2) {
      const x = points[i]!;
      const y = points[i + 1]!;
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(w);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(h);
    }
  });

  it('scales proportionally with width/height (arm thickness stays 30% of width)', () => {
    const small = crossPoints(100, 100);
    const large = crossPoints(200, 200);

    // Left edge of the vertical arm: cx - t/2 = w/2 - (w*0.3)/2 = w*0.35
    expect(small[0]).toBe(35);
    expect(large[0]).toBe(70);
  });
});
