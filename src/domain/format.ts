/**
 * Human-readable price/quantity formatting shared across the shopping-list UI,
 * the store specials modal, and the plain-text share export. Pure string math
 * (delegates currency rendering to formatMoney; no other platform dependency).
 *
 * Gram-priced items (salmon, tilapia, shrimp — see data/pricing.ts) carry a
 * per-gram unitPrice that renders as a broken-looking "$0.03". For those we show
 * a per-100 g price. Meat is priced per pound; kg-priced items show "/kg".
 */
import { formatMoney } from './money';
import { convertUnitPrice, type MassUnit } from './units';

export function formatUnitPrice(price: number, unit: string): string {
  if (unit === 'g') {
    return `${formatMoney(price * 100)}/100 g`;
  }
  if (unit === 'lb') {
    return `${formatMoney(price)}/lb`;
  }
  if (unit === 'kg') {
    return `${formatMoney(price)}/kg`;
  }
  // Package units (can, box, unit…) show a bare price with no per-unit suffix.
  return formatMoney(price);
}

/**
 * Dual-unit mass price, e.g. formatDualMassPrice(8.99, 'lb') → "$8.99/lb · $19.82/kg".
 * Shoppers compare shelf tags in lb but recipes think in kg; showing both keeps
 * the deal legible either way.
 */
export function formatDualMassPrice(price: number, unit: MassUnit): string {
  const perLb = convertUnitPrice(price, unit, 'lb');
  const perKg = convertUnitPrice(price, unit, 'kg');
  return `${formatMoney(perLb)}/lb · ${formatMoney(perKg)}/kg`;
}

/** "2.5 lb" / "3 can" — integers render bare, fractions to 2 decimals. */
export function formatQty(quantity: number, unit: string): string {
  const q = Number.isInteger(quantity) ? String(quantity) : quantity.toFixed(2);
  return `${q} ${unit}`;
}
