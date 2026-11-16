import { generateKeyBetween } from 'fractional-indexing';

/**
 * List order is a fractional index string, so moving one item writes one row.
 */
export function keyBetween(before: string | null, after: string | null): string {
  return generateKeyBetween(before, after);
}

export function keyAtEdge(sortedKeys: string[], edge: 'top' | 'bottom'): string {
  if (sortedKeys.length === 0) return generateKeyBetween(null, null);
  return edge === 'top'
    ? generateKeyBetween(null, sortedKeys[0])
    : generateKeyBetween(sortedKeys[sortedKeys.length - 1], null);
}

/** Plain code-unit comparison; fractional keys must not be locale-sorted. */
export function compareKeys(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * A key between two neighbours. If the neighbours are missing or out of
 * order (which should not happen, but stored data can surprise), falls back
 * to a key after `before` instead of throwing.
 */
export function safeKeyBetween(before: string | null, after: string | null): string {
  if (before !== null && after !== null && before >= after) return generateKeyBetween(before, null);
  return generateKeyBetween(before, after);
}
