import {
  BASE_PRICES as EXTRACT_BASE,
  GRAMS_PER as EXTRACT_GRAMS,
  HARD_MAX as EXTRACT_HARD_MAX,
  HARD_MIN as EXTRACT_HARD_MIN,
  PLAUSIBLE_MAX as EXTRACT_PLAUSIBLE_MAX,
  PLAUSIBLE_MIN as EXTRACT_PLAUSIBLE_MIN,
  classifyPrice as extractClassify,
} from '../supabase/functions/extract-flyer/plausibility';
import {
  BASE_PRICES as DISCOVER_BASE,
  GRAMS_PER as DISCOVER_GRAMS,
  HARD_MAX as DISCOVER_HARD_MAX,
  HARD_MIN as DISCOVER_HARD_MIN,
  PLAUSIBLE_MAX as DISCOVER_PLAUSIBLE_MAX,
  PLAUSIBLE_MIN as DISCOVER_PLAUSIBLE_MIN,
  classifyPrice as discoverClassify,
} from '../supabase/functions/discover-deals/plausibility';
import {
  HARD_MAX,
  HARD_MIN,
  PLAUSIBLE_MAX,
  PLAUSIBLE_MIN,
  classifyPrice as clientClassify,
} from '@/domain/priceBand';
import { GRAMS_PER } from '@/domain/units';
import { BASE_PRICES } from '@/data/pricing';

/**
 * The price-plausibility layer is duplicated three ways (client priceBand.ts +
 * one copy per edge function) because MCP deploys are per-function bundles that
 * cannot import from src/. This suite is the guardrail: if any copy drifts on
 * its price table, band constants, or conversion factors, the three would
 * disagree on which deals are absurd. Keep them in lockstep.
 */

describe('server price tables match src/data/pricing.ts BASE_PRICES exactly', () => {
  const appIds = Object.keys(BASE_PRICES).sort();

  it('extract-flyer covers exactly the same ids as the app table', () => {
    expect(Object.keys(EXTRACT_BASE).sort()).toEqual(appIds);
  });

  it('discover-deals covers exactly the same ids as the app table', () => {
    expect(Object.keys(DISCOVER_BASE).sort()).toEqual(appIds);
  });

  it('every entry has the app price (unitPrice) and canonical unit', () => {
    for (const [id, base] of Object.entries(BASE_PRICES)) {
      expect(EXTRACT_BASE[id]).toEqual({ price: base.unitPrice, unit: base.unit });
      expect(DISCOVER_BASE[id]).toEqual({
        price: base.unitPrice,
        unit: base.unit,
      });
    }
  });
});

describe('band constants + conversion factors match the client module', () => {
  it('has the same four band constants as priceBand.ts', () => {
    expect(EXTRACT_PLAUSIBLE_MIN).toBe(PLAUSIBLE_MIN);
    expect(EXTRACT_PLAUSIBLE_MAX).toBe(PLAUSIBLE_MAX);
    expect(EXTRACT_HARD_MIN).toBe(HARD_MIN);
    expect(EXTRACT_HARD_MAX).toBe(HARD_MAX);
  });

  it('has the same GRAMS_PER mass factors as units.ts', () => {
    expect(EXTRACT_GRAMS.g).toBe(GRAMS_PER.g);
    expect(EXTRACT_GRAMS.kg).toBe(GRAMS_PER.kg);
    expect(EXTRACT_GRAMS.lb).toBe(GRAMS_PER.lb);
  });

  it('classifies identically to the client for representative deals', () => {
    const cases: Array<[number, string, string]> = [
      [4.77, 'g', 'shrimp'], // reject
      [0.022, 'g', 'shrimp'], // ok
      [1.95, 'lb', 'chicken_thigh'], // ok
      [8.99, 'bag', 'rice'], // suspicious (ratio ~1.64)
      [12.99, 'pack', 'shrimp'], // abstain (non-convertible unit)
      [2.49, 'kg', 'chicken_thigh'], // suspicious (ratio ~0.25)
    ];
    for (const [price, unit, id] of cases) {
      const client = clientClassify(price, unit, BASE_PRICES[id]);
      expect(extractClassify(price, unit, id)).toBe(client);
      expect(discoverClassify(price, unit, id)).toBe(client);
    }
  });
});

describe('the two edge copies are structurally identical', () => {
  it('export identical price tables, constants, and mass factors', () => {
    expect(DISCOVER_BASE).toEqual(EXTRACT_BASE);
    expect(DISCOVER_GRAMS).toEqual(EXTRACT_GRAMS);
    expect([
      DISCOVER_PLAUSIBLE_MIN,
      DISCOVER_PLAUSIBLE_MAX,
      DISCOVER_HARD_MIN,
      DISCOVER_HARD_MAX,
    ]).toEqual([
      EXTRACT_PLAUSIBLE_MIN,
      EXTRACT_PLAUSIBLE_MAX,
      EXTRACT_HARD_MIN,
      EXTRACT_HARD_MAX,
    ]);
  });

  it('classify identically for every ingredient across a sweep of ratios', () => {
    // Sweep each id at prices spanning reject/suspicious/ok/suspicious/reject
    // plus a deliberately non-convertible unit (abstain) — the two copies must
    // agree on every single one.
    for (const [id, base] of Object.entries(BASE_PRICES)) {
      const unit = base.flyerUnit ?? base.unit;
      const prices = [0.1, 0.5, 0.75, 1.0, 2.0, 5.0].map(
        (r) => r * base.unitPrice,
      );
      for (const price of prices) {
        expect(discoverClassify(price, unit, id)).toBe(
          extractClassify(price, unit, id),
        );
      }
      // Non-convertible unit → both abstain.
      expect(discoverClassify(base.unitPrice, 'widget', id)).toBe(
        extractClassify(base.unitPrice, 'widget', id),
      );
    }
  });
});
