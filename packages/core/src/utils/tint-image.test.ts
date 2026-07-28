import { describe, it, expect } from 'vitest';
import { tintImagePixels, isWhiteTintColor, type TintableImage } from './tint-image.js';

function makeImage(width: number, height: number, pixels: [number, number, number, number][]): TintableImage {
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

describe('isWhiteTintColor', () => {
  it('treats missing/empty color as white', () => {
    expect(isWhiteTintColor('')).toBe(true);
  });

  it('treats lowercase and uppercase #ffffff as white', () => {
    expect(isWhiteTintColor('#ffffff')).toBe(true);
    expect(isWhiteTintColor('#FFFFFF')).toBe(true);
  });

  it('treats any other color as non-white', () => {
    expect(isWhiteTintColor('#ff0000')).toBe(false);
  });
});

describe('tintImagePixels', () => {
  it('is a no-op for white', () => {
    const image = makeImage(2, 2, [
      [10, 20, 30, 255],
      [200, 100, 50, 255],
      [0, 0, 0, 128],
      [255, 255, 255, 0],
    ]);
    const before = Uint8ClampedArray.from(image.data);
    tintImagePixels(image, '#ffffff');
    expect(image.data).toEqual(before);
  });

  it('tints every visible pixel when the image has transparency', () => {
    // 2x2 image, every pixel semi-transparent (alpha 200 < 250) so
    // hasTransparency is true and the light/dark background guard is skipped.
    const image = makeImage(2, 2, [
      [250, 250, 250, 200], // would look like a "light background" pixel, but must still be tinted
      [10, 10, 10, 200], // would look like a "dark background" pixel, but must still be tinted
      [128, 128, 128, 200],
      [5, 5, 5, 0], // below the visibility threshold — must stay untouched
    ]);
    const untouched = [image.data[12]!, image.data[13]!, image.data[14]!, image.data[15]!];

    tintImagePixels(image, '#ff0000');

    // All 3 visible pixels tinted toward pure red (cg = cb = 0).
    for (const px of [0, 1, 2]) {
      expect(image.data[px * 4 + 1]).toBe(0);
      expect(image.data[px * 4 + 2]).toBe(0);
      expect(image.data[px * 4]).toBeGreaterThan(0);
    }
    // The fully-invisible 4th pixel is left exactly as-is.
    expect([image.data[12], image.data[13], image.data[14], image.data[15]]).toEqual(untouched);
  });

  it('detects a dark background (3+ dark corners) and skips only the dark background pixels', () => {
    // 3x3, fully opaque. Corners are (0,0), (2,0), (0,2), (2,2).
    const dark: [number, number, number, number] = [10, 10, 10, 255]; // lum ~10, "background"
    const light: [number, number, number, number] = [250, 250, 250, 255]; // lum 250, "garment"
    const image = makeImage(3, 3, [
      dark, dark, dark,
      dark, light, dark,
      dark, dark, dark,
    ]);

    tintImagePixels(image, '#00ff00');

    // Every dark-background pixel (all 8 non-center pixels) must be untouched.
    for (let i = 0; i < 9; i++) {
      if (i === 4) continue;
      expect([image.data[i * 4], image.data[i * 4 + 1], image.data[i * 4 + 2]]).toEqual([10, 10, 10]);
    }
    // The light garment pixel must be tinted (not left white/light).
    expect(image.data[4 * 4]).toBe(0); // cr = 0 for #00ff00
    expect(image.data[4 * 4 + 1]).toBeGreaterThan(0);
    expect(image.data[4 * 4 + 2]).toBe(0);
  });

  it('detects a light background and skips only the light background pixels', () => {
    const light: [number, number, number, number] = [250, 250, 250, 255];
    const dark: [number, number, number, number] = [10, 10, 10, 255];
    const image = makeImage(3, 3, [
      light, light, light,
      light, dark, light,
      light, light, light,
    ]);

    tintImagePixels(image, '#00ff00');

    for (let i = 0; i < 9; i++) {
      if (i === 4) continue;
      expect([image.data[i * 4], image.data[i * 4 + 1], image.data[i * 4 + 2]]).toEqual([250, 250, 250]);
    }
    expect(image.data[4 * 4]).toBe(0);
    expect(image.data[4 * 4 + 1]).toBeGreaterThan(0);
    expect(image.data[4 * 4 + 2]).toBe(0);
  });

  it('produces known RGB values for a pixel of a specific luminance', () => {
    // Single opaque pixel, light background of its own (itself is the only corner
    // sample, r/g/b > LIGHT threshold), gray at r=g=b=128 -> lum = 128 exactly.
    const image = makeImage(1, 1, [[128, 128, 128, 255]]);

    tintImagePixels(image, '#6432c8'); // (100, 50, 200)

    const lumFraction = 128 / 255;
    expect(image.data[0]).toBe(Math.round(lumFraction * 100));
    expect(image.data[1]).toBe(Math.round(lumFraction * 50));
    expect(image.data[2]).toBe(Math.round(lumFraction * 200));
    expect(image.data[3]).toBe(255);
  });
});
