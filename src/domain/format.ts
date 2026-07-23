/**
 * Human-readable price formatting shared across the shopping-list UI, the store
 * specials modal, and the plain-text share export. Keep it free of any
 * runtime/platform dependency (pure string math).
 *
 * Gram-priced items (salmon, tilapia, shrimp — see data/pricing.ts) carry a
 * per-gram unitPrice that renders as a broken-looking "$0.03". For those we show
 * a per-100 g price instead. All output is rounded to whole cents.
 */
export function formatUnitPrice(price: number, unit: string): string {
  if (unit === 'g') {
    return `$${(price * 100).toFixed(2)}/100 g`;
  }
  return `$${price.toFixed(2)}`;
}
