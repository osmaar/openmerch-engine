import type { DesignZone, ProductVariant, ProductZone } from '@openmerch/core';
import type { ProductionZoneFiles } from '../queues.js';

// A design's canvas dimensions are recorded from whichever print area (the
// product's default zone, or a specific variant's zone) was active at design
// creation time. Those mm values round-trip through the editor, the DB and
// unit conversions, so comparing with `===` would false-negative on sizes
// that are effectively identical — hence a small shared tolerance instead of
// exact equality. Both comparisons below MUST use the same tolerance: using
// a tighter one to decide "does this design still match the default zone"
// and a looser one to decide "does this design match variant X" can pick a
// variant whose print area doesn't actually agree with the default zone
// comparison, shipping the merchant a file rendered against the wrong
// dimensions.
export const ZONE_DIMENSION_TOLERANCE_MM = 1;

export interface RenderZoneResolution {
  zone: ProductZone;
  matchedVariantId: string | null;
}

function withinTolerance(a: number, b: number): boolean {
  return Math.abs(a - b) <= ZONE_DIMENSION_TOLERANCE_MM;
}

// Picks which ProductZone dimensions to render against. If the design's
// recorded canvas size matches the product's current default zone, that
// zone is used as-is. Otherwise the design was made against a variant's
// print area (or the product zones changed since) — find the variant zone
// (same zone id) whose print area matches the design's recorded canvas
// size and use that instead. If nothing matches, falls back to the default
// zone rather than throwing, since rendering against a slightly-off zone is
// preferable to failing the whole job over a dimension mismatch.
export function resolveRenderZone(
  productZone: ProductZone,
  designZone: DesignZone | undefined,
  variants: readonly ProductVariant[],
): RenderZoneResolution {
  const zone: ProductZone = { ...productZone };

  if (!designZone?.canvasWidthMM || !designZone.canvasHeightMM) {
    return { zone, matchedVariantId: null };
  }

  const matchesDefaultZone =
    withinTolerance(designZone.canvasWidthMM, productZone.printAreaWidthMM) &&
    withinTolerance(designZone.canvasHeightMM, productZone.printAreaHeightMM);
  if (matchesDefaultZone) {
    return { zone, matchedVariantId: null };
  }

  const matchingVariant = variants.find((variant) =>
    variant.zones?.some(
      (variantZone) =>
        variantZone.id === productZone.id &&
        withinTolerance(variantZone.printAreaWidthMM, designZone.canvasWidthMM) &&
        withinTolerance(variantZone.printAreaHeightMM, designZone.canvasHeightMM),
    ),
  );
  const matchingZone = matchingVariant?.zones?.find((variantZone) => variantZone.id === productZone.id);

  if (!matchingVariant || !matchingZone) {
    return { zone, matchedVariantId: null };
  }

  return { zone: { ...zone, ...matchingZone }, matchedVariantId: matchingVariant.id };
}

export interface ProductionOutcome {
  status: 'completed' | 'failed';
  productionError: string | null;
}

// Decides the design's final productionStatus from how many zones rendered.
// Zero successful zones is a total failure (caller should throw so BullMQ
// retries). Any successful zone is a 'completed' result — the merchant still
// gets the files that worked — with productionError describing the zones
// that didn't, or null if every zone succeeded.
export function decideProductionOutcome(
  files: Record<string, ProductionZoneFiles>,
  zoneErrors: readonly string[],
): ProductionOutcome {
  if (Object.keys(files).length === 0) {
    return { status: 'failed', productionError: `All zones failed: ${zoneErrors.join('; ')}` };
  }

  return {
    status: 'completed',
    productionError: zoneErrors.length > 0 ? zoneErrors.join('; ') : null,
  };
}
