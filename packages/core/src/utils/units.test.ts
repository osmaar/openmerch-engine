import { describe, it, expect } from 'vitest';
import { mmToPx, pxToMm } from './units.js';

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
