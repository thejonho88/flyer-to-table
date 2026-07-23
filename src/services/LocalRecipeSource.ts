import type { Recipe, RecipeQuery, RecipeSource } from '@/domain/types';
import { RECIPES, getRecipe } from '@/data/recipes';
import { recipeSatisfiesRestrictions, recipeWithinCookTime } from '@/domain/filters';

/**
 * Recipe source backed by the local seeded set. Applies dietary + cook-time
 * hard filters at query time so callers never see recipes that violate the
 * user's constraints. Swappable for a remote/DB source later.
 */
export class LocalRecipeSource implements RecipeSource {
  private readonly recipes: Recipe[];

  constructor(recipes: Recipe[] = RECIPES) {
    this.recipes = recipes;
  }

  async list(q: RecipeQuery): Promise<Recipe[]> {
    const exclude = new Set(q.excludeRecipeIds ?? []);
    return this.recipes.filter(
      (r) =>
        !exclude.has(r.id) &&
        recipeSatisfiesRestrictions(r, q.dietaryRestrictions) &&
        recipeWithinCookTime(r, q.maxCookTimeMinutes ?? null),
    );
  }

  async get(id: string): Promise<Recipe | null> {
    return getRecipe(id) ?? null;
  }
}

export const recipeSource: RecipeSource = new LocalRecipeSource();
