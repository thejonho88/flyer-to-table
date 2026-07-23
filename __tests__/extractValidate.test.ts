import {
  validateDeals,
  type RawCandidate,
  type ValidationContext,
} from '../supabase/functions/extract-flyer/validate';

const CTX: ValidationContext = {
  storeId: 'metro-h2x',
  chain: 'metro',
  // A Thursday: its ISO week is Mon 2026-07-20 .. Sun 2026-07-26.
  todayISO: '2026-07-23',
};
const WEEK_MON = '2026-07-20';
const WEEK_SUN = '2026-07-26';

/** Convenience: run the validator and assert it succeeded, returning deals. */
function ok(candidates: RawCandidate[], ctx: ValidationContext = CTX) {
  const result = validateDeals(candidates, ctx);
  if (!result.ok) throw new Error(`expected ok, got ${result.reason}`);
  return result.deals;
}

describe('validateDeals', () => {
  it('drops entries whose ingredientId is not in the catalog', () => {
    const deals = ok([
      { ingredientId: 'not_a_real_id', salePrice: 2, unit: 'lb' },
      { ingredientId: 'chicken_thigh', salePrice: 5.99, unit: 'lb' },
    ]);
    expect(deals).toHaveLength(1);
    expect(deals[0].ingredientId).toBe('chicken_thigh');
  });

  it('clamps salePrice to regularPrice when it exceeds it', () => {
    const [d] = ok([
      { ingredientId: 'salmon', salePrice: 12, regularPrice: 9, unit: 'g' },
    ]);
    expect(d.salePrice).toBe(9);
    expect(d.regularPrice).toBe(9);
    expect(d.salePrice).toBeLessThanOrEqual(d.regularPrice);
  });

  it('falls back regularPrice to salePrice when missing or zero (no invented savings)', () => {
    const missing = ok([
      { ingredientId: 'milk', salePrice: 4.29, unit: 'L' },
    ])[0];
    expect(missing.regularPrice).toBe(4.29);
    expect(missing.salePrice).toBe(4.29);

    const zero = ok([
      { ingredientId: 'eggs', salePrice: 3.5, regularPrice: 0, unit: 'dozen' },
    ])[0];
    expect(zero.regularPrice).toBe(3.5);
  });

  it('defaults missing/invalid validity dates to the Mon–Sun week of todayISO', () => {
    const [absent] = ok([
      { ingredientId: 'ground_beef', salePrice: 6.99, unit: 'lb' },
    ]);
    expect(absent.validFrom).toBe(WEEK_MON);
    expect(absent.validTo).toBe(WEEK_SUN);

    const [invalid] = ok([
      {
        ingredientId: 'ground_pork',
        salePrice: 4.99,
        unit: 'lb',
        validFrom: 'not-a-date',
        validTo: '2026/07/30',
      },
    ]);
    expect(invalid.validFrom).toBe(WEEK_MON);
    expect(invalid.validTo).toBe(WEEK_SUN);
  });

  it('keeps valid flyer dates when present', () => {
    const [d] = ok([
      {
        ingredientId: 'rice',
        salePrice: 8.99,
        unit: 'bag',
        validFrom: '2026-07-15',
        validTo: '2026-07-21',
      },
    ]);
    expect(d.validFrom).toBe('2026-07-15');
    expect(d.validTo).toBe('2026-07-21');
  });

  it('sanitizes unknown units to the ingredient defaultUnit and normalizes casing', () => {
    const [bad] = ok([
      { ingredientId: 'chicken_breast', salePrice: 7.99, unit: 'squishmallows' },
    ]);
    // chicken_breast defaultUnit is 'kg'
    expect(bad.unit).toBe('kg');

    const [cased] = ok([
      { ingredientId: 'chicken_breast', salePrice: 7.99, unit: 'LB' },
    ]);
    expect(cased.unit).toBe('lb');

    const [litre] = ok([
      { ingredientId: 'milk', salePrice: 4.29, unit: 'l' },
    ]);
    expect(litre.unit).toBe('L');
  });

  it('converts per-100g fish prices to per-gram and rewrites the unit to g', () => {
    const [d] = ok([
      { ingredientId: 'salmon', salePrice: 2.99, unit: '100 g' },
    ]);
    expect(d.salePrice).toBeCloseTo(0.0299, 6);
    expect(d.unit).toBe('g');
  });

  it('handles the "per 100 g" unit variant', () => {
    const [d] = ok([
      { ingredientId: 'tilapia', salePrice: 1.99, unit: 'per 100 g' },
    ]);
    expect(d.salePrice).toBeCloseTo(0.0199, 6);
    expect(d.unit).toBe('g');
  });

  it('divides regularPrice too when converting per-100g', () => {
    const [d] = ok([
      {
        ingredientId: 'salmon',
        salePrice: 2.99,
        regularPrice: 3.99,
        unit: '/100g',
      },
    ]);
    expect(d.salePrice).toBeCloseTo(0.0299, 6);
    expect(d.regularPrice).toBeCloseTo(0.0399, 6);
    expect(d.salePrice).toBeLessThanOrEqual(d.regularPrice);
    expect(d.unit).toBe('g');
  });

  it('passes a plain "g" unit through unconverted (per-gram already)', () => {
    const [d] = ok([
      { ingredientId: 'shrimp', salePrice: 0.022, unit: 'g' },
    ]);
    expect(d.salePrice).toBe(0.022);
    expect(d.unit).toBe('g');
  });

  it('dedupes per ingredientId keeping the cheapest sale price', () => {
    const deals = ok([
      { ingredientId: 'chicken_thigh', salePrice: 6.99, unit: 'lb' },
      { ingredientId: 'chicken_thigh', salePrice: 4.99, unit: 'lb' },
      { ingredientId: 'chicken_thigh', salePrice: 5.99, unit: 'lb' },
    ]);
    expect(deals).toHaveLength(1);
    expect(deals[0].salePrice).toBe(4.99);
  });

  it('drops entries with non-finite or non-positive sale prices', () => {
    const result = validateDeals(
      [
        { ingredientId: 'tofu', salePrice: 0, unit: 'pack' },
        { ingredientId: 'tofu', salePrice: -1, unit: 'pack' },
        { ingredientId: 'tofu', salePrice: 'free', unit: 'pack' },
      ],
      CTX,
    );
    expect(result.ok).toBe(false);
  });

  it('stamps id, storeId and provenance server-side and omits sourceUrl', () => {
    const [d] = ok([
      { ingredientId: 'salmon', salePrice: 3.99, unit: 'g', labelFr: 'Saumon' },
    ]);
    expect(d.id).toBe('ext-metro-h2x-salmon');
    expect(d.storeId).toBe('metro-h2x');
    expect(d.provenance).toBe('extracted');
    expect(d.labelFr).toBe('Saumon');
    expect('sourceUrl' in d).toBe(false);
  });

  it('returns no_deals_found when nothing survives filtering', () => {
    const result = validateDeals(
      [{ ingredientId: 'unknown', salePrice: 1, unit: 'lb' }],
      CTX,
    );
    expect(result).toEqual({ ok: false, reason: 'no_deals_found' });
  });

  it('returns no_deals_found for empty / non-array input', () => {
    expect(validateDeals([], CTX).ok).toBe(false);
    expect(validateDeals(undefined, CTX).ok).toBe(false);
    expect(validateDeals(null, CTX).ok).toBe(false);
  });
});
