import { describe, it, expect } from 'vitest';
import type { ProductZone, ShapeLayer } from '@openmerch/core';
import { renderDesignZone } from './render-zone.js';

function makeZone(overrides: Partial<ProductZone> = {}): ProductZone {
  return {
    id: 'zone-1',
    name: 'Front',
    baseImageWidthMM: 60,
    baseImageHeightMM: 60,
    printAreaWidthMM: 40,
    printAreaHeightMM: 40,
    printAreaXMM: 10,
    printAreaYMM: 10,
    baseImageUrl: '',
    ...overrides,
  };
}

function makeShapeLayer(): ShapeLayer {
  return {
    id: 'shape-1',
    type: 'shape',
    x: 5,
    y: 5,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    skewX: 0,
    skewY: 0,
    opacity: 1,
    locked: false,
    visible: true,
    shapeType: 'rect',
    fill: '#ff0000',
    stroke: '#000000',
    strokeWidth: 0,
    widthMM: 30,
    heightMM: 30,
  };
}

describe('renderDesignZone — DPI resolution', () => {
  it('renders a normal-sized zone at the default 300 DPI unchanged', async () => {
    const result = await renderDesignZone({ zone: makeZone(), layers: [makeShapeLayer()] });
    expect(result.dpi).toBe(300);
    expect(result.widthPx).toBe(Math.round((40 / 25.4) * 300));
    expect(result.heightPx).toBe(Math.round((40 / 25.4) * 300));
  });

  it('automatically lowers the DPI for a real large-format zone instead of throwing (desk mat size)', async () => {
    // 462x231mm at 300 DPI would be ~5457x2728px, over the renderer's safe canvas cap —
    // this used to throw "exceeding the 4961px maximum per side" for every desk mat/
    // mousepad/poster zone in the catalog.
    const zone = makeZone({ printAreaWidthMM: 462, printAreaHeightMM: 231 });
    const result = await renderDesignZone({ zone, layers: [makeShapeLayer()] });

    expect(result.dpi).toBeLessThan(300);
    expect(result.widthPx).toBeLessThanOrEqual(4961);
    expect(result.heightPx).toBeLessThanOrEqual(4961);
    expect(result.buffer.length).toBeGreaterThan(0);
  });

  it('uses an explicit zone.printDPI as-is when it fits', async () => {
    const zone = makeZone({ printDPI: 150 });
    const result = await renderDesignZone({ zone, layers: [makeShapeLayer()] });
    expect(result.dpi).toBe(150);
  });

  it('throws instead of silently lowering an explicit zone.printDPI that does not fit', async () => {
    const zone = makeZone({ printAreaWidthMM: 462, printAreaHeightMM: 231, printDPI: 300 });
    await expect(renderDesignZone({ zone, layers: [makeShapeLayer()] })).rejects.toThrow(
      /printDPI=300 explicitly set/,
    );
  });
});
