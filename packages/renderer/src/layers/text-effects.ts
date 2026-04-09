/* eslint-disable @typescript-eslint/no-explicit-any */
// Per-character placement for curved/bridge/wave text effects.
//
// This is a direct port of packages/editor/src/components/CurvedText.tsx so
// the production output matches what the customer saw in the editor exactly.
// Any layout change to CurvedText.tsx must be mirrored here (it's the price
// of zero-divergence rendering — same algorithm running in two places).

import { createCanvas } from 'canvas';
import type { TextEffect } from '@openmerch/core';

interface CharPosition {
  char: string;
  x: number;
  y: number;
  rotation: number;
}

/**
 * Measures each character's width using node-canvas's `measureText`. Mirrors
 * the editor's `measureCharWidths` (which uses the browser canvas API).
 */
function measureCharWidths(
  text: string,
  fontSize: number,
  fontFamily: string,
  fontStyle: string,
): number[] {
  const canvas = createCanvas(1, 1);
  const ctx = canvas.getContext('2d');
  ctx.font = `${fontStyle} ${fontSize}px ${fontFamily}`;
  return text.split('').map((ch) => ctx.measureText(ch).width);
}

// CURVED: text follows a circular arc.
function curvedPositions(
  text: string,
  charWidths: number[],
  radius: number,
  extraSpacing: number,
  curve: number,
  heightOffset: number,
  xOffset: number,
): CharPosition[] {
  const absR = Math.max(Math.abs(radius) + curve, 50);
  const up = radius >= 0;

  const totalWidth = charWidths.reduce(
    (sum, w, i) => sum + w + (i < charWidths.length - 1 ? extraSpacing : 0),
    0,
  );
  const totalAngle = totalWidth / absR;

  let angle = -Math.PI / 2 - totalAngle / 2;
  const positions: CharPosition[] = [];

  for (let i = 0; i < text.length; i++) {
    const charW = charWidths[i]!;
    angle += charW / 2 / absR;

    const cx = Math.cos(angle) * absR;
    const cy = Math.sin(angle) * absR;

    if (up) {
      positions.push({
        char: text[i]!,
        x: cx + xOffset,
        y: cy + absR + heightOffset,
        rotation: (angle + Math.PI / 2) * (180 / Math.PI),
      });
    } else {
      positions.push({
        char: text[i]!,
        x: -cx + xOffset,
        y: -cy - absR + heightOffset,
        rotation: -(angle + Math.PI / 2) * (180 / Math.PI),
      });
    }

    angle += (charW / 2 + extraSpacing) / absR;
  }

  // Center horizontally — same as the editor.
  if (positions.length > 0) {
    const minX = Math.min(...positions.map((p) => p.x));
    const maxX = Math.max(...positions.map((p) => p.x));
    const midX = (minX + maxX) / 2;
    for (const pos of positions) pos.x -= midX;
  }

  return positions;
}

// BRIDGE: parabolic arch.
function bridgePositions(
  text: string,
  charWidths: number[],
  radius: number,
  extraSpacing: number,
  curve: number,
  heightOffset: number,
  xOffset: number,
): CharPosition[] {
  const totalWidth = charWidths.reduce(
    (sum, w, i) => sum + w + (i < charWidths.length - 1 ? extraSpacing : 0),
    0,
  );
  const archHeight = (Math.abs(radius) + curve) * 0.8;
  const up = radius >= 0;

  const positions: CharPosition[] = [];
  let currentX = 0;

  for (let i = 0; i < text.length; i++) {
    const charW = charWidths[i]!;
    const centerX = currentX + charW / 2;
    const t = totalWidth > 0 ? (centerX / totalWidth) * 2 - 1 : 0;
    const parabola = 1 - t * t;
    const y = up ? -archHeight * parabola : archHeight * parabola;

    const slopeRaw = up ? 2 * t * archHeight : -2 * t * archHeight;
    const slope = slopeRaw / (totalWidth / 2);
    const angleDeg = Math.atan(slope) * (180 / Math.PI);

    positions.push({
      char: text[i]!,
      x: centerX - totalWidth / 2 + xOffset,
      y: y + (up ? archHeight : 0) + heightOffset,
      rotation: angleDeg,
    });

    currentX += charW + extraSpacing;
  }

  return positions;
}

// WAVE / OBLIQUE: diagonal line.
function obliquePositions(
  text: string,
  charWidths: number[],
  radius: number,
  extraSpacing: number,
  curve: number,
  heightOffset: number,
  xOffset: number,
): CharPosition[] {
  const totalWidth = charWidths.reduce(
    (sum, w, i) => sum + w + (i < charWidths.length - 1 ? extraSpacing : 0),
    0,
  );
  const rise = (Math.abs(radius) + curve) * 0.6;
  const up = radius >= 0;

  const angleDeg = Math.atan((up ? -rise : rise) / (totalWidth || 1)) * (180 / Math.PI);

  const positions: CharPosition[] = [];
  let currentX = 0;

  for (let i = 0; i < text.length; i++) {
    const charW = charWidths[i]!;
    const centerX = currentX + charW / 2;
    const t = totalWidth > 0 ? centerX / totalWidth : 0.5;
    const y = up ? rise * (1 - t) : rise * t;

    positions.push({
      char: text[i]!,
      x: centerX - totalWidth / 2 + xOffset,
      y: y + heightOffset,
      rotation: angleDeg,
    });

    currentX += charW + extraSpacing;
  }

  return positions;
}

/**
 * Computes the per-character positions for the given effect type. Returns
 * `null` if the effect is `none` (caller should render plain text instead).
 */
export function computeEffectPositions(
  text: string,
  effect: TextEffect,
  fontSize: number,
  fontFamily: string,
  fontStyle: string,
  letterSpacing: number,
): { positions: CharPosition[]; charWidths: number[] } | null {
  if (!text || effect.type === 'none') return null;

  const charWidths = measureCharWidths(text, fontSize, fontFamily, fontStyle);
  const spacing = letterSpacing + effect.spacing;

  let positions: CharPosition[];
  switch (effect.type) {
    case 'curved':
      positions = curvedPositions(text, charWidths, effect.radius, spacing, effect.curve, effect.height, effect.offset);
      break;
    case 'bridge':
      positions = bridgePositions(text, charWidths, effect.radius, spacing, effect.curve, effect.height, effect.offset);
      break;
    case 'wave':
      positions = obliquePositions(text, charWidths, effect.radius, spacing, effect.curve, effect.height, effect.offset);
      break;
    default:
      return null;
  }

  return { positions, charWidths };
}
