/**
 * Deterministic candidate → deal mapping for the discover-deals edge function.
 *
 * Dependency-free pure module (no Deno/Node globals) so it runs identically in
 * the Deno edge runtime and under Jest. The Claude model's ONLY job upstream is
 * matching (which candidate is which catalog ingredient); every price, unit,
 * label, and date is derived HERE from the raw Flipp record — never from the
 * model.
 *
 * The catalog import uses an explicit `.ts` extension because Deno requires it;
 * Jest resolves the exact file path fine.
 */
import { getCatalogEntry } from './catalog.ts';
import { classifyPrice } from './plausibility.ts';
import type { Chain, FlippItem } from './flipp.ts';
import { chainFromMerchant } from './flipp.ts';

/** Candidate items whose valid_to is more than this many days out are dropped. */
export const MAX_VALID_TO_DAYS = 10;

/** Per-search cap on candidates handed to the model, to bound prompt size. */
export const MAX_CANDIDATES_PER_SEARCH = 12;

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}/;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Package-like default units: the Flipp per-package/each price maps straight to
 * this unit. clove/tsp/tbsp/cup are recipe-scale and collapse to 'unit'.
 */
const PACKAGE_UNITS = new Set([
  'unit',
  'pack',
  'can',
  'jar',
  'bag',
  'box',
  'bunch',
  'dozen',
  'block',
  'container',
  'carton',
  'tub',
  'bottle',
  'wedge',
  'L',
]);
const COLLAPSE_TO_UNIT = new Set(['clove', 'tsp', 'tbsp', 'cup']);

/**
 * Mass pricing units. The client PricingResolver only converts WITHIN this set;
 * a mass↔non-mass mismatch passes the price through raw (e.g. $12.99/package
 * silently priced as $12.99/gram). So the server must only emit a deal whose
 * unit the planner can price correctly against the ingredient's canonical unit.
 */
const MASS_UNITS = new Set(['g', 'kg', 'lb']);

/** A Flipp item enriched with the store it belongs to (resolved in index.ts). */
export interface Candidate extends FlippItem {
  storeId: string;
  chain: Chain;
}

/** A model match: candidate #`candidateIndex` IS catalog ingredient `ingredientId`. */
export interface Match {
  ingredientId: string;
  candidateIndex: number;
}

/** A fully validated, server-stamped discovered deal (mirrors the app `Deal`). */
export interface DiscoveredDeal {
  id: string;
  storeId: string;
  ingredientId: string;
  label: string;
  labelFr?: string;
  salePrice: number;
  regularPrice: number;
  unit: string;
  validFrom: string;
  validTo: string;
  provenance: 'discovered';
}

/* --------------------------------- helpers -------------------------------- */

/** Parse a number from a Flipp field. Accepts "4,39" (French comma) and "$3.99". */
export function toFiniteNumber(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string' && v.trim() !== '') {
    const cleaned = v.replace(/[^0-9.,-]/g, '').replace(',', '.');
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Round to 4 decimals — enough for per-gram prices, kills float noise. */
export function roundPrice(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}

/** Clamp a raw ISO-ish date string to a bare YYYY-MM-DD, or null if unparseable. */
export function toDateOnly(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const m = v.match(ISO_DATE_RE);
  if (!m) return null;
  const iso = m[0];
  return Number.isNaN(Date.parse(`${iso}T00:00:00Z`)) ? null : iso;
}

/** Split a Flipp "fr | en" name into its French and English halves. */
export function splitName(name: unknown): { fr: string; en: string } {
  if (typeof name !== 'string') return { fr: '', en: '' };
  const idx = name.indexOf('|');
  if (idx >= 0) {
    return { fr: name.slice(0, idx).trim(), en: name.slice(idx + 1).trim() };
  }
  return { fr: name.trim(), en: '' };
}

/**
 * Fallback pricing unit when `post_price_text` is absent: the Flipp price is a
 * per-package/each price. Use the ingredient's package-like default unit as-is;
 * collapse recipe-scale units to 'unit'; and NEVER price a package as per-mass
 * (a mass default → 'unit').
 */
export function packageFallbackUnit(defaultUnit: string): string {
  if (COLLAPSE_TO_UNIT.has(defaultUnit)) return 'unit';
  if (PACKAGE_UNITS.has(defaultUnit)) return defaultUnit;
  return 'unit'; // mass (kg/g/lb) or unknown
}

export interface ParsedUnitPrice {
  unit: string;
  price: number;
}

/**
 * Deterministically parse `post_price_text` into a pricing unit + price, using
 * `currentPrice` as the base. Returns null when the text is absent/unparseable,
 * signalling the caller to use the package fallback.
 *
 *  - "/lb" (with or without a dual "…/kg") → 'lb' at current_price
 *  - "/100 g" or "/100g"                   → 'g' at current_price ÷ 100
 *  - "/kg" only                            → 'kg' at current_price
 *  - "/g"                                  → 'g' at current_price
 */
export function parsePostPrice(
  postPriceText: unknown,
  currentPrice: number,
): ParsedUnitPrice | null {
  if (typeof postPriceText !== 'string') return null;
  const t = postPriceText.toLowerCase();
  if (/\/\s*lb/.test(t)) return { unit: 'lb', price: currentPrice };
  if (/\/\s*100\s*g\b/.test(t)) {
    return { unit: 'g', price: roundPrice(currentPrice / 100) };
  }
  if (/\/\s*kg/.test(t)) return { unit: 'kg', price: currentPrice };
  if (/\/\s*g\b/.test(t)) return { unit: 'g', price: currentPrice };
  return null;
}

/**
 * Is this candidate within its validity window and not a long-running promo?
 * A candidate is dropped when its valid_to is more than MAX_VALID_TO_DAYS after
 * today (kills Walmart-style multi-week promos), or when it has already expired,
 * or when it has not started yet.
 */
export function isWithinWindow(item: FlippItem, todayISO: string): boolean {
  const today = Date.parse(`${todayISO}T00:00:00Z`);
  if (Number.isNaN(today)) return true; // no reliable clock → don't filter
  const validTo = toDateOnly(item.valid_to);
  if (validTo) {
    const to = Date.parse(`${validTo}T00:00:00Z`);
    if (to < today) return false; // expired
    if (to - today > MAX_VALID_TO_DAYS * DAY_MS) return false; // too-long promo
  }
  const validFrom = toDateOnly(item.valid_from);
  if (validFrom) {
    const from = Date.parse(`${validFrom}T00:00:00Z`);
    if (from - today > 0) return false; // not started yet
  }
  return true;
}

/**
 * Prefilter one search's raw items down to the best candidates for the model:
 *  - only items from an allowed (target-chain, current-week) flyer,
 *  - only items from a merchant we mapped to a store,
 *  - within the validity window (+ 10-day cap),
 *  - skip obvious non-food L1 categories when present,
 *  - dedupe by item id,
 *  - keep the MAX_CANDIDATES_PER_SEARCH "best" (contains the query term first,
 *    then shortest names — proxies for a clean, on-topic match).
 */
export function prefilterItems(
  items: FlippItem[],
  opts: {
    allowedFlyerIds: Set<string>;
    knownChains: Set<Chain>;
    todayISO: string;
    query: string;
  },
): FlippItem[] {
  const { allowedFlyerIds, knownChains, todayISO, query } = opts;
  const q = query.trim().toLowerCase();
  const seen = new Set<string>();
  const kept: FlippItem[] = [];

  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const chain = chainFromMerchant(item.merchant_name);
    if (!chain || !knownChains.has(chain)) continue;
    if (item.flyer_id == null || !allowedFlyerIds.has(String(item.flyer_id))) {
      continue;
    }
    if (!isWithinWindow(item, todayISO)) continue;
    if (isNonFood(item.category)) continue;
    if (toFiniteNumber(item.current_price) === null) continue;

    const key = item.id != null ? `id:${String(item.id)}` : `name:${item.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push(item);
  }

  kept.sort((a, b) => {
    const an = (a.name ?? '').toLowerCase();
    const bn = (b.name ?? '').toLowerCase();
    const aHit = q !== '' && an.includes(q) ? 0 : 1;
    const bHit = q !== '' && bn.includes(q) ? 0 : 1;
    if (aHit !== bHit) return aHit - bHit;
    return an.length - bn.length;
  });

  return kept.slice(0, MAX_CANDIDATES_PER_SEARCH);
}

/** Non-food Flipp L1 categories we never want to match a food ingredient to. */
const NON_FOOD_L1 = new Set([
  'health & beauty',
  'health and beauty',
  'beauty',
  'personal care',
  'household',
  'home',
  'pet',
  'pets',
  'baby',
  'electronics',
  'clothing',
  'pharmacy',
]);

function isNonFood(category: unknown): boolean {
  if (typeof category !== 'string') return false;
  return NON_FOOD_L1.has(category.trim().toLowerCase());
}

/** Compact one-line candidate representation handed to the model. */
export function compactCandidateLine(idx: number, c: Candidate): string {
  const name = (c.name ?? '').replace(/\s*\n\s*/g, ' ').trim();
  const cur = c.current_price ?? '';
  const orig = c.original_price ?? '';
  const ppt = (c.post_price_text ?? '').replace(/\s*\n\s*/g, ' ').trim();
  return `${idx} | ${name} | ${cur} | ${orig} | ${ppt} | ${c.merchant_name ?? ''}`;
}

/* --------------------------------- mapping -------------------------------- */

/** Stamp a single validated deal from a candidate + its matched ingredient. */
function stampDeal(
  ingredientId: string,
  c: Candidate,
  todayISO: string,
): DiscoveredDeal | null {
  const entry = getCatalogEntry(ingredientId);
  if (!entry) return null;

  const currentPrice = toFiniteNumber(c.current_price);
  if (currentPrice === null || currentPrice <= 0) return null;

  // Unit + sale price: post_price_text is authoritative; else package fallback.
  const parsed = parsePostPrice(c.post_price_text, currentPrice);
  const unit = parsed ? parsed.unit : packageFallbackUnit(entry.defaultUnit);
  const salePriceRaw = parsed ? parsed.price : currentPrice;

  // Unit-correctness gate (cost-correctness > deal count): only emit deals the
  // planner can price. Accept when the deal unit exactly matches the canonical
  // unit, OR both sides are mass units (the resolver converts within mass).
  // This drops package-priced fish/meat (e.g. shrimp $12.99 'unit' vs canonical
  // 'g'), per-lb produce whose canonical unit is 'unit' (tomatoes), and 'unit'
  // deals for clove/tsp-canonical ingredients — never a mass↔non-mass passthrough.
  const unitOk =
    unit === entry.defaultUnit ||
    (MASS_UNITS.has(unit) && MASS_UNITS.has(entry.defaultUnit));
  if (!unitOk) return null;

  // Regular price: original_price when present & positive, else the sale price
  // (never invent savings). Scale it the same way the sale price was scaled
  // (only the /100 g path changes the base), then clamp sale ≤ regular.
  const originalRaw = toFiniteNumber(c.original_price);
  let regularPrice: number;
  if (originalRaw !== null && originalRaw > 0) {
    regularPrice =
      parsed && parsed.unit === 'g' && /\/\s*100\s*g\b/.test(
        String(c.post_price_text).toLowerCase(),
      )
        ? roundPrice(originalRaw / 100)
        : originalRaw;
  } else {
    regularPrice = salePriceRaw;
  }

  const salePrice = Math.min(salePriceRaw, regularPrice);
  if (regularPrice < salePrice) regularPrice = salePrice; // defensive

  // Price-plausibility band: discovery is fully automated (no human confirms
  // these before they hit deal_cache), so only a clean 'ok' price survives —
  // both 'reject' (absurd) and 'suspicious' (unusual) are dropped rather than
  // cached. Runs after the unit gate, against the ingredient's base price.
  if (classifyPrice(salePrice, unit, ingredientId) !== 'ok') return null;

  const { fr, en } = splitName(c.name);
  const label = en !== '' ? en : entry.name;
  const labelFr = fr !== '' ? fr : undefined;

  const validFrom = toDateOnly(c.valid_from) ?? todayISO;
  const validTo = toDateOnly(c.valid_to) ?? todayISO;

  return {
    id: `disc-${c.storeId}-${ingredientId}`,
    storeId: c.storeId,
    ingredientId,
    label,
    ...(labelFr ? { labelFr } : {}),
    salePrice: roundPrice(salePrice),
    regularPrice: roundPrice(regularPrice),
    unit,
    validFrom,
    validTo,
    provenance: 'discovered',
  };
}

/**
 * Map the model's matches (against the global candidate array) into validated
 * deals. Dedupe per (store, ingredient), keeping the cheapest sale price. Bad
 * matches (out-of-range index, unknown ingredient, non-positive price) are
 * silently dropped — never trusted.
 */
export function mapDeals(
  candidates: Candidate[],
  matches: Match[],
  todayISO: string,
): DiscoveredDeal[] {
  const byId = new Map<string, DiscoveredDeal>();

  for (const match of matches) {
    if (!match || typeof match !== 'object') continue;
    const { ingredientId, candidateIndex } = match;
    if (typeof ingredientId !== 'string') continue;
    if (
      typeof candidateIndex !== 'number' ||
      !Number.isInteger(candidateIndex) ||
      candidateIndex < 0 ||
      candidateIndex >= candidates.length
    ) {
      continue;
    }

    const deal = stampDeal(ingredientId, candidates[candidateIndex], todayISO);
    if (!deal) continue;

    const existing = byId.get(deal.id);
    if (!existing || deal.salePrice < existing.salePrice) {
      byId.set(deal.id, deal);
    }
  }

  return Array.from(byId.values());
}
