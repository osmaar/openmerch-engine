import { describe, it, expect } from 'vitest';
import { computePrintZoneCropRect, buildExportMeta } from './exportDesign.js';

describe('computePrintZoneCropRect()', () => {
  it('re-expresses the print zone relative to the mockup crop origin, then scales by pixelRatio', () => {
    const layout = { printX: 50, printY: 60, printW: 200, printH: 300 };

    const result = computePrintZoneCropRect(layout, /* cropX */ 10, /* cropY */ 20, /* pixelRatio */ 2);

    // pzX = (printX - cropX) * pixelRatio, pzY = (printY - cropY) * pixelRatio
    expect(result).toEqual({ pzX: 80, pzY: 80, pzW: 400, pzH: 600 });
  });

  it('does not offset the print zone when the crop origin is (0, 0)', () => {
    const layout = { printX: 50, printY: 60, printW: 200, printH: 300 };

    const result = computePrintZoneCropRect(layout, 0, 0, 1);

    expect(result).toEqual({ pzX: 50, pzY: 60, pzW: 200, pzH: 300 });
  });

  it('produces a negative pz origin when the crop starts after the print zone (mockup crop misses part of the print area)', () => {
    const layout = { printX: 10, printY: 10, printW: 100, printH: 100 };

    const result = computePrintZoneCropRect(layout, /* cropX */ 30, /* cropY */ 30, /* pixelRatio */ 1);

    expect(result.pzX).toBe(-20);
    expect(result.pzY).toBe(-20);
  });

  it('scales width/height by pixelRatio independently of the crop origin', () => {
    const layout = { printX: 0, printY: 0, printW: 150, printH: 90 };

    const atRatio1 = computePrintZoneCropRect(layout, 5, 5, 1);
    const atRatio625 = computePrintZoneCropRect(layout, 5, 5, 6.25); // e.g. 600 DPI / 96

    expect(atRatio1.pzW).toBe(150);
    expect(atRatio1.pzH).toBe(90);
    expect(atRatio625.pzW).toBe(150 * 6.25);
    expect(atRatio625.pzH).toBe(90 * 6.25);
  });
});

describe('buildExportMeta()', () => {
  it('derives widthMm/heightMm from the print-zone layout and appends .png to the filename', () => {
    const layout = { printX: 0, printY: 0, printW: 200, printH: 300, pxPerMM: 2 };

    const meta = buildExportMeta(layout, 'shirt_default_abc123', 'abc123', 'prod-1', null);

    expect(meta).toEqual({
      designKey: 'abc123',
      filename: 'shirt_default_abc123.png',
      widthMm: 100,
      heightMm: 150,
      productId: 'prod-1',
    });
  });

  it('includes variantId only when one is provided', () => {
    const layout = { printX: 0, printY: 0, printW: 100, printH: 100, pxPerMM: 1 };

    const withVariant = buildExportMeta(layout, 'design', 'key', 'prod-1', 'variant-1');
    const withoutVariant = buildExportMeta(layout, 'design', 'key', 'prod-1', null);

    expect(withVariant.variantId).toBe('variant-1');
    expect(withoutVariant.variantId).toBeUndefined();
    expect('variantId' in withoutVariant).toBe(false);
  });
});
