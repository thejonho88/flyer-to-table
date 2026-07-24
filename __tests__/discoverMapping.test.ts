import {
  isWithinWindow,
  mapDeals,
  packageFallbackUnit,
  parsePostPrice,
  prefilterItems,
  type Candidate,
  type Match,
} from '../supabase/functions/discover-deals/mapDeals';
import { chainFromMerchant } from '../supabase/functions/discover-deals/flipp';
import { weekOf } from '../supabase/functions/discover-deals/weeks';

const TODAY = '2026-07-23'; // a Thursday

/* -------------------------------- weekOf ---------------------------------- */

describe('weekOf (Thu–Wed flyer week)', () => {
  it('a Thursday maps to itself', () => {
    expect(weekOf('2026-07-23')).toBe('2026-07-23');
  });
  it('a Wednesday maps back to the prior Thursday', () => {
    expect(weekOf('2026-07-22')).toBe('2026-07-16');
  });
  it('a Sunday maps back to the most recent Thursday', () => {
    expect(weekOf('2026-07-26')).toBe('2026-07-23');
  });
  it('a Friday maps back one day to Thursday', () => {
    expect(weekOf('2026-07-24')).toBe('2026-07-23');
  });
});

/* --------------------------- chainFromMerchant ---------------------------- */

describe('chainFromMerchant', () => {
  it('maps observed merchant names case-insensitively', () => {
    expect(chainFromMerchant('Metro')).toBe('metro');
    expect(chainFromMerchant('metro')).toBe('metro');
    expect(chainFromMerchant('Super C')).toBe('superc');
    expect(chainFromMerchant('Maxi')).toBe('maxi');
    expect(chainFromMerchant('Provigo')).toBe('provigo');
    expect(chainFromMerchant('IGA')).toBe('iga');
    expect(chainFromMerchant('Walmart')).toBe('walmart');
  });
  it('does NOT fold distinct banners like "Metro Plus" into metro', () => {
    expect(chainFromMerchant('Metro Plus')).toBeNull();
    expect(chainFromMerchant('Adonis')).toBeNull();
    expect(chainFromMerchant('')).toBeNull();
    expect(chainFromMerchant(undefined)).toBeNull();
  });
});

/* ------------------------------ parsePostPrice ---------------------------- */

describe('parsePostPrice', () => {
  it('"/lb - 4,39$/kg" → lb at current_price (ignores the kg dual)', () => {
    expect(parsePostPrice('/lb - 4,39$/kg', 1.99)).toEqual({
      unit: 'lb',
      price: 1.99,
    });
  });
  it('"/kg" only → kg', () => {
    expect(parsePostPrice('/kg', 9.68)).toEqual({ unit: 'kg', price: 9.68 });
  });
  it('"/100g" → g with price ÷ 100 rounded to 4 decimals', () => {
    expect(parsePostPrice('/100g', 2.99)).toEqual({ unit: 'g', price: 0.0299 });
  });
  it('"/100 g" (with space) → g ÷ 100', () => {
    expect(parsePostPrice('/100 g', 3)).toEqual({ unit: 'g', price: 0.03 });
  });
  it('"/g" → g at current_price', () => {
    expect(parsePostPrice('/g', 0.05)).toEqual({ unit: 'g', price: 0.05 });
  });
  it('null / unparseable → null (signals package fallback)', () => {
    expect(parsePostPrice(null, 5)).toBeNull();
    expect(parsePostPrice('each', 5)).toBeNull();
    expect(parsePostPrice('', 5)).toBeNull();
  });
});

/* --------------------------- packageFallbackUnit -------------------------- */

describe('packageFallbackUnit', () => {
  it('keeps package-like units as-is', () => {
    expect(packageFallbackUnit('can')).toBe('can');
    expect(packageFallbackUnit('pack')).toBe('pack');
    expect(packageFallbackUnit('L')).toBe('L');
  });
  it('collapses recipe-scale units to unit', () => {
    expect(packageFallbackUnit('clove')).toBe('unit');
    expect(packageFallbackUnit('tsp')).toBe('unit');
    expect(packageFallbackUnit('cup')).toBe('unit');
  });
  it('NEVER prices a package as per-mass (kg/g/lb → unit)', () => {
    expect(packageFallbackUnit('kg')).toBe('unit');
    expect(packageFallbackUnit('g')).toBe('unit');
    expect(packageFallbackUnit('lb')).toBe('unit');
  });
});

/* ------------------------------ isWithinWindow ---------------------------- */

describe('isWithinWindow (validity + 10-day rule)', () => {
  const base = (valid_to: string | null, valid_from: string | null = TODAY) => ({
    valid_from,
    valid_to,
  });

  it('keeps a candidate ending within 10 days', () => {
    expect(isWithinWindow(base('2026-07-29'), TODAY)).toBe(true);
  });
  it('drops a candidate whose valid_to is >10 days out (long promo)', () => {
    expect(isWithinWindow(base('2026-08-15'), TODAY)).toBe(false);
  });
  it('drops an already-expired candidate', () => {
    expect(isWithinWindow(base('2026-07-20'), TODAY)).toBe(false);
  });
  it('drops a not-yet-started candidate', () => {
    expect(isWithinWindow(base('2026-07-29', '2026-07-30'), TODAY)).toBe(false);
  });
  it('keeps a candidate with no dates', () => {
    expect(isWithinWindow(base(null, null), TODAY)).toBe(true);
  });
});

/* -------------------------------- prefilter ------------------------------- */

describe('prefilterItems', () => {
  const opts = {
    allowedFlyerIds: new Set(['100']),
    knownChains: new Set(['metro' as const]),
    todayISO: TODAY,
    query: 'poulet',
  };

  it('keeps only items from an allowed flyer + known chain within window', () => {
    const items = [
      { name: 'Poulet | Chicken', current_price: 1.99, flyer_id: '100', merchant_name: 'Metro', valid_to: '2026-07-29' },
      { name: 'Poulet | Chicken', current_price: 1.99, flyer_id: '999', merchant_name: 'Metro', valid_to: '2026-07-29' }, // wrong flyer
      { name: 'Poulet | Chicken', current_price: 1.99, flyer_id: '100', merchant_name: 'Adonis', valid_to: '2026-07-29' }, // unknown chain
      { name: 'Poulet | Chicken', current_price: 1.99, flyer_id: '100', merchant_name: 'Metro', valid_to: '2026-08-30' }, // long promo
    ];
    const kept = prefilterItems(items, opts);
    expect(kept).toHaveLength(1);
    expect(kept[0].flyer_id).toBe('100');
  });

  it('dedupes by item id and caps at 12', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({
      id: i,
      name: `Poulet ${i} | Chicken`,
      current_price: 1.99,
      flyer_id: '100',
      merchant_name: 'Metro',
      valid_to: '2026-07-29',
    }));
    // Two duplicates of id 0.
    many.push({ id: 0, name: 'Poulet dup | Chicken', current_price: 1.99, flyer_id: '100', merchant_name: 'Metro', valid_to: '2026-07-29' });
    const kept = prefilterItems(many, opts);
    expect(kept).toHaveLength(12);
    expect(new Set(kept.map((k) => k.id)).size).toBe(12);
  });
});

/* -------------------------------- mapDeals -------------------------------- */

function cand(partial: Partial<Candidate>): Candidate {
  return {
    storeId: 'metro-h4a',
    chain: 'metro',
    name: 'Cuisses de poulet | Chicken Thighs',
    current_price: 1.99,
    original_price: 3.99,
    post_price_text: '/lb - 4,39$/kg',
    merchant_name: 'Metro',
    valid_from: TODAY,
    valid_to: '2026-07-29',
    ...partial,
  };
}

describe('mapDeals', () => {
  it('stamps a per-lb deal from post_price_text with server fields', () => {
    const candidates = [cand({})];
    const matches: Match[] = [{ ingredientId: 'chicken_thigh', candidateIndex: 0 }];
    const [d] = mapDeals(candidates, matches, TODAY);
    expect(d.id).toBe('disc-metro-h4a-chicken_thigh');
    expect(d.storeId).toBe('metro-h4a');
    expect(d.provenance).toBe('discovered');
    expect(d.unit).toBe('lb');
    expect(d.salePrice).toBe(1.99);
    expect(d.regularPrice).toBe(3.99);
    expect(d.label).toBe('Chicken Thighs');
    expect(d.labelFr).toBe('Cuisses de poulet');
    expect(d.validFrom).toBe(TODAY);
    expect(d.validTo).toBe('2026-07-29');
  });

  it('/kg text → kg unit', () => {
    const [d] = mapDeals(
      [cand({ post_price_text: '/kg', current_price: 9.68, original_price: 12.99 })],
      [{ ingredientId: 'chicken_thigh', candidateIndex: 0 }],
      TODAY,
    );
    expect(d.unit).toBe('kg');
    expect(d.salePrice).toBe(9.68);
  });

  it('/100 g text → g unit with price ÷ 100', () => {
    const [d] = mapDeals(
      [cand({ post_price_text: '/100 g', current_price: 2.99, original_price: 3.99 })],
      [{ ingredientId: 'salmon', candidateIndex: 0 }],
      TODAY,
    );
    expect(d.unit).toBe('g');
    expect(d.salePrice).toBe(0.0299);
    expect(d.regularPrice).toBe(0.0399);
  });

  // Unit-correctness gate: the server only emits deals the planner can price
  // (unit === canonical, or both mass). A mass↔non-mass mismatch is DROPPED so
  // it can never pass through the resolver as a wrong per-canonical-unit price.
  it('drops a package-priced fish deal (shrimp defaultUnit g, no post_price_text)', () => {
    const deals = mapDeals(
      [cand({ post_price_text: null, current_price: 12.99, name: 'Crevettes | Shrimp' })],
      [{ ingredientId: 'shrimp', candidateIndex: 0 }],
      TODAY,
    );
    expect(deals).toHaveLength(0);
  });

  it('keeps a per-lb meat deal (chicken_thigh defaultUnit kg → lb, both mass)', () => {
    const [d] = mapDeals(
      [cand({ post_price_text: '/lb', current_price: 1.99, original_price: 3.99 })],
      [{ ingredientId: 'chicken_thigh', candidateIndex: 0 }],
      TODAY,
    );
    expect(d.unit).toBe('lb');
    expect(d.salePrice).toBe(1.99);
  });

  it('drops a per-lb produce deal whose canonical unit is non-mass (tomato → unit)', () => {
    const deals = mapDeals(
      [cand({ post_price_text: '/lb', current_price: 1.49, name: 'Tomates | Tomatoes' })],
      [{ ingredientId: 'tomato', candidateIndex: 0 }],
      TODAY,
    );
    expect(deals).toHaveLength(0);
  });

  it('keeps a package-priced deal whose canonical unit matches (chickpeas → can)', () => {
    const [d] = mapDeals(
      [cand({ post_price_text: null, current_price: 0.99, name: 'Pois chiches | Chickpeas' })],
      [{ ingredientId: 'chickpeas', candidateIndex: 0 }],
      TODAY,
    );
    expect(d.unit).toBe('can');
  });

  it("keeps a 'unit'-priced deal whose canonical unit is 'unit' (avocado)", () => {
    const [d] = mapDeals(
      [cand({ post_price_text: null, current_price: 0.99, name: 'Avocats | Avocados' })],
      [{ ingredientId: 'avocado', candidateIndex: 0 }],
      TODAY,
    );
    expect(d.unit).toBe('unit');
    expect(d.salePrice).toBe(0.99);
  });

  it('clamps salePrice above regularPrice down to regular', () => {
    const [d] = mapDeals(
      [cand({ current_price: 12, original_price: 9, post_price_text: '/kg' })],
      [{ ingredientId: 'chicken_thigh', candidateIndex: 0 }],
      TODAY,
    );
    expect(d.salePrice).toBe(9);
    expect(d.regularPrice).toBe(9);
  });

  it('falls back regularPrice to salePrice when original_price is null/0', () => {
    const [d] = mapDeals(
      [cand({ current_price: 4.99, original_price: null, post_price_text: '/kg' })],
      [{ ingredientId: 'chicken_thigh', candidateIndex: 0 }],
      TODAY,
    );
    expect(d.regularPrice).toBe(4.99);
    expect(d.salePrice).toBe(4.99);
  });

  it('dedupes per (store, ingredient) keeping the cheapest sale price', () => {
    const candidates = [
      cand({ current_price: 6.99, original_price: 8.99, post_price_text: '/kg' }),
      cand({ current_price: 4.99, original_price: 8.99, post_price_text: '/kg' }),
    ];
    const matches: Match[] = [
      { ingredientId: 'chicken_thigh', candidateIndex: 0 },
      { ingredientId: 'chicken_thigh', candidateIndex: 1 },
    ];
    const deals = mapDeals(candidates, matches, TODAY);
    expect(deals).toHaveLength(1);
    expect(deals[0].salePrice).toBe(4.99);
  });

  it('drops matches with an out-of-range candidate index or unknown ingredient', () => {
    const candidates = [cand({})];
    const deals = mapDeals(
      candidates,
      [
        { ingredientId: 'chicken_thigh', candidateIndex: 5 },
        { ingredientId: 'not_a_real_id', candidateIndex: 0 },
      ],
      TODAY,
    );
    expect(deals).toHaveLength(0);
  });

  // Price-plausibility: discovery is fully automated, so only a clean 'ok' price
  // is cached — both 'reject' (absurd) and 'suspicious' (unusual) are dropped.
  it("drops a 'reject' price (shrimp $4.77/g → ~159× the base per-gram price)", () => {
    const deals = mapDeals(
      [
        cand({
          post_price_text: '/g',
          current_price: 4.77,
          original_price: 5.99,
          name: 'Crevettes | Shrimp',
        }),
      ],
      [{ ingredientId: 'shrimp', candidateIndex: 0 }],
      TODAY,
    );
    expect(deals).toHaveLength(0);
  });

  it("drops a 'suspicious' price (chicken thigh $2.49/kg → ratio ~0.25)", () => {
    const deals = mapDeals(
      [cand({ post_price_text: '/kg', current_price: 2.49, original_price: 9.99 })],
      [{ ingredientId: 'chicken_thigh', candidateIndex: 0 }],
      TODAY,
    );
    expect(deals).toHaveLength(0);
  });

  it("keeps a clean 'ok' price ($4.99/kg chicken thigh → ratio ~0.50)", () => {
    const [d] = mapDeals(
      [cand({ post_price_text: '/kg', current_price: 4.99, original_price: 9.99 })],
      [{ ingredientId: 'chicken_thigh', candidateIndex: 0 }],
      TODAY,
    );
    expect(d.salePrice).toBe(4.99);
  });
});
