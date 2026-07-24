import type {
  Deal,
  MealPlan,
  PlanContext,
  PlanPreferences,
  Recipe,
  Store,
} from '@/domain/types';
import {
  GRAMS_PER,
  convertQty,
  convertUnitPrice,
  isMassUnit,
} from '@/domain/units';
import { formatMoney } from '@/domain/money';
import {
  formatDualMassPrice,
  formatQty,
  formatUnitPrice,
} from '@/domain/format';
import {
  PricingResolver,
  computeMealCost,
  purchasableQuantity,
  round2,
} from '@/domain/costing';
import { buildShoppingList } from '@/domain/shoppingList';
import { INGREDIENTS } from '@/data/ingredients';
import { CHAIN_CATALOG } from '@/data/deals';
import { CHAIN_FLYER_URLS } from '@/data/flyerUrls';

/* ------------------------------- fixtures -------------------------------- */

const STORE: Store = {
  id: 'test-store',
  chain: 'superc',
  name: 'Test Super C',
  distanceKm: 1,
  dealCount: 1,
  flyerUrl: CHAIN_FLYER_URLS.superc,
};

/** chicken_breast @ $8.99/lb sale, $10.99/lb regular (unit 'lb'). */
const CHICKEN_DEAL: Deal = {
  id: 'test-store__chicken_breast',
  storeId: STORE.id,
  ingredientId: 'chicken_breast',
  label: 'Chicken Breast',
  salePrice: 8.99,
  regularPrice: 10.99,
  unit: 'lb',
  sourceUrl: CHAIN_FLYER_URLS.superc,
  validFrom: '2026-07-20',
  validTo: '2026-07-30',
};

/** canonical chicken_breast base price: per-kg with a per-lb flyer unit. */
const BASE = {
  chicken_breast: { unitPrice: 24.23, unit: 'kg', flyerUnit: 'lb' as const },
};

function ctxWith(deals: Deal[], stores: Store[] = [STORE]): PlanContext {
  const prefs: PlanPreferences = {
    postalCode: 'H2X 1Y4',
    selectedStoreIds: stores.map((s) => s.id),
    householdSize: 4,
    dietaryRestrictions: [],
    maxCookTimeMinutes: null,
    leftoversForLunch: false,
    dinnersPerWeek: 7,
  };
  return { deals, stores, recipes: [], ingredients: INGREDIENTS, prefs };
}

function recipe(ingredients: Recipe['ingredients']): Recipe {
  return {
    id: 'rtest',
    name: 'Test',
    image: 0,
    cookTimeMinutes: 30,
    baseServings: 4,
    dietaryTags: [],
    supportsLeftovers: false,
    ingredients,
  };
}

/* -------------------------------- units ---------------------------------- */

describe('mass unit conversions', () => {
  it('round-trips lb ↔ kg ↔ g for quantities', () => {
    expect(convertQty(1000, 'g', 'kg')).toBeCloseTo(1, 10);
    expect(convertQty(1, 'kg', 'g')).toBeCloseTo(1000, 10);
    expect(convertQty(1, 'lb', 'g')).toBeCloseTo(GRAMS_PER.lb, 10);
    // round-trip: kg -> lb -> kg is identity
    expect(convertQty(convertQty(0.6, 'kg', 'lb'), 'lb', 'kg')).toBeCloseTo(0.6, 10);
    // round-trip: g -> lb -> g is identity
    expect(convertQty(convertQty(500, 'g', 'lb'), 'lb', 'g')).toBeCloseTo(500, 8);
  });

  it('converts $8.99/lb to ≈ $19.82/kg (and back)', () => {
    expect(convertUnitPrice(8.99, 'lb', 'kg')).toBeCloseTo(19.82, 2);
    expect(convertUnitPrice(19.82, 'kg', 'lb')).toBeCloseTo(8.99, 2);
    // price round-trip is identity
    expect(convertUnitPrice(convertUnitPrice(8.99, 'lb', 'kg'), 'kg', 'lb')).toBeCloseTo(
      8.99,
      10,
    );
  });

  it('isMassUnit narrows only real mass units', () => {
    expect(isMassUnit('g')).toBe(true);
    expect(isMassUnit('kg')).toBe(true);
    expect(isMassUnit('lb')).toBe(true);
    expect(isMassUnit('can')).toBe(false);
    expect(isMassUnit('unit')).toBe(false);
  });

  it('treats lb as a continuous unit (no package ceil)', () => {
    expect(purchasableQuantity(2.2, 'lb')).toBe(2.2);
    expect(purchasableQuantity(1.3, 'can')).toBe(2); // discrete still ceils
  });
});

/* -------------------------------- costing -------------------------------- */

describe('cross-unit deal costing', () => {
  it('prices a 0.6 kg recipe quantity against a per-lb deal (sale + regular)', () => {
    const ctx = ctxWith([CHICKEN_DEAL]);
    const pricing = new PricingResolver(ctx, BASE);

    const p = pricing.resolve('chicken_breast')!;
    // Canonical (recipe) unit stays kg; deal prices convert into it.
    expect(p.unit).toBe('kg');
    expect(p.unitPrice).toBeCloseTo(convertUnitPrice(8.99, 'lb', 'kg'), 6);
    expect(p.regularUnitPrice).toBeCloseTo(convertUnitPrice(10.99, 'lb', 'kg'), 6);
    // Display fields stay in the flyer unit.
    expect(p.displayUnit).toBe('lb');
    expect(p.displayUnitPrice).toBe(8.99);
    expect(p.regularDisplayUnitPrice).toBe(10.99);

    // computeMealCost at baseServings (scale = 1): qty = 0.6 kg.
    const cost = computeMealCost(recipe([
      { ingredientId: 'chicken_breast', quantity: 0.6, unit: 'kg' },
    ]), 4, pricing);
    expect(cost.estimatedCost).toBeCloseTo(0.6 * convertUnitPrice(8.99, 'lb', 'kg'), 2);
    expect(cost.regularCost).toBeCloseTo(0.6 * convertUnitPrice(10.99, 'lb', 'kg'), 2);
    expect(cost.saleIngredientIds).toEqual(['chicken_breast']);
  });
});

describe('resolver picks the lowest price per gram across mixed units', () => {
  it('prefers a cheaper $/kg deal over a pricier $/lb deal', () => {
    const perLb: Deal = { ...CHICKEN_DEAL, id: 'a', storeId: 's1', salePrice: 8.99, unit: 'lb' };
    // 19.00 $/kg = 0.019 $/g, cheaper than 8.99 $/lb = 0.01982 $/g.
    const perKg: Deal = { ...CHICKEN_DEAL, id: 'b', storeId: 's2', salePrice: 19.0, regularPrice: 24.23, unit: 'kg' };
    const stores: Store[] = [
      { ...STORE, id: 's1' },
      { ...STORE, id: 's2' },
    ];
    const ctx = ctxWith([perLb, perKg], stores);
    const pricing = new PricingResolver(ctx, BASE);

    const p = pricing.resolve('chicken_breast')!;
    expect(p.displayUnit).toBe('kg'); // the per-kg deal won
    expect(p.displayUnitPrice).toBe(19.0);
    expect(p.storeId).toBe('s2');
  });
});

describe('unit-incompatibility gate (rogue-deal protection)', () => {
  // Canonical per-gram base prices, matching src/data/pricing.ts.
  const SHRIMP_BASE = { shrimp: { unitPrice: 0.03, unit: 'g' as const } };

  /** The exact repro: a stale 'pack'-priced shrimp deal ($12.99) that predates
   * the server-side unit gate, sourced from a per-gram ('g') ingredient. */
  const SHRIMP_PACK_DEAL: Deal = {
    id: 'test-store__shrimp',
    storeId: STORE.id,
    ingredientId: 'shrimp',
    label: 'Raw Shrimp Skewers',
    salePrice: 12.99,
    regularPrice: 14.99,
    unit: 'pack',
    sourceUrl: CHAIN_FLYER_URLS.superc,
    validFrom: '2026-07-20',
    validTo: '2026-07-30',
  };

  it('(a) ignores an incompatible pack deal and prices shrimp at its base per-gram price', () => {
    const ctx = ctxWith([SHRIMP_PACK_DEAL]);
    const pricing = new PricingResolver(ctx, SHRIMP_BASE);

    const p = pricing.resolve('shrimp')!;
    // Deal dropped: item is NOT on sale, priced in canonical grams at base.
    expect(p.onSale).toBe(false);
    expect(p.unit).toBe('g');
    expect(p.displayUnit).toBe('g');
    expect(p.unitPrice).toBe(0.03);
    expect(p.regularUnitPrice).toBe(0.03);
    // Never surfaces the rogue $12.99 pack price anywhere.
    expect(p.displayUnitPrice).toBe(0.03);
    expect(p.regularDisplayUnitPrice).toBe(0.03);

    // A recipe needing 500 g: cost is 500 × $0.03 = $15.00, NOT the
    // 500 × $12.99 = $6,495.00 that the mislabeled pack would have produced.
    const cost = computeMealCost(
      recipe([{ ingredientId: 'shrimp', quantity: 500, unit: 'g' }]),
      4,
      pricing,
    );
    expect(cost.estimatedCost).toBe(15);
    expect(cost.regularCost).toBe(15);
    expect(cost.saleIngredientIds).toEqual([]);
    expect(cost.estimatedCost).toBeLessThan(6495);
  });

  it('(a) shopping list renders shrimp in grams, off-sale, with no rogue total', () => {
    const ctx = ctxWith([SHRIMP_PACK_DEAL]);
    ctx.recipes = [recipe([{ ingredientId: 'shrimp', quantity: 500, unit: 'g' }])];
    const plan: MealPlan = {
      id: 'p',
      weekOf: '2026-07-20',
      totals: { estimated: 0, regular: 0, savings: 0, savingsPct: 0 },
      meals: [
        { day: 0, recipeId: 'rtest', servings: 4, estimatedCost: 0, regularCost: 0, saleIngredientIds: [] },
      ],
    };

    const list = buildShoppingList(plan, ctx);
    const lines = list.storeGroups
      .flatMap((g) => g.items)
      .filter((i) => i.ingredientId === 'shrimp');
    expect(lines).toHaveLength(1);
    const line = lines[0];
    expect(line.unit).toBe('g');
    expect(line.onSale).toBe(false);
    expect(line.unitPrice).toBe(0.03);
    expect(line.quantity).toBe(500);
    expect(line.lineTotal).toBe(round2(line.quantity * line.unitPrice));
    expect(line.lineTotal).toBe(15);
    expect(line.lineTotal).toBeLessThan(6495);
  });

  it('(b) still selects and converts a mass↔mass deal (lb deal, kg-priced ingredient)', () => {
    // chicken_breast: canonical 'kg', deal advertised per 'lb' — both mass.
    const ctx = ctxWith([CHICKEN_DEAL]);
    const pricing = new PricingResolver(ctx, BASE);

    const p = pricing.resolve('chicken_breast')!;
    expect(p.onSale).toBe(true);
    expect(p.unit).toBe('kg');
    expect(p.displayUnit).toBe('lb');
    expect(p.displayUnitPrice).toBe(8.99);
    expect(p.unitPrice).toBeCloseTo(convertUnitPrice(8.99, 'lb', 'kg'), 6);
  });

  it('(c) still selects an exact-unit-match deal (can ↔ can)', () => {
    const CAN_BASE = { black_beans: { unitPrice: 1.49, unit: 'can' as const } };
    const canDeal: Deal = {
      id: 'test-store__black_beans',
      storeId: STORE.id,
      ingredientId: 'black_beans',
      label: 'Black Beans',
      salePrice: 0.99,
      regularPrice: 1.49,
      unit: 'can',
      sourceUrl: CHAIN_FLYER_URLS.superc,
      validFrom: '2026-07-20',
      validTo: '2026-07-30',
    };
    const ctx = ctxWith([canDeal]);
    const pricing = new PricingResolver(ctx, CAN_BASE);

    const p = pricing.resolve('black_beans')!;
    expect(p.onSale).toBe(true);
    expect(p.unit).toBe('can');
    expect(p.displayUnit).toBe('can');
    expect(p.unitPrice).toBe(0.99);
  });

  it('(d) an incompatible deal contributes zero savings (regular == estimated)', () => {
    const ctx = ctxWith([SHRIMP_PACK_DEAL]);
    const pricing = new PricingResolver(ctx, SHRIMP_BASE);

    const cost = computeMealCost(
      recipe([{ ingredientId: 'shrimp', quantity: 500, unit: 'g' }]),
      4,
      pricing,
    );
    // No sale sourced from a rogue unit → estimated equals regular, savings = 0.
    expect(cost.estimatedCost).toBe(cost.regularCost);
    expect(cost.regularCost - cost.estimatedCost).toBe(0);
    expect(cost.saleIngredientIds).toEqual([]);
  });
});

/* ----------------------------- shopping list ----------------------------- */

describe('shopping list emits per-lb display lines', () => {
  it('consolidates a per-lb item and keeps the line invariant', () => {
    const ctx = ctxWith([CHICKEN_DEAL]);
    ctx.recipes = [
      recipe([{ ingredientId: 'chicken_breast', quantity: 0.6, unit: 'kg' }]),
      { ...recipe([{ ingredientId: 'chicken_breast', quantity: 0.6, unit: 'kg' }]), id: 'rtest2' },
    ];
    const plan: MealPlan = {
      id: 'p',
      weekOf: '2026-07-20',
      totals: { estimated: 0, regular: 0, savings: 0, savingsPct: 0 },
      meals: [
        { day: 0, recipeId: 'rtest', servings: 4, estimatedCost: 0, regularCost: 0, saleIngredientIds: [] },
        { day: 1, recipeId: 'rtest2', servings: 4, estimatedCost: 0, regularCost: 0, saleIngredientIds: [] },
      ],
    };

    const list = buildShoppingList(plan, ctx);
    const lines = list.storeGroups.flatMap((g) => g.items).filter((i) => i.ingredientId === 'chicken_breast');
    expect(lines).toHaveLength(1);
    const line = lines[0];
    expect(line.unit).toBe('lb');
    expect(line.onSale).toBe(true);
    expect(line.unitPrice).toBe(8.99);
    // 1.2 kg total → ~2.65 lb (round2, no snapping).
    expect(line.quantity).toBeCloseTo(convertQty(1.2, 'kg', 'lb'), 2);
    // line invariant: lineTotal === round2(quantity × unitPrice)
    expect(line.lineTotal).toBe(round2(line.quantity * line.unitPrice));
    expect(line.mealIds.sort()).toEqual(['rtest', 'rtest2']);
  });
});

/* ------------------------------- formatting ------------------------------ */

describe('formatMoney', () => {
  it('formats CAD to two decimals with a $ sign', () => {
    expect(formatMoney(8.99)).toBe('$8.99');
    expect(formatMoney(19.82)).toBe('$19.82');
    expect(formatMoney(0)).toBe('$0.00');
    expect(formatMoney(2)).toBe('$2.00');
  });
});

describe('formatDualMassPrice', () => {
  it('renders "$8.99/lb · $19.82/kg" from a per-lb price', () => {
    expect(formatDualMassPrice(8.99, 'lb')).toBe('$8.99/lb · $19.82/kg');
  });

  it('renders both units from a per-kg price too', () => {
    expect(formatDualMassPrice(19.82, 'kg')).toBe('$8.99/lb · $19.82/kg');
  });
});

describe('formatUnitPrice / formatQty helpers', () => {
  it('keeps per-100 g for grams and adds mass suffixes', () => {
    expect(formatUnitPrice(0.033, 'g')).toBe('$3.30/100 g');
    expect(formatUnitPrice(8.99, 'lb')).toBe('$8.99/lb');
    expect(formatUnitPrice(24.23, 'kg')).toBe('$24.23/kg');
    expect(formatUnitPrice(1.49, 'can')).toBe('$1.49');
  });

  it('formats quantities: integers bare, fractions to 2dp', () => {
    expect(formatQty(3, 'can')).toBe('3 can');
    expect(formatQty(2.5, 'lb')).toBe('2.50 lb');
  });
});

/* ------------------------------- flyer urls ------------------------------ */

describe('CHAIN_FLYER_URLS', () => {
  it('covers all seven chains with https flyer links', () => {
    for (const chain of CHAIN_CATALOG) {
      const url = CHAIN_FLYER_URLS[chain];
      expect(url).toBeDefined();
      expect(url.startsWith('https://')).toBe(true);
    }
    expect(Object.keys(CHAIN_FLYER_URLS)).toHaveLength(7);
  });
});
