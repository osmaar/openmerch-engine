import { describe, it, expect } from 'vitest';
import { mmToPx, pxToMm, resolvePrintDpi, MAX_RENDER_DIMENSION_PX, MIN_SAFE_DPI } from './units.js';

describe('mmToPx', () => {
  it('converts mm to px at 72 DPI', () => {
    expect(mmToPx(25.4, 72)).toBeCloseTo(72);
  });

  it('converts mm to px at 300 DPI', () => {
    expect(mmToPx(25.4, 300)).toBeCloseTo(300);
  });

  it('returns 0 for 0 mm', () => {
    expect(mmToPx(0, 300)).toBe(0);
  });
});

describe('pxToMm', () => {
  it('converts px to mm at 72 DPI', () => {
    expect(pxToMm(72, 72)).toBeCloseTo(25.4);
  });

  it('converts px to mm at 300 DPI', () => {
    expect(pxToMm(300, 300)).toBeCloseTo(25.4);
  });

  it('returns 0 for 0 px', () => {
    expect(pxToMm(0, 300)).toBe(0);
  });

  it('is the inverse of mmToPx', () => {
    const mm = 150;
    const dpi = 300;
    expect(pxToMm(mmToPx(mm, dpi), dpi)).toBeCloseTo(mm);
  });
});

describe('resolvePrintDpi', () => {
  it('returns the requested DPI unchanged when the zone fits under the cap', () => {
    const result = resolvePrintDpi(200, 300, 300);
    expect(result).toEqual({ dpi: 300, wasClamped: false });
  });

  it('clamps down a real large-format zone (desk mat) that would exceed the cap at 300 DPI', () => {
    // 462x231mm at 300 DPI is ~5457x2728px, over the 4961px cap.
    const result = resolvePrintDpi(462, 231, 300);
    expect(result.wasClamped).toBe(true);
    expect(result.dpi).toBeLessThan(300);
    expect(result.dpi).toBeGreaterThanOrEqual(MIN_SAFE_DPI);

    // The clamped DPI must actually fit under the cap on the longest side.
    expect(mmToPx(462, result.dpi)).toBeLessThanOrEqual(MAX_RENDER_DIMENSION_PX);
  });

  it('never returns a DPI below MIN_SAFE_DPI even for an absurdly large zone', () => {
    const result = resolvePrintDpi(5000, 5000, 300);
    expect(result.wasClamped).toBe(true);
    expect(result.dpi).toBe(MIN_SAFE_DPI);
  });

  it('does not clamp a small zone even when a low DPI is requested', () => {
    const result = resolvePrintDpi(50, 50, 150);
    expect(result).toEqual({ dpi: 150, wasClamped: false });
  });
});
