import {
  bandForRatio,
  classifyPrice,
  HARD_MAX,
  HARD_MIN,
  PLAUSIBLE_MAX,
  PLAUSIBLE_MIN,
  type PriceBandBase,
} from '@/domain/priceBand';
import { convertUnitPrice, GRAMS_PER } from '@/domain/units';

/**
 * A canonical-unit base price with a chosen regular unitPrice, so a test can pick
 * a salePrice that lands on an exact ratio (identity conversion, no float noise).
 */
const unitBase = (unitPrice: number): PriceBandBase => ({ unitPrice, unit: 'can' });

describe('band constants', () => {
  it('nest PLAUSIBLE inside HARD', () => {
    expect(HARD_MIN).toBeLessThan(PLAUSIBLE_MIN);
    expect(PLAUSIBLE_MIN).toBeLessThan(PLAUSIBLE_MAX);
    expect(PLAUSIBLE_MAX).toBeLessThan(HARD_MAX);
    expect([HARD_MIN, PLAUSIBLE_MIN, PLAUSIBLE_MAX, HARD_MAX]).toEqual([
      0.15, 0.3, 1.5, 3.0,
    ]);
  });
});

describe('bandForRatio boundaries (inclusive on every edge)', () => {
  it("is 'ok' across [0.30, 1.50] including both edges", () => {
    expect(bandForRatio(0.3)).toBe('ok');
    expect(bandForRatio(1.5)).toBe('ok');
    expect(bandForRatio(1.0)).toBe('ok');
  });

  it("is 'suspicious' in the HARD gap, including the 0.15 / 3.0 edges", () => {
    expect(bandForRatio(0.15)).toBe('suspicious'); // inclusive HARD edge
    expect(bandForRatio(3.0)).toBe('suspicious'); // inclusive HARD edge
    expect(bandForRatio(0.2)).toBe('suspicious'); // below PLAUSIBLE_MIN
    expect(bandForRatio(2.0)).toBe('suspicious'); // above PLAUSIBLE_MAX
  });

  it("is 'ok' just inside the plausible edges and 'suspicious' just outside", () => {
    expect(bandForRatio(0.2999)).toBe('suspicious');
    expect(bandForRatio(0.3001)).toBe('ok');
    expect(bandForRatio(1.4999)).toBe('ok');
    expect(bandForRatio(1.5001)).toBe('suspicious');
  });

  it("is 'reject' strictly outside the HARD band", () => {
    expect(bandForRatio(0.1499)).toBe('reject');
    expect(bandForRatio(3.0001)).toBe('reject');
    expect(bandForRatio(0)).toBe('reject');
    expect(bandForRatio(159)).toBe('reject'); // the shrimp incident magnitude
  });
});

describe('classifyPrice (identity unit — exact ratios)', () => {
  const base = unitBase(2.0); // regular $2.00 / can

  it('maps exact-edge sale prices to the documented bands', () => {
    expect(classifyPrice(0.6, 'can', base)).toBe('ok'); // ratio 0.30
    expect(classifyPrice(3.0, 'can', base)).toBe('ok'); // ratio 1.50
    expect(classifyPrice(0.3, 'can', base)).toBe('suspicious'); // ratio 0.15
    expect(classifyPrice(6.0, 'can', base)).toBe('suspicious'); // ratio 3.0
    expect(classifyPrice(0.29, 'can', base)).toBe('reject'); // ratio 0.145
    expect(classifyPrice(6.02, 'can', base)).toBe('reject'); // ratio 3.01
  });
});

describe('classifyPrice (lb -> kg mass conversion)', () => {
  const base: PriceBandBase = { unitPrice: 10, unit: 'kg' };

  it('converts a per-lb sale price into the per-kg canonical unit', () => {
    // salePrice/lb that converts to exactly $10/kg (ratio 1.0).
    const perLbAtParity = (10 * GRAMS_PER.lb) / GRAMS_PER.kg;
    expect(convertUnitPrice(perLbAtParity, 'lb', 'kg')).toBeCloseTo(10, 10);
    expect(classifyPrice(perLbAtParity, 'lb', base)).toBe('ok');
    // A realistic chicken-thigh sale ($1.95/lb vs $9.90/kg regular) is ok.
    expect(classifyPrice(1.95, 'lb', { unitPrice: 9.9, unit: 'kg' })).toBe('ok');
  });
});

describe('classifyPrice (per-gram seafood — the shrimp incident)', () => {
  const shrimp: PriceBandBase = { unitPrice: 0.03, unit: 'g' };

  it("rejects a $4.77/g shrimp price (ratio ~159) that passes the unit gate", () => {
    expect(classifyPrice(4.77, 'g', shrimp)).toBe('reject');
  });

  it('keeps a believable per-gram shrimp sale', () => {
    expect(classifyPrice(0.022, 'g', shrimp)).toBe('ok'); // ratio 0.733
  });
});

describe('classifyPrice abstains (returns ok) with no trustworthy reference', () => {
  it('abstains when there is no base price', () => {
    expect(classifyPrice(9999, 'g', undefined)).toBe('ok');
  });

  it('abstains on a non-positive base price', () => {
    expect(classifyPrice(9999, 'can', { unitPrice: 0, unit: 'can' })).toBe('ok');
  });

  it('abstains when the deal unit is not convertible to the canonical unit', () => {
    // pack vs per-gram canonical: not mass<->mass, not an exact match -> abstain.
    expect(classifyPrice(12.99, 'pack', { unitPrice: 0.03, unit: 'g' })).toBe(
      'ok',
    );
  });
});
