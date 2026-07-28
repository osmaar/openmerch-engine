import { describe, it, expect } from 'vitest';
import type { DesignZone, ProductVariant, ProductZone } from '@openmerch/core';
import type { ProductionZoneFiles } from '../queues.js';
import {
  ZONE_DIMENSION_TOLERANCE_MM,
  decideProductionOutcome,
  resolveRenderZone,
} from './production-files.logic.js';

function makeProductZone(overrides: Partial<ProductZone> = {}): ProductZone {
  return {
    id: 'front',
    name: 'Front',
    baseImageWidthMM: 500,
    baseImageHeightMM: 500,
    printAreaWidthMM: 200,
    printAreaHeightMM: 300,
    printAreaXMM: 10,
    printAreaYMM: 10,
    baseImageUrl: 'https://example.com/base.png',
    ...overrides,
  };
}

function makeDesignZone(overrides: Partial<DesignZone> = {}): DesignZone {
  return {
    zoneId: 'front',
    canvasWidthMM: 200,
    canvasHeightMM: 300,
    layers: [],
    ...overrides,
  };
}

function makeVariant(overrides: Partial<ProductVariant> = {}): ProductVariant {
  return {
    id: 'variant-a',
    name: 'Variant A',
    ...overrides,
  };
}

describe('resolveRenderZone', () => {
  it('uses the product zone as-is when the design dimensions match it', () => {
    const productZone = makeProductZone();
    const designZone = makeDesignZone({ canvasWidthMM: 200, canvasHeightMM: 300 });

    const result = resolveRenderZone(productZone, designZone, []);

    expect(result).toEqual({ zone: productZone, matchedVariantId: null });
  });

  it('uses a matching variant zone when the design dimensions match a variant instead', () => {
    const productZone = makeProductZone({ printAreaWidthMM: 200, printAreaHeightMM: 300 });
    const variantZone = makeProductZone({
      id: 'front',
      printAreaWidthMM: 150,
      printAreaHeightMM: 220,
      baseImageUrl: 'https://example.com/variant-base.png',
    });
    const variants: ProductVariant[] = [makeVariant({ id: 'variant-a', zones: [variantZone] })];
    const designZone = makeDesignZone({ canvasWidthMM: 150, canvasHeightMM: 220 });

    const result = resolveRenderZone(productZone, designZone, variants);

    expect(result.matchedVariantId).toBe('variant-a');
    expect(result.zone).toEqual({ ...productZone, ...variantZone });
  });

  it('only matches a variant zone with the same zone id', () => {
    const productZone = makeProductZone({ id: 'front', printAreaWidthMM: 200, printAreaHeightMM: 300 });
    const otherZone = makeProductZone({ id: 'back', printAreaWidthMM: 150, printAreaHeightMM: 220 });
    const variants: ProductVariant[] = [makeVariant({ zones: [otherZone] })];
    const designZone = makeDesignZone({ canvasWidthMM: 150, canvasHeightMM: 220 });

    const result = resolveRenderZone(productZone, designZone, variants);

    expect(result).toEqual({ zone: productZone, matchedVariantId: null });
  });

  it('falls back to the default zone without crashing when no variant matches (product edited after design creation)', () => {
    const productZone = makeProductZone({ printAreaWidthMM: 200, printAreaHeightMM: 300 });
    const staleVariantZone = makeProductZone({ printAreaWidthMM: 999, printAreaHeightMM: 999 });
    const variants: ProductVariant[] = [makeVariant({ zones: [staleVariantZone] })];
    const designZone = makeDesignZone({ canvasWidthMM: 150, canvasHeightMM: 220 });

    const result = resolveRenderZone(productZone, designZone, variants);

    expect(result).toEqual({ zone: productZone, matchedVariantId: null });
  });

  it('falls back to the default zone without crashing when there are no variants at all', () => {
    const productZone = makeProductZone({ printAreaWidthMM: 200, printAreaHeightMM: 300 });
    const designZone = makeDesignZone({ canvasWidthMM: 150, canvasHeightMM: 220 });

    const result = resolveRenderZone(productZone, designZone, []);

    expect(result).toEqual({ zone: productZone, matchedVariantId: null });
  });

  it('falls back to the default zone when the design has no recorded canvas dimensions', () => {
    const productZone = makeProductZone();
    const designZone = makeDesignZone({ canvasWidthMM: 0, canvasHeightMM: 0 });

    const result = resolveRenderZone(productZone, designZone, []);

    expect(result).toEqual({ zone: productZone, matchedVariantId: null });
  });

  it('falls back to the default zone when there is no design zone', () => {
    const productZone = makeProductZone();

    const result = resolveRenderZone(productZone, undefined, []);

    expect(result).toEqual({ zone: productZone, matchedVariantId: null });
  });

  it('treats a difference exactly at the tolerance boundary as still matching the default zone', () => {
    const productZone = makeProductZone({ printAreaWidthMM: 200, printAreaHeightMM: 300 });
    const designZone = makeDesignZone({
      canvasWidthMM: 200 + ZONE_DIMENSION_TOLERANCE_MM,
      canvasHeightMM: 300,
    });

    const result = resolveRenderZone(productZone, designZone, []);

    expect(result).toEqual({ zone: productZone, matchedVariantId: null });
  });

  it('treats a difference just past the tolerance boundary as not matching the default zone', () => {
    const productZone = makeProductZone({ printAreaWidthMM: 200, printAreaHeightMM: 300 });
    const designZone = makeDesignZone({
      canvasWidthMM: 200 + ZONE_DIMENSION_TOLERANCE_MM + 0.01,
      canvasHeightMM: 300,
    });

    const result = resolveRenderZone(productZone, designZone, []);

    expect(result.matchedVariantId).toBeNull();
    expect(result.zone).toEqual(productZone);
  });

  it('uses the same tolerance for variant matching, so a variant 1.5mm off the design is not picked', () => {
    // Before the fix, the default-zone check used a 1mm tolerance while the
    // variant-match check used a 2mm tolerance. A variant zone 1.5mm off from
    // the design's recorded canvas size would then be wrongly selected (1.5 < 2).
    // With a single shared 1mm tolerance, it must be rejected instead (1.5 > 1).
    const productZone = makeProductZone({ printAreaWidthMM: 200, printAreaHeightMM: 300 });
    const looseVariantZone = makeProductZone({ printAreaWidthMM: 203, printAreaHeightMM: 300 });
    const variants: ProductVariant[] = [makeVariant({ zones: [looseVariantZone] })];
    // 1.5mm off the default zone — enough to fail the default-zone match and
    // trigger a variant search, but also 1.5mm off looseVariantZone above.
    const designZone = makeDesignZone({ canvasWidthMM: 201.5, canvasHeightMM: 300 });

    const result = resolveRenderZone(productZone, designZone, variants);

    expect(result.matchedVariantId).toBeNull();
    expect(result.zone).toEqual(productZone);
  });

  it('matches a variant zone exactly at the tolerance boundary', () => {
    const productZone = makeProductZone({ printAreaWidthMM: 200, printAreaHeightMM: 300 });
    const variantZone = makeProductZone({
      printAreaWidthMM: 150,
      printAreaHeightMM: 220 + ZONE_DIMENSION_TOLERANCE_MM,
    });
    const variants: ProductVariant[] = [makeVariant({ id: 'variant-a', zones: [variantZone] })];
    const designZone = makeDesignZone({ canvasWidthMM: 150, canvasHeightMM: 220 });

    const result = resolveRenderZone(productZone, designZone, variants);

    expect(result.matchedVariantId).toBe('variant-a');
    expect(result.zone).toEqual({ ...productZone, ...variantZone });
  });
});

describe('decideProductionOutcome', () => {
  it('reports total failure when zero zones succeeded', () => {
    const files: Record<string, ProductionZoneFiles> = {};
    const zoneErrors = ['front: render timed out', 'back: font not found'];

    const outcome = decideProductionOutcome(files, zoneErrors);

    expect(outcome.status).toBe('failed');
    expect(outcome.productionError).toContain('front: render timed out');
    expect(outcome.productionError).toContain('back: font not found');
  });

  it('reports completed with a partial error when one of two zones fails', () => {
    const files: Record<string, ProductionZoneFiles> = {
      front: { print: '/api/v1/assets/production/d1/front.png' },
    };
    const zoneErrors = ['back: image resolve failed'];

    const outcome = decideProductionOutcome(files, zoneErrors);

    expect(outcome.status).toBe('completed');
    expect(outcome.productionError).toBe('back: image resolve failed');
  });

  it('reports completed with no error when every zone succeeds', () => {
    const files: Record<string, ProductionZoneFiles> = {
      front: { print: '/api/v1/assets/production/d1/front.png', mockup: '/api/v1/assets/production/d1/front-mockup.png' },
      back: { print: '/api/v1/assets/production/d1/back.png' },
    };

    const outcome = decideProductionOutcome(files, []);

    expect(outcome.status).toBe('completed');
    expect(outcome.productionError).toBeNull();
  });
});
