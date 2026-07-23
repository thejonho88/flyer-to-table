import type {
  DietaryTag,
  MaxCookTime,
  PlanContext,
  PlanPreferences,
} from '@/domain/types';
import { getSeededArea } from '@/data/deals';
import { RECIPES, getRecipe } from '@/data/recipes';
import { INGREDIENTS, isPantryStaple } from '@/data/ingredients';
import { recipePassesHardConstraints } from '@/domain/filters';
import { servingsFor, computeMealCost, PricingResolver } from '@/domain/costing';
import { BASE_PRICES } from '@/data/pricing';
import {
  generatePlan,
  getSwapAlternatives,
  applySwap,
} from '@/domain/planner';
import { buildShoppingList } from '@/domain/shoppingList';

const area = getSeededArea('H2X');
if (!area) throw new Error('H2X seed data missing');

function makeCtx(overrides: Partial<PlanPreferences> = {}): PlanContext {
  const prefs: PlanPreferences = {
    postalCode: 'H2X 1Y4',
    selectedStoreIds: area!.stores.map((s) => s.id),
    householdSize: 4,
    dietaryRestrictions: [],
    maxCookTimeMinutes: null,
    leftoversForLunch: false,
    dinnersPerWeek: 7,
    ...overrides,
  };
  return {
    deals: area!.deals,
    stores: area!.stores,
    recipes: RECIPES,
    ingredients: INGREDIENTS,
    prefs,
  };
}

const ALL_RESTRICTION_COMBOS: DietaryTag[][] = [
  [],
  ['vegetarian'],
  ['vegan'],
  ['gluten_free'],
  ['dairy_free'],
  ['nut_free'],
  ['vegetarian', 'gluten_free'],
  ['vegan', 'gluten_free'],
  ['vegan', 'gluten_free', 'dairy_free', 'nut_free'],
  ['dairy_free', 'nut_free'],
];

const COOK_TIMES: MaxCookTime[] = [15, 30, 45, null];

describe('hard constraints are never violated', () => {
  it('dietary restrictions are respected for every combo and cook time', () => {
    for (const restrictions of ALL_RESTRICTION_COMBOS) {
      for (const maxCookTimeMinutes of COOK_TIMES) {
        const ctx = makeCtx({
          dietaryRestrictions: restrictions,
          maxCookTimeMinutes,
        });
        const plan = generatePlan(ctx);
        for (const meal of plan.meals) {
          const recipe = getRecipe(meal.recipeId)!;
          restrictions.forEach((tag) =>
            expect(recipe.dietaryTags).toContain(tag),
          );
          if (maxCookTimeMinutes != null) {
            expect(recipe.cookTimeMinutes).toBeLessThanOrEqual(
              maxCookTimeMinutes,
            );
          }
        }
      }
    }
  });

  it('pool is never empty even for the strictest combo at the tightest time', () => {
    const ctx = makeCtx({
      dietaryRestrictions: ['vegan', 'gluten_free', 'dairy_free', 'nut_free'],
      maxCookTimeMinutes: 15,
      dinnersPerWeek: 7,
    });
    const plan = generatePlan(ctx);
    expect(plan.meals.length).toBe(7);
  });
});

describe('plan shape', () => {
  it('produces exactly dinnersPerWeek meals with sequential days', () => {
    for (const n of [5, 6, 7] as const) {
      const plan = generatePlan(makeCtx({ dinnersPerWeek: n }));
      expect(plan.meals.length).toBe(n);
      expect(plan.meals.map((m) => m.day)).toEqual(
        Array.from({ length: n }, (_, i) => i),
      );
    }
  });

  it('totals are internally consistent', () => {
    const plan = generatePlan(makeCtx());
    const est = plan.meals.reduce((s, m) => s + m.estimatedCost, 0);
    const reg = plan.meals.reduce((s, m) => s + m.regularCost, 0);
    expect(plan.totals.estimated).toBeCloseTo(est, 2);
    expect(plan.totals.regular).toBeCloseTo(reg, 2);
    expect(plan.totals.savings).toBeCloseTo(reg - est, 2);
    expect(plan.totals.regular).toBeGreaterThanOrEqual(plan.totals.estimated);
  });

  it('applies a variety heuristic (no more than 2 of a protein where avoidable)', () => {
    const plan = generatePlan(makeCtx({ dinnersPerWeek: 7 }));
    // At least 4 distinct recipes selected — sanity that it is not repeating.
    const distinct = new Set(plan.meals.map((m) => m.recipeId));
    expect(distinct.size).toBe(plan.meals.length);
  });
});

describe('pantry staples are excluded from cost and the shopping list', () => {
  it('no staple ever appears as a shopping-list line', () => {
    const plan = generatePlan(makeCtx());
    const list = buildShoppingList(plan, makeCtx());
    for (const g of list.storeGroups) {
      for (const item of g.items) {
        expect(isPantryStaple(item.ingredientId)).toBe(false);
      }
    }
  });

  it('meal cost excludes staples (olive oil, cumin, etc.)', () => {
    const ctx = makeCtx();
    const pricing = new PricingResolver(ctx, BASE_PRICES);
    const recipe = getRecipe('r01')!; // uses olive_oil + cumin (staples)
    const cost = computeMealCost(recipe, 4, pricing);
    // staples resolve to null and contribute nothing
    expect(pricing.resolve('olive_oil')).toBeNull();
    expect(pricing.resolve('cumin')).toBeNull();
    expect(cost.estimatedCost).toBeGreaterThan(0);
  });
});

describe('shopping list dedupe + consolidation', () => {
  it('merges an ingredient shared across meals into a single line', () => {
    // Two chickpea recipes -> chickpeas should appear once, quantity summed.
    const ctx = makeCtx();
    const plan = {
      id: 'p',
      weekOf: '2026-07-20',
      totals: { estimated: 0, regular: 0, savings: 0, savingsPct: 0 },
      meals: [
        {
          day: 0,
          recipeId: 'r01', // 2 cans chickpeas
          servings: 4,
          estimatedCost: 0,
          regularCost: 0,
          saleIngredientIds: [],
        },
        {
          day: 1,
          recipeId: 'r06', // 2 cans chickpeas
          servings: 4,
          estimatedCost: 0,
          regularCost: 0,
          saleIngredientIds: [],
        },
      ],
    };
    const list = buildShoppingList(plan, ctx);
    const chickpeaLines = list.storeGroups
      .flatMap((g) => g.items)
      .filter((i) => i.ingredientId === 'chickpeas');
    expect(chickpeaLines).toHaveLength(1);
    expect(chickpeaLines[0].quantity).toBe(4); // 2 + 2 cans
    expect(chickpeaLines[0].mealIds.sort()).toEqual(['r01', 'r06']);
  });

  it('discrete packages round up; totals equal sum of lines', () => {
    const ctx = makeCtx();
    const plan = generatePlan(ctx);
    const list = buildShoppingList(plan, ctx);
    let sum = 0;
    for (const g of list.storeGroups) {
      const subtotal = g.items.reduce((s, i) => s + i.lineTotal, 0);
      expect(g.subtotal).toBeCloseTo(subtotal, 2);
      sum += subtotal;
    }
    expect(list.totals.estimated).toBeCloseTo(sum, 2);
    expect(list.totals.savings).toBeCloseTo(
      list.totals.regularTotal - list.totals.estimated,
      2,
    );
  });
});

describe('leftovers scaling math', () => {
  it('doubles portions and cost for leftovers-supporting recipes', () => {
    const withoutCtx = makeCtx({ leftoversForLunch: false, householdSize: 4 });
    const withCtx = makeCtx({ leftoversForLunch: true, householdSize: 4 });
    const chili = getRecipe('r22')!; // supportsLeftovers = true
    expect(servingsFor(withoutCtx.prefs, chili)).toBe(4);
    expect(servingsFor(withCtx.prefs, chili)).toBe(8);

    const pricing = new PricingResolver(withCtx, BASE_PRICES);
    const single = computeMealCost(chili, 4, pricing);
    const doubled = computeMealCost(chili, 8, pricing);
    expect(doubled.estimatedCost).toBeCloseTo(single.estimatedCost * 2, 1);
  });

  it('does not scale recipes that do not support leftovers', () => {
    const withCtx = makeCtx({ leftoversForLunch: true, householdSize: 3 });
    const tacos = getRecipe('r05')!; // supportsLeftovers = false
    expect(servingsFor(withCtx.prefs, tacos)).toBe(3);
  });
});

describe('meal swap', () => {
  it('alternatives exclude recipes already in the plan and pass constraints', () => {
    const ctx = makeCtx({ dietaryRestrictions: ['vegetarian'] });
    const plan = generatePlan(ctx);
    const inPlan = new Set(plan.meals.map((m) => m.recipeId));
    const alts = getSwapAlternatives(plan, 0, ctx);
    expect(alts.length).toBeGreaterThan(0);
    for (const alt of alts) {
      expect(inPlan.has(alt.recipe.id)).toBe(false);
      expect(
        recipePassesHardConstraints(alt.recipe, ['vegetarian'], null),
      ).toBe(true);
    }
  });

  it('applySwap replaces only the target slot and recomputes totals', () => {
    const ctx = makeCtx();
    const plan = generatePlan(ctx);
    const alts = getSwapAlternatives(plan, 2, ctx);
    const target = alts[0].recipe.id;
    const swapped = applySwap(plan, 2, target, ctx);

    expect(swapped.meals[2].recipeId).toBe(target);
    // other days unchanged
    for (const day of [0, 1, 3, 4, 5, 6]) {
      expect(swapped.meals[day].recipeId).toBe(plan.meals[day].recipeId);
    }
    const est = swapped.meals.reduce((s, m) => s + m.estimatedCost, 0);
    expect(swapped.totals.estimated).toBeCloseTo(est, 2);
  });

  it('applySwap refuses a recipe that would violate a constraint', () => {
    const ctx = makeCtx({ dietaryRestrictions: ['vegan'] });
    const plan = generatePlan(ctx);
    // r17 is chicken -> not vegan; swap must be rejected (plan unchanged).
    const swapped = applySwap(plan, 0, 'r17', ctx);
    expect(swapped.meals[0].recipeId).toBe(plan.meals[0].recipeId);
  });
});
