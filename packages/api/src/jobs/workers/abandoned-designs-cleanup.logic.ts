export interface AbandonedDesignCandidate {
  id: string;
  status: string;
  updatedAt: Date;
}

export interface RetentionConfig {
  abandonedDraftRetentionMs: number;
  abandonedCartRetentionMs: number;
}

/**
 * A design qualifies for cleanup once it's sat untouched (no edits) past its status's
 * retention window. "cart" gets a longer window than "draft" — a design a customer actually
 * put in a cart carries more intent than one they merely started sketching. Any other status
 * (paid, cancelled) is never touched here.
 */
export function isAbandoned(design: AbandonedDesignCandidate, retention: RetentionConfig, now: number): boolean {
  const age = now - design.updatedAt.getTime();
  if (design.status === 'draft') return age >= retention.abandonedDraftRetentionMs;
  if (design.status === 'cart') return age >= retention.abandonedCartRetentionMs;
  return false;
}

/** Extracts the MinIO object key from a `/api/v1/assets/{key}` URL produced by this API. */
export function extractStorageKey(url: string | null | undefined): string | null {
  const prefix = '/api/v1/assets/';
  if (!url || !url.startsWith(prefix)) return null;
  return url.slice(prefix.length);
}
