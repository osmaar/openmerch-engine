// Per-character placement for curved/bridge/wave text effects.
//
// The placement math itself (curvedPositions/bridgePositions/obliquePositions)
// lives in @openmerch/core so the editor (CurvedText.tsx) and this renderer
// consume the exact same algorithm — see packages/core/src/utils/text-effects.ts.
// The only thing that's genuinely renderer-specific is measuring glyph widths
// with node-canvas instead of the browser canvas API.

import { createCanvas } from 'canvas';
import type { TextEffect } from '@openmerch/core';
import { computeEffectPositions as computeCorePositions, type EffectCharPosition } from '@openmerch/core';

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
): { positions: EffectCharPosition[]; charWidths: number[] } | null {
  if (!text || effect.type === 'none') return null;

  const charWidths = measureCharWidths(text, fontSize, fontFamily, fontStyle);
  const positions = computeCorePositions(text, effect, charWidths, letterSpacing);
  if (!positions) return null;

  return { positions, charWidths };
}
