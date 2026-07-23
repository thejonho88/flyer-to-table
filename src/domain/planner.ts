import type {
  MealPlan,
  MealPlanTotals,
  PlanContext,
  PlannedMeal,
  Recipe,
  SwapAlternative,
} from './types';
import { BASE_PRICES } from '@/data/pricing';
import { formatMoney } from './money';
import { recipePassesHardConstraints } from './filters';
import {
  MealCost,
  PricingResolver,
  computeMealCost,
  proteinGroup,
  round2,
  servingsFor,
} from './costing';

/* ------------------------------------------------------------------ */
/* Scoring                                                            */
/* ------------------------------------------------------------------ */

interface ScoredRecipe {
  recipe: Recipe;
  servings: number;
  cost: MealCost;
  score: number;
  saleCount: number;
}

const SALE_FRACTION_WEIGHT = 3;

function scoreRecipe(
  recipe: Recipe,
  pricing: PricingResolver,
  ctx: PlanContext,
): ScoredRecipe {
  const servings = servingsFor(ctx.prefs, recipe);
  const cost = computeMealCost(recipe, servings, pricing);
  const pricedCount = recipe.ingredients.filter(
    (ri) => pricing.resolve(ri.ingredientId) !== null,
  ).length;
  const saleCount = cost.saleIngredientIds.length;
  const savings = cost.regularCost - cost.estimatedCost;
  const saleFraction = pricedCount > 0 ? saleCount / pricedCount : 0;
  const score = savings + saleFraction * SALE_FRACTION_WEIGHT;
  return { recipe, servings, cost, score, saleCount };
}

function byScore(a: ScoredRecipe, b: ScoredRecipe): number {
  if (b.score !== a.score) return b.score - a.score;
  if (b.saleCount !== a.saleCount) return b.saleCount - a.saleCount;
  if (a.cost.estimatedCost !== b.cost.estimatedCost)
    return a.cost.estimatedCost - b.cost.estimatedCost;
  return a.recipe.id.localeCompare(b.recipe.id); // deterministic tiebreak
}

/* ------------------------------------------------------------------ */
/* Variety selection                                                 */
/* ------------------------------------------------------------------ */

/**
 * Greedy selection that spreads protein groups: starts with a cap of 2 per
 * group and relaxes it only if needed to reach the requested count. Never
 * fails — if the eligible pool is smaller than the target, it returns the
 * whole pool.
 */
function selectWithVariety(scored: ScoredRecipe[], target: number): ScoredRecipe[] {
  const chosen: ScoredRecipe[] = [];
  const chosenIds = new Set<string>();
  const groupCounts: Record<string, number> = {};

  for (let cap = 2; cap <= target && chosen.length < target; cap++) {
    for (const s of scored) {
      if (chosen.length >= target) break;
      if (chosenIds.has(s.recipe.id)) continue;
      const g = proteinGroup(s.recipe);
      if ((groupCounts[g] ?? 0) >= cap) continue;
      chosen.push(s);
      chosenIds.add(s.recipe.id);
      groupCounts[g] = (groupCounts[g] ?? 0) + 1;
    }
  }
  return chosen;
}

/* ------------------------------------------------------------------ */
/* Totals                                                             */
/* ------------------------------------------------------------------ */

export function computeTotals(meals: PlannedMeal[]): MealPlanTotals {
  const estimated = round2(meals.reduce((s, m) => s + m.estimatedCost, 0));
  const regular = round2(meals.reduce((s, m) => s + m.regularCost, 0));
  const savings = round2(regular - estimated);
  const savingsPct = regular > 0 ? Math.round((savings / regular) * 100) : 0;
  return { estimated, regular, savings, savingsPct };
}

function toPlannedMeal(day: number, s: ScoredRecipe): PlannedMeal {
  return {
    day,
    recipeId: s.recipe.id,
    servings: s.servings,
    estimatedCost: s.cost.estimatedCost,
    regularCost: s.cost.regularCost,
    saleIngredientIds: s.cost.saleIngredientIds,
  };
}

function mondayOf(d: Date): string {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const m = new Date(d);
  m.setDate(d.getDate() + diff);
  return m.toISOString().slice(0, 10);
}

/* ------------------------------------------------------------------ */
/* Public API                                                        */
/* ------------------------------------------------------------------ */

/**
 * Generates a weekly dinner plan weighted toward sale ingredients. Applies the
 * hard dietary + max-cook-time filters (never violated), scales portions for
 * leftovers, and picks 5–7 dinners with a protein-variety heuristic.
 */
export function generatePlan(ctx: PlanContext): MealPlan {
  const pricing = new PricingResolver(ctx, BASE_PRICES);
  const { prefs } = ctx;

  // Hard filter — defensively re-applied here so the invariant holds no matter
  // how ctx.recipes was assembled.
  const eligible = ctx.recipes.filter((r) =>
    recipePassesHardConstraints(
      r,
      prefs.dietaryRestrictions,
      prefs.maxCookTimeMinutes,
    ),
  );

  const scored = eligible.map((r) => scoreRecipe(r, pricing, ctx)).sort(byScore);
  const selected = selectWithVariety(scored, prefs.dinnersPerWeek);

  const meals = selected.map((s, i) => toPlannedMeal(i, s));

  return {
    id: `plan_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    weekOf: mondayOf(new Date()),
    meals,
    totals: computeTotals(meals),
  };
}

/**
 * Ranked alternatives for a single slot, excluding recipes already in the
 * plan. Each carries a plain-language rationale referencing the sale items.
 */
export function getSwapAlternatives(
  plan: MealPlan,
  day: number,
  ctx: PlanContext,
): SwapAlternative[] {
  const pricing = new PricingResolver(ctx, BASE_PRICES);
  const { prefs } = ctx;
  const inPlan = new Set(plan.meals.map((m) => m.recipeId));

  const eligible = ctx.recipes.filter(
    (r) =>
      !inPlan.has(r.id) &&
      recipePassesHardConstraints(
        r,
        prefs.dietaryRestrictions,
        prefs.maxCookTimeMinutes,
      ),
  );

  return eligible
    .map((r) => scoreRecipe(r, pricing, ctx))
    .sort(byScore)
    .slice(0, 6)
    .map((s) => ({
      recipe: s.recipe,
      estimatedCost: s.cost.estimatedCost,
      savings: round2(s.cost.regularCost - s.cost.estimatedCost),
      rationale: buildRationale(s, ctx),
    }));
}

/**
 * Replaces the meal on `day` with `recipeId` and recomputes totals. Other
 * slots are untouched. If the target recipe would violate a hard constraint,
 * the plan is returned unchanged (invariant preserved).
 */
export function applySwap(
  plan: MealPlan,
  day: number,
  recipeId: string,
  ctx: PlanContext,
): MealPlan {
  const recipe = ctx.recipes.find((r) => r.id === recipeId);
  if (
    !recipe ||
    !recipePassesHardConstraints(
      recipe,
      ctx.prefs.dietaryRestrictions,
      ctx.prefs.maxCookTimeMinutes,
    )
  ) {
    return plan;
  }

  const pricing = new PricingResolver(ctx, BASE_PRICES);
  const scored = scoreRecipe(recipe, pricing, ctx);
  const meals = plan.meals.map((m) =>
    m.day === day ? toPlannedMeal(day, scored) : m,
  );

  return { ...plan, meals, totals: computeTotals(meals) };
}

function buildRationale(s: ScoredRecipe, ctx: PlanContext): string {
  const savings = round2(s.cost.regularCost - s.cost.estimatedCost);
  if (s.cost.saleIngredientIds.length === 0) {
    return `Budget-friendly at ${formatMoney(s.cost.estimatedCost)} — no sale items needed.`;
  }
  const labelById = new Map(ctx.ingredients.map((i) => [i.id, i.name]));
  const names = s.cost.saleIngredientIds
    .map((id) => labelById.get(id) ?? id)
    .slice(0, 3);
  const list =
    names.length === 1
      ? names[0]
      : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  const savingsText = savings > 0 ? ` — save ${formatMoney(savings)} vs. regular` : '';
  return `${list} on sale this week${savingsText}.`;
}
