import type { TextEffect } from '@openmerch/core';

export function generateTextPath(
  effect: TextEffect,
  textWidth: number,
): string | null {
  if (effect.type === 'none') return null;

  const w = Math.max(textWidth, 100);
  const r = effect.radius;

  switch (effect.type) {
    case 'curved':
      return curvedPath(w, r);
    case 'bridge':
      return bridgePath(w, r);
    case 'wave':
      return wavePath(w, r);
    default:
      return null;
  }
}

// Arc curve: positive radius = curve up, negative = curve down
function curvedPath(width: number, radius: number): string {
  const r = Math.max(Math.abs(radius), width / 2 + 1);
  const sweep = radius >= 0 ? 0 : 1;
  return `M 0,0 A ${r},${r} 0 0,${sweep} ${width},0`;
}

// Bridge: quadratic bezier that arches in the middle
function bridgePath(width: number, radius: number): string {
  const h = Math.abs(radius) * 0.5;
  const mid = width / 2;
  const dir = radius >= 0 ? -1 : 1;
  return `M 0,0 Q ${mid},${dir * h} ${width},0`;
}

// Oblique/Wave: S-curve using cubic bezier
function wavePath(width: number, amplitude: number): string {
  const h = Math.abs(amplitude) * 0.3;
  const q1 = width / 4;
  const q2 = width / 2;
  const q3 = (width * 3) / 4;
  return `M 0,0 C ${q1},${-h} ${q1},${-h} ${q2},0 C ${q3},${h} ${q3},${h} ${width},0`;
}
