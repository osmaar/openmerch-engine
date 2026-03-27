import { useState, useEffect } from 'react';

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

export function useColoredProduct(
  baseImage: HTMLImageElement | null,
  color: string,
): HTMLCanvasElement | HTMLImageElement | null {
  const [result, setResult] = useState<HTMLCanvasElement | HTMLImageElement | null>(baseImage);

  useEffect(() => {
    if (!baseImage) {
      setResult(null);
      return;
    }

    if (color === '#FFFFFF' || color === '#ffffff' || !color) {
      setResult(baseImage);
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = baseImage.width;
    canvas.height = baseImage.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setResult(baseImage);
      return;
    }

    ctx.drawImage(baseImage, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const [cr, cg, cb] = hexToRgb(color);

    // Detect if image has transparency
    let hasTransparency = false;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i]! < 250) {
        hasTransparency = true;
        break;
      }
    }

    // Detect if background is dark (sample corners)
    const samplePixels = [
      0, // top-left
      (canvas.width - 1) * 4, // top-right
      (canvas.height - 1) * canvas.width * 4, // bottom-left
      ((canvas.height - 1) * canvas.width + canvas.width - 1) * 4, // bottom-right
    ];
    let darkCorners = 0;
    for (const idx of samplePixels) {
      const lum = data[idx]! * 0.299 + data[idx + 1]! * 0.587 + data[idx + 2]! * 0.114;
      if (lum < 50) darkCorners++;
    }
    const hasDarkBackground = darkCorners >= 3;

    const DARK_THRESHOLD = 40;
    const LIGHT_THRESHOLD = 240;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i]!;
      const g = data[i + 1]!;
      const b = data[i + 2]!;
      const a = data[i + 3]!;

      // Skip transparent pixels
      if (a < 10) continue;

      if (hasTransparency) {
        // Image with alpha: tint all visible pixels
        const lum = r * 0.299 + g * 0.587 + b * 0.114;
        data[i] = Math.round((lum / 255) * cr);
        data[i + 1] = Math.round((lum / 255) * cg);
        data[i + 2] = Math.round((lum / 255) * cb);
      } else if (hasDarkBackground) {
        // Dark background: skip dark pixels (background), tint light pixels (garment)
        if (r < DARK_THRESHOLD && g < DARK_THRESHOLD && b < DARK_THRESHOLD) {
          continue;
        }
        const lum = r * 0.299 + g * 0.587 + b * 0.114;
        data[i] = Math.round((lum / 255) * cr);
        data[i + 1] = Math.round((lum / 255) * cg);
        data[i + 2] = Math.round((lum / 255) * cb);
      } else {
        // Light background: skip near-white pixels, tint the rest
        if (r > LIGHT_THRESHOLD && g > LIGHT_THRESHOLD && b > LIGHT_THRESHOLD) {
          continue;
        }
        const lum = r * 0.299 + g * 0.587 + b * 0.114;
        data[i] = Math.round((lum / 255) * cr);
        data[i + 1] = Math.round((lum / 255) * cg);
        data[i + 2] = Math.round((lum / 255) * cb);
      }
    }

    ctx.putImageData(imageData, 0, 0);
    setResult(canvas);
  }, [baseImage, color]);

  return result;
}
