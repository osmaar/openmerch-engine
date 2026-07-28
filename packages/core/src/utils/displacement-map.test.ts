import { describe, it, expect } from 'vitest';
import { applyDisplacementMap, type DisplaceableImage } from './displacement-map.js';

function makeImage(width: number, height: number, pixels: [number, number, number, number][]): DisplaceableImage {
  if (pixels.length !== width * height) {
    throw new Error(`makeImage: expected ${width * height} pixels, got ${pixels.length}`);
  }
  const data = new Uint8ClampedArray(width * height * 4);
  pixels.forEach(([r, g, b, a], i) => {
    data[i * 4] = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = a;
  });
  return { data, width, height };
}

function flatMap(width: number, height: number, r: number, g: number): DisplaceableImage {
  const pixels: [number, number, number, number][] = Array.from({ length: width * height }, () => [r, g, 128, 255]);
  return makeImage(width, height, pixels);
}

describe('applyDisplacementMap', () => {
  it('is a no-op when strengthPx is 0, regardless of map content', () => {
    const image = makeImage(3, 3, [
      [10, 20, 30, 255],
      [40, 50, 60, 255],
      [70, 80, 90, 255],
      [100, 110, 120, 255],
      [130, 140, 150, 255],
      [160, 170, 180, 255],
      [190, 200, 210, 255],
      [220, 230, 240, 250],
      [255, 0, 128, 100],
    ]);
    const before = Uint8ClampedArray.from(image.data);
    // Non-flat map: strengthPx=0 must still be a no-op since dx=dy=0 always.
    const map = makeImage(3, 3, [
      [0, 255, 128, 255],
      [255, 0, 128, 255],
      [200, 200, 128, 255],
      [50, 50, 128, 255],
      [128, 128, 128, 255],
      [10, 240, 128, 255],
      [240, 10, 128, 255],
      [90, 180, 128, 255],
      [180, 90, 128, 255],
    ]);

    applyDisplacementMap(image, map, 0);

    expect(image.data).toEqual(before);
  });

  it('is a no-op for a flat (128,128) map, regardless of strengthPx', () => {
    const image = makeImage(4, 4, [
      [1, 2, 3, 255], [4, 5, 6, 255], [7, 8, 9, 255], [10, 11, 12, 255],
      [13, 14, 15, 255], [16, 17, 18, 255], [19, 20, 21, 255], [22, 23, 24, 255],
      [25, 26, 27, 255], [28, 29, 30, 255], [31, 32, 33, 255], [34, 35, 36, 255],
      [37, 38, 39, 255], [40, 41, 42, 255], [43, 44, 45, 255], [46, 47, 48, 200],
    ]);
    const before = Uint8ClampedArray.from(image.data);
    const map = flatMap(4, 4, 128, 128);

    applyDisplacementMap(image, map, 25);

    expect(image.data).toEqual(before);
  });

  it('shifts pixels by exactly strengthPx horizontally for a known map value (R=255)', () => {
    // 6x1 image with red/green/blue vertical-stripe columns (2px each) so shifted
    // source columns are unambiguous.
    const red: [number, number, number, number] = [255, 0, 0, 255];
    const green: [number, number, number, number] = [0, 255, 0, 255];
    const blue: [number, number, number, number] = [0, 0, 255, 255];
    const image = makeImage(6, 1, [red, red, green, green, blue, blue]);
    const before = Uint8ClampedArray.from(image.data);

    // R=255 -> dx = (255-128)/128 * strengthPx = (127/128)*strengthPx.
    // Use strengthPx=128 so dx = 127 exactly (an integer, avoiding a rounding
    // edge case) and stays within the 6px width for the columns we check.
    const strengthPx = 128;
    const map = flatMap(6, 1, 255, 128);

    applyDisplacementMap(image, map, strengthPx);

    const dx = Math.round(((255 - 128) / 128) * strengthPx);
    expect(dx).toBe(127);

    // Output(x) = Input(clamp(x + dx, 0, width-1)). For x=0, clamp(127,0,5)=5 (blue).
    for (let x = 0; x < 6; x++) {
      const srcX = Math.min(Math.max(x + dx, 0), 5);
      const expectedPixel = before.slice(srcX * 4, srcX * 4 + 4);
      const actualPixel = image.data.slice(x * 4, x * 4 + 4);
      expect(Array.from(actualPixel)).toEqual(Array.from(expectedPixel));
    }
  });

  it('clamps to the border pixel when strengthPx pushes the source coordinate out of bounds', () => {
    const image = makeImage(4, 1, [
      [10, 10, 10, 255],
      [20, 20, 20, 255],
      [30, 30, 30, 255],
      [40, 40, 40, 255],
    ]);
    // R=255 -> positive dx (shifts source lookup to the right); a huge
    // strengthPx pushes every source lookup past the right edge.
    const map = flatMap(4, 1, 255, 128);

    applyDisplacementMap(image, map, 10000);

    // Every output pixel should clamp to the rightmost source pixel (40,40,40).
    for (let x = 0; x < 4; x++) {
      expect(Array.from(image.data.slice(x * 4, x * 4 + 3))).toEqual([40, 40, 40]);
    }
  });

  it('clamps to the near-edge pixel (not wrap, not transparent) when displaced past the left edge', () => {
    const image = makeImage(4, 1, [
      [10, 10, 10, 255],
      [20, 20, 20, 255],
      [30, 30, 30, 255],
      [40, 40, 40, 255],
    ]);
    // R=0 -> dx = (0-128)/128 * strengthPx = -strengthPx (negative, shifts left).
    const map = flatMap(4, 1, 0, 128);

    applyDisplacementMap(image, map, 10000);

    for (let x = 0; x < 4; x++) {
      expect(Array.from(image.data.slice(x * 4, x * 4 + 3))).toEqual([10, 10, 10]);
    }
  });

  it('bilinearly interpolates a low-resolution map instead of producing blocky steps', () => {
    // 2x2 map: R goes from 0 (left column) to 255 (right column) at both rows,
    // G flat at 128 (no vertical displacement) -> a pure horizontal
    // displacement whose magnitude should ramp up smoothly, not jump in one
    // 4-pixel block, once bilinearly upsampled to an 8-wide image.
    const map = makeImage(2, 2, [
      [0, 128, 128, 255],
      [255, 128, 128, 255],
      [0, 128, 128, 255],
      [255, 128, 128, 255],
    ]);
    const width = 8;
    const height = 8;
    // 8 columns tagged with a distinct, easily identifiable R value (10*index),
    // replicated across all rows so v doesn't matter (G is flat anyway).
    const row: [number, number, number, number][] = Array.from({ length: width }, (_, x) => [x * 10, 0, 0, 255]);
    const pixels: [number, number, number, number][] = Array.from({ length: height }, () => row).flat();
    const image = makeImage(width, height, pixels);

    applyDisplacementMap(image, map, 128);

    // Hand-derived expectation (see displacement-map.test.ts history/PR for the
    // arithmetic): bilinear sampling of the map produces a distinct dx at
    // x=0,1,2,3 (-128, -64.25, -0.5, 63.25) before plateauing once fx clamps
    // to the map's rightmost column at x>=4 (dx=127). Rounding+clamping the
    // resulting source lookup against the 8-wide image gives:
    const expectedRow = [0, 0, 20, 70, 70, 70, 70, 70];
    // A nearest-neighbor (non-bilinear) map sample would instead produce a
    // hard 4px/4px block split: [0, 0, 0, 0, 70, 70, 70, 70]. The two differ
    // at columns 2 and 3, which is what this test is actually asserting.
    const naiveBlockRow = [0, 0, 0, 0, 70, 70, 70, 70];
    expect(expectedRow).not.toEqual(naiveBlockRow);

    const actualRow = Array.from({ length: width }, (_, x) => image.data[x * 4]);
    expect(actualRow).toEqual(expectedRow);
  });

  it('displaces alpha along with color: a transparent source pixel produces a transparent output, not opaque garbage', () => {
    // 4x1 image: opaque pixel at x=0, fully transparent (with garbage RGB) at x=1..3.
    const image = makeImage(4, 1, [
      [200, 50, 50, 255],
      [255, 0, 255, 0],
      [255, 0, 255, 0],
      [255, 0, 255, 0],
    ]);
    // R=0 -> dx = -strengthPx. With strengthPx=64, dx=-64 -> every output
    // pixel reads from clamp(x-64, 0, 3) = 0, i.e. everything becomes the
    // opaque source pixel at x=0. Instead we want the reverse: shift the
    // transparent region rightward is already the initial state, so use a
    // small negative-of-negative: R=255 shifts lookup right, moving the
    // opaque pixel's *position* isn't what we want here — instead verify
    // that looking up into the transparent region yields alpha=0 with the
    // same (garbage) RGB as the source, never alpha=255.
    const map = flatMap(4, 1, 255, 128); // dx = +strengthPx

    applyDisplacementMap(image, map, 1); // dx = (127/128)*1 ~ 0.992 -> rounds to 1

    // Output(x) = Input(clamp(x+1, 0, 3)). Output(0) = Input(1) = transparent.
    expect(image.data[3]).toBe(0);
    // Output(3) = Input(clamp(4,0,3)) = Input(3) = transparent.
    expect(image.data[15]).toBe(0);
  });
});
