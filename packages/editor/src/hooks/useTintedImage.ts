import { useState, useEffect } from 'react';

export function useTintedImage(
  baseImage: HTMLImageElement | undefined,
  tint: string | undefined,
  tintOpacity: number | undefined,
): HTMLCanvasElement | HTMLImageElement | undefined {
  const [result, setResult] = useState<HTMLCanvasElement | HTMLImageElement | undefined>(baseImage);

  useEffect(() => {
    if (!baseImage) {
      setResult(undefined);
      return;
    }

    if (!tint || !tintOpacity || tintOpacity <= 0) {
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

    // Draw original image
    ctx.drawImage(baseImage, 0, 0);

    // Apply tint using source-atop (only paints where image has pixels)
    ctx.globalCompositeOperation = 'source-atop';
    ctx.globalAlpha = tintOpacity;
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    setResult(canvas);
  }, [baseImage, tint, tintOpacity]);

  return result;
}
