import type { Chain, Deal, DiscoveryResult, Store } from '@/domain/types';
import { CHAIN_LABELS } from '@/domain/types';
import { convertUnitPrice, isMassUnit } from '@/domain/units';
import { round2 } from '@/domain/costing';
import { getIngredient } from './ingredients';
import { BASE_PRICES } from './pricing';
import { CHAIN_FLYER_URLS } from './flyerUrls';

/**
 * Seeded Montreal flyer data. Stores are grouped by FSA (first 3 chars of a
 * Canadian postal code). Each store carries a list of on-sale ingredients with
 * a CAD sale price; the regular price + unit are pulled from BASE_PRICES so the
 * two sources stay consistent. Labels are French-flavoured (circulaire style).
 *
 * Any FSA not present here is treated by the discovery agent as "no local
 * flyers found" — a loud, explicit failure (never silent).
 */

interface SeededStore extends Store {
  fsa: string;
  /**
   * [ingredientId, salePrice] pairs on sale this cycle. salePrice is expressed
   * in the ingredient's flyer unit — per 'lb' for meats (BASE_PRICES.flyerUnit),
   * otherwise in its canonical unit (per 'g' for fish, per package otherwise).
   */
  sales: [string, number][];
}

/** Current flyer validity window, computed relative to now so demos never expire. */
function flyerWindow(): { validFrom: string; validTo: string } {
  const now = new Date();
  const from = new Date(now);
  from.setDate(now.getDate() - 3);
  const to = new Date(now);
  to.setDate(now.getDate() + 10);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { validFrom: iso(from), validTo: iso(to) };
}

const SEEDED_STORES: SeededStore[] = [
  // --- H2X (Quartier des spectacles / lower Plateau) — primary demo area ---
  {
    id: 'metro-h2x',
    fsa: 'H2X',
    chain: 'metro',
    name: 'Metro Plateau Mont-Royal',
    distanceKm: 0.6,
    dealCount: 0,
    sales: [
      ['chicken_thigh', 2.99],
      ['broccoli', 1.99],
      ['greek_yogurt', 3.49],
      ['rice', 4.49],
      ['canned_tomatoes', 1.29],
      ['garlic', 0.1],
      ['bell_pepper', 0.99],
      ['parmesan', 5.49],
      ['penne_ww', 1.99],
    ],
  },
  {
    id: 'iga-h2x',
    fsa: 'H2X',
    chain: 'iga',
    name: 'IGA Saint-Laurent',
    distanceKm: 1.1,
    dealCount: 0,
    sales: [
      ['salmon', 0.025],
      ['spinach', 2.49],
      ['sweet_potato', 1.99],
      ['eggs', 3.49],
      ['lemon', 0.5],
      ['tofu', 2.49],
      ['feta', 3.49],
      ['zucchini', 0.69],
    ],
  },
  {
    id: 'provigo-h2x',
    fsa: 'H2X',
    chain: 'provigo',
    name: 'Provigo Le Marché',
    distanceKm: 1.4,
    dealCount: 0,
    sales: [
      ['ground_beef', 4.99],
      ['pasta', 1.29],
      ['tomato_sauce', 1.99],
      ['mushroom', 1.99],
      ['cheddar', 4.99],
      ['carrot', 0.19],
      ['onion', 0.39],
    ],
  },
  {
    id: 'maxi-h2x',
    fsa: 'H2X',
    chain: 'maxi',
    name: 'Maxi Parc',
    distanceKm: 2.2,
    dealCount: 0,
    sales: [
      ['pork_shoulder', 2.99],
      ['chickpeas', 0.99],
      ['black_beans', 0.99],
      ['lentils', 2.49],
      ['coconut_milk', 1.79],
      ['tortilla', 2.49],
      ['burger_buns', 2.49],
      ['bbq_sauce', 2.99],
      ['potato', 1.29],
    ],
  },
  {
    id: 'superc-h2x',
    fsa: 'H2X',
    chain: 'superc',
    name: 'Super C Mont-Royal',
    distanceKm: 1.8,
    dealCount: 0,
    sales: [
      ['beef_strips', 9.99],
      ['chicken_breast', 8.99],
      ['shrimp', 0.022],
      ['quinoa', 4.99],
      ['kale', 1.99],
      ['avocado', 0.99],
      ['lime', 0.4],
      ['green_onion', 0.99],
      ['arborio_rice', 4.99],
      ['cream', 2.49],
    ],
  },

  // --- H3B (downtown / Ville-Marie) ---
  {
    id: 'metro-h3b',
    fsa: 'H3B',
    chain: 'metro',
    name: 'Metro Centre-ville',
    distanceKm: 0.9,
    dealCount: 0,
    sales: [
      ['chicken_breast', 8.99],
      ['broccoli', 2.19],
      ['salmon', 0.027],
      ['rice', 4.79],
      ['greek_yogurt', 3.79],
      ['bell_pepper', 1.09],
    ],
  },
  {
    id: 'iga-h3b',
    fsa: 'H3B',
    chain: 'iga',
    name: 'IGA Express René-Lévesque',
    distanceKm: 1.3,
    dealCount: 0,
    sales: [
      ['tofu', 2.79],
      ['spinach', 2.79],
      ['lentils', 2.69],
      ['coconut_milk', 1.89],
      ['sweet_potato', 2.29],
      ['feta', 3.79],
    ],
  },
  {
    id: 'provigo-h3b',
    fsa: 'H3B',
    chain: 'provigo',
    name: 'Provigo Concorde',
    distanceKm: 1.7,
    dealCount: 0,
    sales: [
      ['ground_beef', 5.29],
      ['pasta', 1.49],
      ['tomato_sauce', 2.19],
      ['mushroom', 2.29],
      ['pork_shoulder', 3.19],
      ['tortilla', 2.79],
    ],
  },
  {
    id: 'superc-h3b',
    fsa: 'H3B',
    chain: 'superc',
    name: 'Super C Sainte-Catherine',
    distanceKm: 2.0,
    dealCount: 0,
    sales: [
      ['beef_strips', 9.99],
      ['chickpeas', 1.09],
      ['black_beans', 1.09],
      ['quinoa', 5.29],
      ['avocado', 1.09],
      ['burger_buns', 2.69],
      ['bbq_sauce', 3.19],
    ],
  },

  // --- H2J (Plateau / Mile End) ---
  {
    id: 'metro-h2j',
    fsa: 'H2J',
    chain: 'metro',
    name: 'Metro Mont-Royal Est',
    distanceKm: 0.7,
    dealCount: 0,
    sales: [
      ['chicken_thigh', 3.29],
      ['salmon', 0.026],
      ['broccoli', 2.09],
      ['penne_ww', 2.09],
      ['parmesan', 5.79],
      ['eggs', 3.79],
    ],
  },
  {
    id: 'iga-h2j',
    fsa: 'H2J',
    chain: 'iga',
    name: 'IGA Duluth',
    distanceKm: 1.0,
    dealCount: 0,
    sales: [
      ['tofu', 2.59],
      ['spinach', 2.59],
      ['feta', 3.59],
      ['zucchini', 0.79],
      ['lemon', 0.55],
      ['sweet_potato', 2.09],
    ],
  },
  {
    id: 'maxi-h2j',
    fsa: 'H2J',
    chain: 'maxi',
    name: 'Maxi Papineau',
    distanceKm: 1.9,
    dealCount: 0,
    sales: [
      ['pork_shoulder', 3.09],
      ['chickpeas', 1.05],
      ['lentils', 2.59],
      ['coconut_milk', 1.85],
      ['tortilla', 2.59],
      ['potato', 1.39],
      ['bbq_sauce', 3.09],
    ],
  },
  {
    id: 'provigo-h2j',
    fsa: 'H2J',
    chain: 'provigo',
    name: 'Provigo Mile End',
    distanceKm: 1.5,
    dealCount: 0,
    sales: [
      ['ground_beef', 5.19],
      ['pasta', 1.39],
      ['tomato_sauce', 2.09],
      ['mushroom', 2.09],
      ['cheddar', 5.19],
      ['bell_pepper', 1.05],
    ],
  },

  // --- H4C (Saint-Henri / Sud-Ouest) ---
  {
    id: 'superc-h4c',
    fsa: 'H4C',
    chain: 'superc',
    name: 'Super C Saint-Jacques',
    distanceKm: 0.8,
    dealCount: 0,
    sales: [
      ['beef_strips', 9.79],
      ['chicken_breast', 8.79],
      ['quinoa', 4.89],
      ['kale', 1.89],
      ['avocado', 0.95],
      ['shrimp', 0.023],
      ['arborio_rice', 4.89],
    ],
  },
  {
    id: 'maxi-h4c',
    fsa: 'H4C',
    chain: 'maxi',
    name: 'Maxi Notre-Dame',
    distanceKm: 1.2,
    dealCount: 0,
    sales: [
      ['pork_shoulder', 2.89],
      ['ground_pork', 3.49],
      ['chickpeas', 0.95],
      ['black_beans', 0.95],
      ['lentils', 2.39],
      ['coconut_milk', 1.75],
      ['burger_buns', 2.39],
    ],
  },
  {
    id: 'iga-h4c',
    fsa: 'H4C',
    chain: 'iga',
    name: 'IGA Extra Saint-Henri',
    distanceKm: 1.6,
    dealCount: 0,
    sales: [
      ['salmon', 0.026],
      ['tofu', 2.69],
      ['spinach', 2.69],
      ['feta', 3.69],
      ['greek_yogurt', 3.69],
      ['eggs', 3.69],
    ],
  },

  // --- H1Y (Rosemont) ---
  {
    id: 'metro-h1y',
    fsa: 'H1Y',
    chain: 'metro',
    name: 'Metro Rosemont',
    distanceKm: 0.9,
    dealCount: 0,
    sales: [
      ['chicken_thigh', 3.19],
      ['broccoli', 2.09],
      ['rice', 4.69],
      ['canned_tomatoes', 1.39],
      ['parmesan', 5.69],
      ['penne_ww', 2.09],
    ],
  },
  {
    id: 'provigo-h1y',
    fsa: 'H1Y',
    chain: 'provigo',
    name: 'Provigo Beaubien',
    distanceKm: 1.4,
    dealCount: 0,
    sales: [
      ['ground_beef', 5.09],
      ['pasta', 1.45],
      ['tomato_sauce', 2.15],
      ['mushroom', 2.19],
      ['cheddar', 5.09],
      ['carrot', 0.22],
    ],
  },
  {
    id: 'superc-h1y',
    fsa: 'H1Y',
    chain: 'superc',
    name: 'Super C Bélanger',
    distanceKm: 2.1,
    dealCount: 0,
    sales: [
      ['beef_strips', 9.99],
      ['chicken_breast', 8.99],
      ['quinoa', 5.09],
      ['avocado', 1.05],
      ['lime', 0.45],
      ['green_onion', 1.09],
    ],
  },
  {
    id: 'maxi-h1y',
    fsa: 'H1Y',
    chain: 'maxi',
    name: 'Maxi Rosemont',
    distanceKm: 2.4,
    dealCount: 0,
    sales: [
      ['pork_shoulder', 3.09],
      ['chickpeas', 1.0],
      ['lentils', 2.49],
      ['coconut_milk', 1.8],
      ['tortilla', 2.55],
      ['burger_buns', 2.55],
      ['bbq_sauce', 3.05],
    ],
  },
];

function buildDealsForStore(
  storeId: string,
  sales: [string, number][],
  chain: Chain,
): Deal[] {
  const { validFrom, validTo } = flyerWindow();
  const sourceUrl = CHAIN_FLYER_URLS[chain];
  const deals: Deal[] = [];
  for (const [ingredientId, salePrice] of sales) {
    const base = BASE_PRICES[ingredientId];
    const ing = getIngredient(ingredientId);
    if (!base || !ing) continue; // guard against typos in the seed
    // Deals are advertised in the flyer unit. For meats that's 'lb': the seed
    // salePrice is already per-lb; the regular is the canonical (per-kg) base
    // converted to per-lb so both sides of the deal share one unit.
    const flyerUnit = base.flyerUnit;
    let unit = base.unit;
    let regularPrice = base.unitPrice;
    if (flyerUnit && isMassUnit(base.unit)) {
      unit = flyerUnit;
      regularPrice = round2(convertUnitPrice(base.unitPrice, base.unit, flyerUnit));
    }
    deals.push({
      id: `${storeId}__${ingredientId}`,
      storeId,
      ingredientId,
      label: ing.name,
      labelFr: ing.nameFr,
      salePrice,
      regularPrice,
      unit,
      sourceUrl,
      validFrom,
      validTo,
    });
  }
  return deals;
}

/**
 * Build a set of "extracted" deals for a store, as the mock flyer extractor
 * would return them. Reuses buildDealsForStore so uploaded-flyer deals share
 * the exact same BASE_PRICES unit conversion (per-lb meats), CAD prices, French
 * labels, deterministic ids (`${storeId}__${ingredientId}`), and flyer window as
 * seeded/added deals — so they slot straight into the planner. Provenance is
 * stamped 'extracted' so the UI and merge logic can tell them apart from seeds.
 *
 * The chain's CHAIN_DEAL_SEEDS drive which items are "on sale" in the uploaded
 * flyer; a real extractor would read them from the file instead.
 */
export function makeExtractedDeals(storeId: string, chain: Chain): Deal[] {
  const sales = CHAIN_DEAL_SEEDS[chain] ?? [];
  return buildDealsForStore(storeId, sales, chain).map((d) => ({
    ...d,
    provenance: 'extracted' as const,
  }));
}

interface AreaData {
  stores: Store[];
  deals: Deal[];
}

const AREA_CACHE: Record<string, AreaData> = {};

function buildArea(fsa: string): AreaData | null {
  const seeded = SEEDED_STORES.filter((s) => s.fsa === fsa);
  if (seeded.length === 0) return null;
  const deals: Deal[] = [];
  const stores: Store[] = seeded.map((s) => {
    const storeDeals = buildDealsForStore(s.id, s.sales, s.chain);
    deals.push(...storeDeals);
    return {
      id: s.id,
      chain: s.chain,
      name: s.name,
      distanceKm: s.distanceKm,
      dealCount: storeDeals.length,
      flyerUrl: CHAIN_FLYER_URLS[s.chain],
    };
  });
  return { stores, deals };
}

/** Canonical seeded FSAs, in a fixed (sorted) order for deterministic mapping. */
const SEEDED_FSA_LIST: string[] = Array.from(
  new Set(SEEDED_STORES.map((s) => s.fsa)),
).sort();
const SEEDED_FSA_SET = new Set(SEEDED_FSA_LIST);

/**
 * A Montreal-region FSA: leading "H", a digit, then a letter from the Canadian
 * postal alphabet (mirrors the letter class in domain/postal.ts). fsaOf() does
 * NOT validate shape, so the resolver validates here.
 */
const H_FSA_RE = /^H\d[ABCEGHJ-NPRSTV-Z]$/;

/** Deterministic non-negative char-code sum for a string. */
function charCodeSum(s: string): number {
  let sum = 0;
  for (let i = 0; i < s.length; i++) sum += s.charCodeAt(i);
  return sum;
}

/**
 * Resolve any requested FSA to a seeded canonical FSA:
 *  - seeded H-FSAs (H2X, H3B, H2J, H4C, H1Y) map to themselves (identity),
 *  - other valid H-FSAs map deterministically to one of the seeded areas via a
 *    simple char-code hash mod 5,
 *  - invalid or non-H FSAs return null (→ loud no_flyers_found upstream).
 */
function resolveToSeededFsa(fsa: string): string | null {
  const key = fsa.toUpperCase();
  if (!H_FSA_RE.test(key)) return null;
  if (SEEDED_FSA_SET.has(key)) return key;
  const idx = charCodeSum(key) % SEEDED_FSA_LIST.length;
  return SEEDED_FSA_LIST[idx];
}

/** Canonical (shared, cached) area for a known seeded FSA. Never mutated. */
function getCanonicalArea(fsa: string): AreaData | null {
  if (!(fsa in AREA_CACHE)) {
    const built = buildArea(fsa);
    if (built) AREA_CACHE[fsa] = built;
    else return null;
  }
  return AREA_CACHE[fsa] ?? null;
}

/**
 * Deterministic per-FSA distance jitter. Two different FSAs that resolve to the
 * same canonical area still show distinct, plausible store distances. Pure
 * function of (requested FSA, store id): same inputs → same output. Offsets are
 * bounded to ±1.5 km with a 0.2 km floor and one-decimal precision.
 */
function jitterDistance(baseKm: number, fsa: string, storeId: string): number {
  const offset = ((charCodeSum(fsa + storeId) % 31) - 15) / 10; // [-1.5, +1.5]
  const km = Math.max(0.2, baseKm + offset);
  return Math.round(km * 10) / 10;
}

/**
 * Requested FSA (e.g. "H4A") -> stores + deals for its seeded/mapped area, or
 * null if the FSA is invalid or non-Montreal. Returns freshly cloned store
 * objects carrying per-FSA jittered distances, so the shared cached canonical
 * area is never mutated. Deal counts are unchanged.
 */
export function getSeededArea(fsa: string): AreaData | null {
  const requested = fsa.toUpperCase();
  const canonical = resolveToSeededFsa(requested);
  if (!canonical) return null;
  const area = getCanonicalArea(canonical);
  if (!area) return null;
  const stores: Store[] = area.stores.map((s) => ({
    ...s,
    distanceKm: jitterDistance(s.distanceKm, requested, s.id),
  }));
  return { stores, deals: area.deals };
}

export const CHAIN_OF: Record<string, Chain> = Object.fromEntries(
  SEEDED_STORES.map((s) => [s.id, s.chain]),
);

/* ------------------------------------------------------------------ */
/* User-added stores                                                  */
/* ------------------------------------------------------------------ */

/**
 * Every chain a user can add to their plan, in a fixed order for a stable
 * "add more stores" list. The two newest chains (loblaws, walmart) are never
 * seeded into the demo areas above, so they are always addable.
 */
export const CHAIN_CATALOG: Chain[] = [
  'metro',
  'iga',
  'provigo',
  'maxi',
  'superc',
  'loblaws',
  'walmart',
];

/**
 * Chains a user can still add given the stores already present — the catalog
 * minus every chain already represented among `stores`. Order follows
 * CHAIN_CATALOG for a stable "add more stores" list. Pure; shared by onboarding
 * and the shopping-list "Add a store" flow so both derive addability identically.
 */
export function addableChains(stores: Store[]): Chain[] {
  return CHAIN_CATALOG.filter((c) => !stores.some((s) => s.chain === c));
}

/**
 * Per-chain sale seeds for user-added stores. Ingredient ids key into
 * BASE_PRICES (validated by buildDealsForStore) and every sale price sits a
 * realistic 15–40% below its regular price (compared in a common unit) — never
 * a fake deep discount that would wrongly dominate the sale-weighted planner.
 * Meat sale prices are per 'lb' (the flyer unit); fish stays per 'g'.
 */
export const CHAIN_DEAL_SEEDS: Record<Chain, [string, number][]> = {
  metro: [
    ['chicken_thigh', 2.99],
    ['broccoli', 1.99],
    ['greek_yogurt', 3.29],
    ['rice', 3.99],
    ['parmesan', 5.49],
  ],
  iga: [
    ['salmon', 0.025],
    ['spinach', 2.59],
    ['tofu', 2.59],
    ['feta', 3.49],
    ['eggs', 3.79],
  ],
  provigo: [
    ['ground_beef', 4.99],
    ['pasta', 1.79],
    ['tomato_sauce', 2.29],
    ['mushroom', 2.19],
    ['cheddar', 4.99],
  ],
  maxi: [
    ['pork_shoulder', 2.99],
    ['chickpeas', 0.99],
    ['lentils', 2.49],
    ['coconut_milk', 1.79],
    ['tortilla', 2.49],
  ],
  superc: [
    ['chicken_breast', 8.99],
    ['quinoa', 4.99],
    ['avocado', 0.99],
    ['shrimp', 0.022],
    ['kale', 1.99],
  ],
  loblaws: [
    ['chicken_breast', 8.99],
    ['broccoli', 1.89],
    ['greek_yogurt', 3.39],
    ['pasta', 1.79],
    ['cheddar', 4.99],
    ['salmon', 0.025],
    ['spinach', 2.59],
  ],
  walmart: [
    ['ground_beef', 4.99],
    ['chicken_thigh', 2.99],
    ['eggs', 3.79],
    ['rice', 3.99],
    ['tortilla', 2.49],
    ['chickpeas', 0.99],
    ['bell_pepper', 0.89],
    ['shrimp', 0.023],
  ],
};

const ADDED_STORE_SUFFIX = '-added';

/** Plausible Montreal-flavoured names for an added store, keyed by chain. */
const ADDED_NAME_QUARTIER: Record<Chain, string> = {
  metro: 'Marché',
  iga: 'Quartier',
  provigo: 'Le Marché',
  maxi: 'Grand',
  superc: 'Entrepôt',
  loblaws: 'Le Grand',
  walmart: 'Supercentre',
};

/**
 * Deterministic id for a user-added store of `chain` in `fsa`. Lower-cased to
 * match the seeded-store id style (e.g. "loblaws-h2x-added"). Pure function of
 * its inputs so it can be reconstructed on rehydration / re-discovery.
 */
export function addedStoreIdFor(chain: Chain, fsa: string): string {
  return `${chain}-${fsa.toLowerCase()}${ADDED_STORE_SUFFIX}`;
}

export interface AddedStoreBundle {
  store: Store;
  deals: Deal[];
}

/**
 * Build a fully-formed user-added store (+ its deals) for a chain in an FSA.
 * Deterministic: same (chain, fsa) always yields the same id, name, distance,
 * and deals — so it survives persistence and can be rebuilt from just its id.
 */
export function makeAddedStore(chain: Chain, fsa: string): AddedStoreBundle {
  const fsaUpper = fsa.toUpperCase();
  const id = addedStoreIdFor(chain, fsa);
  const sales = CHAIN_DEAL_SEEDS[chain] ?? [];
  const deals = buildDealsForStore(id, sales, chain);
  const store: Store = {
    id,
    chain,
    name: `${CHAIN_LABELS[chain]} ${ADDED_NAME_QUARTIER[chain]} ${fsaUpper}`,
    distanceKm: jitterDistance(2.5, fsaUpper, id),
    dealCount: deals.length,
    flyerUrl: CHAIN_FLYER_URLS[chain],
  };
  return { store, deals };
}

/**
 * Parse a deterministic added-store id ("`chain`-`fsa`-added") back into a
 * rebuilt store + deals, or null if it is not a valid added-store id (unknown
 * chain, malformed shape). Chain names never contain a dash, so the leading
 * segment is the chain and the middle segment is the fsa.
 */
export function rebuildAddedStoreFromId(id: string): AddedStoreBundle | null {
  if (!id.endsWith(ADDED_STORE_SUFFIX)) return null;
  const core = id.slice(0, -ADDED_STORE_SUFFIX.length);
  const parts = core.split('-');
  if (parts.length !== 2) return null;
  const [chain, fsa] = parts;
  if (!CHAIN_CATALOG.includes(chain as Chain) || !fsa) return null;
  return makeAddedStore(chain as Chain, fsa);
}

/**
 * Re-merge any user-added store whose deterministic id is still selected but
 * missing from `result` (e.g. after a forced live re-discovery rebuilt the
 * result from seeds). Pure: returns a new result, never mutates the input, and
 * never silently drops a store the user explicitly kept.
 */
export function mergeAddedStores(
  result: DiscoveryResult,
  selectedStoreIds: string[],
): DiscoveryResult {
  const present = new Set(result.stores.map((s) => s.id));
  const stores = [...result.stores];
  const deals = [...result.deals];
  let changed = false;
  for (const id of selectedStoreIds) {
    if (present.has(id)) continue;
    const rebuilt = rebuildAddedStoreFromId(id);
    if (!rebuilt) continue;
    stores.push(rebuilt.store);
    deals.push(...rebuilt.deals);
    present.add(id);
    changed = true;
  }
  return changed ? { ...result, stores, deals } : result;
}
