import { useState, useEffect } from 'react';
import { tintImagePixels, isWhiteTintColor } from '@openmerch/core';

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

    if (isWhiteTintColor(color)) {
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
    tintImagePixels(imageData, color);

    ctx.putImageData(imageData, 0, 0);
    setResult(canvas);
  }, [baseImage, color]);

  return result;
}
