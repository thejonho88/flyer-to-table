import {
  validateDeals,
  type RawCandidate,
  type ValidationContext,
} from '../supabase/functions/extract-flyer/validate';
import { classifyPrice } from '../supabase/functions/extract-flyer/plausibility';
import { CHAIN_CATALOG, CHAIN_DEAL_SEEDS } from '@/data/deals';
import { BASE_PRICES } from '@/data/pricing';

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
    // Realistic per-lb ground beef (both prices sit inside the plausible band so
    // the clamp — not the price-plausibility gate — is what's under test).
    const [d] = ok([
      { ingredientId: 'ground_beef', salePrice: 12, regularPrice: 9, unit: 'lb' },
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
      { ingredientId: 'tofu', salePrice: 7.99, unit: 'squishmallows' },
    ]);
    // tofu defaultUnit is 'pack' (non-mass): an unknown unit on a non-mass
    // canonical falls back to defaultUnit (see the unit-correctness gate).
    // (A mass canonical would instead be dropped — see the shrimp-skewer tests.)
    expect(bad.unit).toBe('pack');

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
      { ingredientId: 'salmon', salePrice: 0.03, unit: 'g', labelFr: 'Saumon' },
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

  // --- Unit-correctness gate (Maxi "raw shrimp skewers 300 g @ $4.77 each") ---
  // Regression: a per-skewer price attached to a per-gram canonical unit
  // produced $4.77/g -> "$477.00/100 g" -> a $2,385 shopping-list line.

  it('drops a non-mass unit on a mass canonical (shrimp @ "each" and variants)', () => {
    for (const unit of ['each', 'unit', '300g', 'brochette']) {
      const result = validateDeals(
        [{ ingredientId: 'shrimp', salePrice: 4.77, unit }],
        CTX,
      );
      expect(result).toEqual({ ok: false, reason: 'no_deals_found' });
    }
  });

  it('keeps shrimp priced per 100 g, converting to per-gram', () => {
    const [d] = ok([
      { ingredientId: 'shrimp', salePrice: 4.77, unit: '100g' },
    ]);
    expect(d.unit).toBe('g');
    expect(d.salePrice).toBeCloseTo(0.0477, 6);
  });

  it('keeps a mass<->mass mismatch: beef (canonical kg) priced per lb', () => {
    const [d] = ok([
      { ingredientId: 'beef_strips', salePrice: 8.99, unit: 'lb' },
    ]);
    expect(d.unit).toBe('lb');
    expect(d.salePrice).toBe(8.99);
  });

  it('keeps a non-mass canonical with an unknown unit (chickpeas -> defaultUnit "can")', () => {
    const [each] = ok([
      { ingredientId: 'chickpeas', salePrice: 1.29, unit: 'each' },
    ]);
    expect(each.unit).toBe('can');

    const [unknown] = ok([
      { ingredientId: 'chickpeas', salePrice: 1.29, unit: 'boîte' },
    ]);
    expect(unknown.unit).toBe('can');
  });

  it('drops a mass price on a non-mass canonical (tomato canonical "unit" priced per lb)', () => {
    const result = validateDeals(
      [{ ingredientId: 'tomato', salePrice: 2.49, unit: 'lb' }],
      CTX,
    );
    expect(result).toEqual({ ok: false, reason: 'no_deals_found' });
  });
});

/* ---------------------- price-plausibility band gate ---------------------- */

describe('validateDeals price-plausibility band', () => {
  it("flags a 'suspicious' price with suspicious:true but keeps it", () => {
    // rice $8.99/bag vs $5.49 regular → ratio ~1.64 (above PLAUSIBLE_MAX 1.50,
    // inside HARD): unusual but believable → kept, flagged.
    const [d] = ok([{ ingredientId: 'rice', salePrice: 8.99, unit: 'bag' }]);
    expect(d.suspicious).toBe(true);
    expect(d.salePrice).toBe(8.99);
  });

  it("does NOT flag an in-band 'ok' price", () => {
    const [d] = ok([{ ingredientId: 'rice', salePrice: 3.99, unit: 'bag' }]);
    expect('suspicious' in d).toBe(false);
  });

  it("hard-drops a 'reject' price: shrimp $4.77/g passes the unit gate but is absurd", () => {
    // 'g' matches shrimp's canonical unit (so the unit gate lets it through),
    // but $4.77/g is ~159× the $0.03/g base → reject. This is the exact incident.
    const result = validateDeals(
      [{ ingredientId: 'shrimp', salePrice: 4.77, unit: 'g' }],
      CTX,
    );
    expect(result).toEqual({ ok: false, reason: 'no_deals_found' });
  });

  it("keeps chicken legs at $1.95/lb as a clean 'ok' deal", () => {
    const [d] = ok([{ ingredientId: 'chicken_thigh', salePrice: 1.95, unit: 'lb' }]);
    expect(d.salePrice).toBe(1.95);
    expect('suspicious' in d).toBe(false);
  });

  it('dedupe prefers the cheapest CLEAN deal over a cheaper suspicious one', () => {
    // A suspicious (very cheap) chicken price and a clean (pricier) one for the
    // same ingredient: the clean one wins despite being more expensive.
    const [d] = ok([
      { ingredientId: 'chicken_thigh', salePrice: 1.0, unit: 'lb' }, // ratio ~0.22 → suspicious
      { ingredientId: 'chicken_thigh', salePrice: 4.99, unit: 'lb' }, // ratio ~1.11 → ok
    ]);
    expect(d.salePrice).toBe(4.99);
    expect('suspicious' in d).toBe(false);
  });

  it('keeps a suspicious deal only when no clean candidate exists', () => {
    const [d] = ok([
      { ingredientId: 'chicken_thigh', salePrice: 1.2, unit: 'lb' }, // suspicious
      { ingredientId: 'chicken_thigh', salePrice: 1.0, unit: 'lb' }, // cheaper, still suspicious
    ]);
    expect(d.suspicious).toBe(true);
    expect(d.salePrice).toBe(1.0); // among suspicious, cheapest wins
  });

  it("classifies every CHAIN_DEAL_SEEDS entry as 'ok' (clean seed data is never flagged)", () => {
    for (const chain of CHAIN_CATALOG) {
      for (const [ingredientId, salePrice] of CHAIN_DEAL_SEEDS[chain]) {
        const base = BASE_PRICES[ingredientId];
        // Seed prices are in the flyer unit (per-lb for meats, else canonical).
        const flyerUnit = base.flyerUnit ?? base.unit;
        expect(classifyPrice(salePrice, flyerUnit, ingredientId)).toBe('ok');
      }
    }
  });
});
