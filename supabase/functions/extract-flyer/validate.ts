/**
 * Server-side validation + normalization of the model's raw deal candidates.
 *
 * Dependency-free pure module (no Deno/Node globals) so it runs identically in
 * the Deno edge runtime and under Jest. The model is never trusted directly:
 * every candidate is filtered, clamped, de-duplicated, and stamped with
 * server-controlled fields (id / storeId / provenance) here.
 *
 * The catalog import uses an explicit `.ts` extension because Deno requires it;
 * Jest resolves the exact file path fine.
 */
import { CATALOG_ID_SET, getCatalogEntry } from './catalog.ts';

/** Known pricing-unit vocabulary. Anything else falls back to defaultUnit. */
const KNOWN_UNITS = [
  'lb',
  'kg',
  'g',
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
] as const;

/** lowercased input -> canonical unit (preserves 'L' casing, etc.). */
const UNIT_BY_LOWER: Record<string, string> = Object.fromEntries(
  KNOWN_UNITS.map((u) => [u.toLowerCase(), u]),
);

/**
 * Mass pricing units. The client PricingResolver only converts WITHIN this set;
 * a mass<->non-mass mismatch passes the price through raw (e.g. $4.77/skewer
 * silently priced as $4.77/gram). Mirrors discover-deals/mapDeals.ts MASS_UNITS.
 */
const MASS_UNITS = new Set(['g', 'kg', 'lb']);

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface ValidationContext {
  storeId: string;
  chain: string;
  /** ISO date (YYYY-MM-DD) used to default missing flyer validity dates. */
  todayISO: string;
}

/** Raw, untrusted candidate as emitted by the model. */
export interface RawCandidate {
  ingredientId?: unknown;
  label?: unknown;
  labelFr?: unknown;
  salePrice?: unknown;
  regularPrice?: unknown;
  unit?: unknown;
  validFrom?: unknown;
  validTo?: unknown;
}

/** A fully validated, server-stamped deal (mirrors the app `Deal`, no sourceUrl). */
export interface ValidatedDeal {
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
  provenance: 'extracted';
}

export type ValidationResult =
  | { ok: true; deals: ValidatedDeal[] }
  | { ok: false; reason: 'no_deals_found' };

/* --------------------------------- helpers -------------------------------- */

function toFiniteNumber(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string' && v.trim() !== '') {
    // Accept "3,99" (French decimal comma) and "$3.99".
    const cleaned = v.replace(/[^0-9.,-]/g, '').replace(',', '.');
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function isValidISODate(v: unknown): v is string {
  if (typeof v !== 'string' || !ISO_DATE_RE.test(v)) return false;
  const t = Date.parse(`${v}T00:00:00Z`);
  return !Number.isNaN(t);
}

function fmtISO(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Monday–Sunday (ISO week) containing `todayISO`, in UTC. Falls back to now. */
function weekBounds(todayISO: string): { monday: string; sunday: string } {
  const base = isValidISODate(todayISO)
    ? new Date(`${todayISO}T00:00:00Z`)
    : new Date();
  const day = base.getUTCDay(); // 0 = Sun .. 6 = Sat
  const offsetToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(base);
  monday.setUTCDate(base.getUTCDate() + offsetToMonday);
  monday.setUTCHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return { monday: fmtISO(monday), sunday: fmtISO(sunday) };
}

/** Round to 4 decimals — enough for per-gram prices, kills float noise. */
function roundPrice(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}

/**
 * Resolve a raw unit token to its canonical form from the known vocabulary, or
 * null when it is not a recognized unit. Unlike a fallback-to-defaultUnit, this
 * preserves the UNKNOWN state so the unit-correctness gate can reason about it
 * (an unknown unit must NOT be silently reinterpreted as the canonical unit).
 */
function recognizeUnit(raw: unknown): string | null {
  if (typeof raw === 'string') {
    const canonical = UNIT_BY_LOWER[raw.trim().toLowerCase()];
    if (canonical) return canonical;
  }
  return null;
}

/**
 * Detect a "per 100 g" unit as emitted by the model (Quebec fish/seafood
 * convention, e.g. "2,99 $/100 g"). Accepts variants like "100g", "100 g",
 * "per 100 g", "/100g". The app convention is per-GRAM, so a match means the
 * price must be divided by 100 and the unit rewritten to 'g'.
 */
function isPer100g(raw: unknown): boolean {
  if (typeof raw !== 'string') return false;
  const norm = raw
    .toLowerCase()
    .replace(/\s+/g, '') // strip spaces
    .replace(/^per/, '') // strip leading "per"
    .replace(/^\//, ''); // strip leading "/"
  return norm === '100g';
}

/* -------------------------------- validate -------------------------------- */

/**
 * Filter + normalize raw candidates into trustworthy deals.
 * Empty after filtering => `no_deals_found` (never a silent empty success).
 */
export function validateDeals(
  candidates: unknown,
  ctx: ValidationContext,
): ValidationResult {
  const list: RawCandidate[] = Array.isArray(candidates) ? candidates : [];
  const { monday, sunday } = weekBounds(ctx.todayISO);

  // Dedupe per ingredient, keeping the cheapest sale price.
  const byIngredient = new Map<string, ValidatedDeal>();

  for (const raw of list) {
    if (!raw || typeof raw !== 'object') continue;

    const ingredientId =
      typeof raw.ingredientId === 'string' ? raw.ingredientId : '';
    // Drop anything not confidently mapped to a known catalog id.
    if (!CATALOG_ID_SET.has(ingredientId)) continue;

    const entry = getCatalogEntry(ingredientId);
    if (!entry) continue;

    // Sale price must be finite and strictly positive, else drop the entry.
    let salePriceRaw = toFiniteNumber(raw.salePrice);
    if (salePriceRaw === null || salePriceRaw <= 0) continue;

    let regularRaw = toFiniteNumber(raw.regularPrice);

    // Resolve the effective pricing unit deterministically. Three outcomes for
    // the flyer unit:
    //   - per-100 g  -> 'g' (mass); sale/regular are divided by 100 here so the
    //     later logic operates on real per-gram values (never trust model math)
    //   - a recognized vocabulary unit -> its canonical form
    //   - UNKNOWN -> the model emitted a non-vocabulary token (e.g. "each",
    //     "brochette", "300g"); we have no trustworthy unit for it.
    const def = entry.defaultUnit;
    let unit: string;
    if (isPer100g(raw.unit)) {
      salePriceRaw = salePriceRaw / 100;
      if (regularRaw !== null) regularRaw = regularRaw / 100;
      unit = 'g';
    } else {
      const known = recognizeUnit(raw.unit); // canonical unit, or null (UNKNOWN)
      if (known === null) {
        // UNKNOWN unit: fall back to defaultUnit ONLY when the canonical unit is
        // itself non-mass. A mass canonical (g/kg/lb) paired with an
        // unrecognized flyer unit is DROPPED — never passed through as mass.
        // This is the invariant that would have stopped the Maxi "raw shrimp
        // skewers 300 g @ $4.77 each" incident: the model emitted "each" for
        // shrimp (canonical 'g'); the old sanitizeUnit fallback stamped $4.77/g
        // -> "$477.00/100 g" -> a $2,385 shopping-list line for shrimp.
        if (MASS_UNITS.has(def)) continue;
        unit = def;
      } else {
        unit = known;
      }
    }

    // Unit-correctness gate (cost-correctness > deal count) — mirrors
    // discover-deals/mapDeals.ts (~L285-296) EXACTLY. Only keep deals the
    // planner can price: accept when the deal unit exactly matches the canonical
    // unit, OR both sides are mass units (the resolver converts within mass);
    // otherwise DROP. Defense in depth — the resolution above already excludes
    // the dangerous unknown-unit-on-mass-canonical case, so this fallback path
    // is unreachable for it, but the gate is kept as the explicit invariant.
    const unitOk =
      unit === def || (MASS_UNITS.has(unit) && MASS_UNITS.has(def));
    if (!unitOk) continue;

    // Regular price: use it when finite & positive, otherwise fall back to the
    // sale price so we never invent savings.
    let regularPrice =
      regularRaw !== null && regularRaw > 0 ? regularRaw : salePriceRaw;

    // Clamp: a sale price can never exceed the regular price.
    const salePrice = Math.min(salePriceRaw, regularPrice);
    if (salePrice > regularPrice) regularPrice = salePrice; // defensive

    const validFrom = isValidISODate(raw.validFrom) ? raw.validFrom : monday;
    const validTo = isValidISODate(raw.validTo) ? raw.validTo : sunday;

    const label =
      typeof raw.label === 'string' && raw.label.trim() !== ''
        ? raw.label.trim()
        : entry.name;
    const labelFr =
      typeof raw.labelFr === 'string' && raw.labelFr.trim() !== ''
        ? raw.labelFr.trim()
        : undefined;

    const deal: ValidatedDeal = {
      id: `ext-${ctx.storeId}-${ingredientId}`,
      storeId: ctx.storeId,
      ingredientId,
      label,
      ...(labelFr ? { labelFr } : {}),
      salePrice: roundPrice(salePrice),
      regularPrice: roundPrice(regularPrice),
      unit,
      validFrom,
      validTo,
      provenance: 'extracted',
    };

    const existing = byIngredient.get(ingredientId);
    if (!existing || deal.salePrice < existing.salePrice) {
      byIngredient.set(ingredientId, deal);
    }
  }

  const deals = Array.from(byIngredient.values());
  if (deals.length === 0) return { ok: false, reason: 'no_deals_found' };
  return { ok: true, deals };
}
