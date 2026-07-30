import { describe, it, expect } from 'vitest';
import { unpremultiplyAlpha, type UnpremultipliableImage } from './unpremultiply-alpha.js';

function makeImage(pixels: [number, number, number, number][]): UnpremultipliableImage {
  const data = new Uint8ClampedArray(pixels.length * 4);
  pixels.forEach(([r, g, b, a], i) => {
    data[i * 4] = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = a;
  });
  return { data, width: pixels.length, height: 1 };
}

describe('unpremultiplyAlpha', () => {
  it('leaves fully opaque pixels unchanged', () => {
    const image = makeImage([[200, 100, 50, 255]]);
    unpremultiplyAlpha(image);
    expect(Array.from(image.data)).toEqual([200, 100, 50, 255]);
  });

  it('leaves fully transparent pixels unchanged (no divide-by-zero)', () => {
    const image = makeImage([[0, 0, 0, 0]]);
    unpremultiplyAlpha(image);
    expect(Array.from(image.data)).toEqual([0, 0, 0, 0]);
  });

  it('recovers the true color from a premultiplied pixel', () => {
    // True color (200, 100, 50) premultiplied at alpha=51 (20%): stored = true * (51/255).
    const image = makeImage([[40, 20, 10, 51]]);
    unpremultiplyAlpha(image);
    const [r, g, b, a] = Array.from(image.data);
    expect(r).toBeCloseTo(200, -1);
    expect(g).toBeCloseTo(100, -1);
    expect(b).toBeCloseTo(50, -1);
    expect(a).toBe(51);
  });

  it('recovers a consistent true color across multiple alpha levels for the same underlying color', () => {
    // Same true color (128, 64, 32) premultiplied at two different alpha levels.
    const image = makeImage([
      [30, 15, 8, 60], // alpha ~24%
      [75, 38, 19, 150], // alpha ~59%
    ]);
    unpremultiplyAlpha(image);
    const px1 = Array.from(image.data.slice(0, 3)) as number[];
    const px2 = Array.from(image.data.slice(4, 7)) as number[];
    expect(px1[0]).toBeCloseTo(px2[0]!, -1);
    expect(px1[1]).toBeCloseTo(px2[1]!, -1);
    expect(px1[2]).toBeCloseTo(px2[2]!, -1);
  });

  it('clamps the unpremultiplied result to 255', () => {
    // Stored RGB that, scaled by 255/alpha, would exceed 255.
    const image = makeImage([[250, 250, 250, 200]]);
    unpremultiplyAlpha(image);
    const [r, g, b] = Array.from(image.data);
    expect(r).toBe(255);
    expect(g).toBe(255);
    expect(b).toBe(255);
  });
});
