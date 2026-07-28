import { describe, it, expect } from 'vitest';
import { curvedPositions, bridgePositions, obliquePositions, computeEffectPositions } from './text-effects.js';
import type { TextEffect } from '../types/index.js';

describe('curvedPositions', () => {
  it('returns an empty array for empty text', () => {
    expect(curvedPositions('', [], 100, 0, 0, 0, 0)).toEqual([]);
  });

  it('does not divide by zero for a single character', () => {
    const positions = curvedPositions('A', [10], 100, 0, 0, 0, 0);
    expect(positions).toHaveLength(1);
    expect(Number.isFinite(positions[0]!.x)).toBe(true);
    expect(Number.isFinite(positions[0]!.y)).toBe(true);
    expect(Number.isFinite(positions[0]!.rotation)).toBe(true);
    expect(positions[0]!.x).toBeCloseTo(0, 6);
    expect(positions[0]!.y).toBeCloseTo(0, 6);
    expect(positions[0]!.rotation).toBeCloseTo(0, 6);
  });

  it('is horizontally centered around x = 0', () => {
    const positions = curvedPositions('AB', [10, 10], 100, 2, 0, 0, 0);
    const minX = Math.min(...positions.map((p) => p.x));
    const maxX = Math.max(...positions.map((p) => p.x));
    expect((minX + maxX) / 2).toBeCloseTo(0, 6);
  });

  it('matches known values for a positive radius (arcs upward)', () => {
    const [a, b] = curvedPositions('AB', [10, 10], 100, 2, 0, 0, 0);
    expect(a!.x).toBeCloseTo(-5.996400647944465, 9);
    expect(a!.y).toBeCloseTo(0.17994600647958237, 9);
    expect(a!.rotation).toBeCloseTo(-3.4377467707849423, 9);
    expect(b!.x).toBeCloseTo(5.996400647944465, 9);
    expect(b!.y).toBeCloseTo(0.17994600647958237, 9);
    expect(b!.rotation).toBeCloseTo(3.4377467707849423, 9);
  });

  it('mirrors x/rotation and flips y for a negative radius (arcs downward)', () => {
    const [a, b] = curvedPositions('AB', [10, 10], -100, 2, 0, 0, 0);
    expect(a!.x).toBeCloseTo(5.996400647944465, 9);
    expect(a!.y).toBeCloseTo(-0.17994600647958237, 9);
    expect(a!.rotation).toBeCloseTo(3.4377467707849423, 9);
    expect(b!.x).toBeCloseTo(-5.996400647944465, 9);
    expect(b!.y).toBeCloseTo(-0.17994600647958237, 9);
    expect(b!.rotation).toBeCloseTo(-3.4377467707849423, 9);
  });
});

describe('bridgePositions', () => {
  it('returns an empty array for empty text', () => {
    expect(bridgePositions('', [], 100, 0, 0, 0, 0)).toEqual([]);
  });

  it('does not divide by zero for a single character', () => {
    const positions = bridgePositions('A', [10], 100, 0, 0, 0, 0);
    expect(positions).toHaveLength(1);
    expect(Number.isFinite(positions[0]!.x)).toBe(true);
    expect(Number.isFinite(positions[0]!.y)).toBe(true);
    expect(Number.isFinite(positions[0]!.rotation)).toBe(true);
  });

  it('is horizontally centered around x = 0 when xOffset is 0', () => {
    const positions = bridgePositions('ABC', [10, 10, 10], 100, 2, 0, 0, 0);
    expect(positions.map((p) => p.x)).toEqual([-12, 0, 12]);
  });

  it('arches upward for a positive radius: center is higher (smaller y) than the edges', () => {
    const [a, b, c] = bridgePositions('ABC', [10, 10, 10], 100, 2, 0, 0, 5);
    expect(a!.x).toBeCloseTo(-7, 9);
    expect(a!.y).toBeCloseTo(39.861591695501716, 9);
    expect(a!.rotation).toBeCloseTo(-81.440051730537, 6);
    expect(b!.x).toBeCloseTo(5, 9);
    expect(b!.y).toBeCloseTo(0, 9);
    expect(b!.rotation).toBeCloseTo(0, 9);
    expect(c!.x).toBeCloseTo(17, 9);
    expect(c!.y).toBeCloseTo(39.861591695501716, 9);
    expect(c!.rotation).toBeCloseTo(81.440051730537, 6);
    expect(b!.y).toBeLessThan(a!.y);
  });

  it('dips downward for a negative radius: center is lower (larger y) than the edges', () => {
    const [a, b, c] = bridgePositions('ABC', [10, 10, 10], -100, 2, 0, 0, 5);
    expect(a!.y).toBeCloseTo(40.138408304498284, 9);
    expect(b!.y).toBeCloseTo(80, 9);
    expect(c!.y).toBeCloseTo(40.138408304498284, 9);
    expect(b!.y).toBeGreaterThan(a!.y);
  });
});

describe('obliquePositions', () => {
  it('returns an empty array for empty text', () => {
    expect(obliquePositions('', [], 100, 0, 0, 0, 0)).toEqual([]);
  });

  it('does not divide by zero for a single character', () => {
    const positions = obliquePositions('A', [10], 100, 0, 0, 0, 0);
    expect(positions).toHaveLength(1);
    expect(Number.isFinite(positions[0]!.x)).toBe(true);
    expect(Number.isFinite(positions[0]!.y)).toBe(true);
    expect(Number.isFinite(positions[0]!.rotation)).toBe(true);
  });

  it('is horizontally centered around x = 0 when xOffset is 0', () => {
    const positions = obliquePositions('ABC', [10, 10, 10], 100, 2, 0, 0, 0);
    expect(positions.map((p) => p.x)).toEqual([-12, 0, 12]);
  });

  it('ascends left-to-right for a positive radius', () => {
    const [a, b, c] = obliquePositions('ABC', [10, 10, 10], 100, 2, 0, 0, 3);
    expect(a!.y).toBeCloseTo(51.17647058823529, 9);
    expect(b!.y).toBeCloseTo(30, 9);
    expect(c!.y).toBeCloseTo(8.823529411764708, 9);
    expect(a!.rotation).toBeCloseTo(-60.4612177404419, 6);
    expect(a!.y).toBeGreaterThan(c!.y);
  });

  it('descends left-to-right for a negative radius', () => {
    const [a, b, c] = obliquePositions('ABC', [10, 10, 10], -100, 2, 0, 0, 3);
    expect(a!.y).toBeCloseTo(8.823529411764707, 9);
    expect(b!.y).toBeCloseTo(30, 9);
    expect(c!.y).toBeCloseTo(51.17647058823529, 9);
    expect(a!.rotation).toBeCloseTo(60.4612177404419, 6);
    expect(a!.y).toBeLessThan(c!.y);
  });
});

describe('computeEffectPositions', () => {
  const baseEffect: TextEffect = { type: 'curved', radius: 100, spacing: 1, curve: 0, height: 0, offset: 0 };

  it('returns null when the effect type is "none"', () => {
    expect(computeEffectPositions('Hello', { ...baseEffect, type: 'none' }, [10, 10, 10, 10, 10], 0)).toBeNull();
  });

  it('returns null for empty text even with an active effect', () => {
    expect(computeEffectPositions('', baseEffect, [], 0)).toBeNull();
  });

  it('adds letterSpacing and effect.spacing before delegating to curvedPositions', () => {
    const viaCompute = computeEffectPositions('AB', baseEffect, [10, 10], 1);
    const direct = curvedPositions('AB', [10, 10], 100, 2, 0, 0, 0);
    expect(viaCompute).toEqual(direct);
  });

  it('dispatches "bridge" to bridgePositions', () => {
    const effect: TextEffect = { type: 'bridge', radius: 100, spacing: 2, curve: 0, height: 0, offset: 5 };
    const viaCompute = computeEffectPositions('ABC', effect, [10, 10, 10], 0);
    const direct = bridgePositions('ABC', [10, 10, 10], 100, 2, 0, 0, 5);
    expect(viaCompute).toEqual(direct);
  });

  it('dispatches "wave" to obliquePositions', () => {
    const effect: TextEffect = { type: 'wave', radius: 100, spacing: 2, curve: 0, height: 0, offset: 3 };
    const viaCompute = computeEffectPositions('ABC', effect, [10, 10, 10], 0);
    const direct = obliquePositions('ABC', [10, 10, 10], 100, 2, 0, 0, 3);
    expect(viaCompute).toEqual(direct);
  });
});
