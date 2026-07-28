import { describe, it, expect } from 'vitest';
import { createCanvas } from 'canvas';
import type { ProductZone, ShapeLayer } from '@openmerch/core';
import { renderDesignZoneMockup } from './render-zone-mockup.js';

const DISPLACEMENT_MAP_SRC = 'maps/front-displacement.png';

/** A non-flat two-channel displacement map (see displacement-map.ts for the
 *  R/G-centered-at-128 format) so applying it actually moves pixels around,
 *  instead of a uniform 128 map that would be a no-op regardless of strength. */
function makeDisplacementMapBuffer(size: number): Buffer {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, 'rgb(0, 255, 128)');
  gradient.addColorStop(1, 'rgb(255, 0, 128)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return canvas.toBuffer('image/png');
}

function makeZone(withDisplacement: boolean): ProductZone {
  return {
    id: 'zone-1',
    name: 'Front',
    baseImageWidthMM: 60,
    baseImageHeightMM: 60,
    printAreaWidthMM: 40,
    printAreaHeightMM: 40,
    printAreaXMM: 10,
    printAreaYMM: 10,
    // No real base/overlay asset needed for this test — empty string keeps
    // renderDesignZoneMockup's `if (options.zone.baseImageUrl)` check falsy.
    baseImageUrl: '',
    ...(withDisplacement
      ? { displacementMapUrl: DISPLACEMENT_MAP_SRC, displacementStrengthMM: 3 }
      : {}),
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

describe('renderDesignZoneMockup — displacement map integration', () => {
  it('produces a different buffer than the non-displaced render when zone.displacementMapUrl is set', async () => {
    const mapBuffer = makeDisplacementMapBuffer(64);
    const resolveImage = async (src: string): Promise<Buffer> => {
      if (src === DISPLACEMENT_MAP_SRC) return mapBuffer;
      throw new Error(`unexpected resolveImage call in test: ${src}`);
    };
    const layers = [makeShapeLayer()];

    const withDisplacement = await renderDesignZoneMockup({
      zone: makeZone(true),
      layers,
      resolveImage,
    });
    const withoutDisplacement = await renderDesignZoneMockup({
      zone: makeZone(false),
      layers,
      resolveImage,
    });

    // Same canvas size either way — displacement only changes the design's
    // pixel content, never the mockup's dimensions.
    expect(withDisplacement.widthPx).toBe(withoutDisplacement.widthPx);
    expect(withDisplacement.heightPx).toBe(withoutDisplacement.heightPx);
    expect(Buffer.compare(withDisplacement.buffer, withoutDisplacement.buffer)).not.toBe(0);
  });

  it('falls back to the plain (non-displaced) path without throwing when displacementMapUrl is set but resolveImage is missing', async () => {
    const result = await renderDesignZoneMockup({
      zone: makeZone(true),
      layers: [makeShapeLayer()],
    });

    expect(result.buffer.length).toBeGreaterThan(0);
  });
});
