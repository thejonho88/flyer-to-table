import type { DietaryTag, Recipe } from './types';

/**
 * Hard-constraint predicates. These are the single definition of "does a
 * recipe satisfy the user's non-negotiable constraints" and are used by both
 * the recipe source and the planner. If these are correct, dietary
 * restrictions and max cook time can never be violated downstream.
 */

/** A recipe satisfies a restriction only if it carries the matching tag. */
export function recipeSatisfiesRestrictions(
  recipe: Recipe,
  restrictions: DietaryTag[],
): boolean {
  return restrictions.every((tag) => recipe.dietaryTags.includes(tag));
}

/** null max = "60+" = no cap. Otherwise cook time must be <= the cap. */
export function recipeWithinCookTime(
  recipe: Recipe,
  maxCookTimeMinutes: number | null | undefined,
): boolean {
  if (maxCookTimeMinutes == null) return true;
  return recipe.cookTimeMinutes <= maxCookTimeMinutes;
}

/** Combined hard filter. */
export function recipePassesHardConstraints(
  recipe: Recipe,
  restrictions: DietaryTag[],
  maxCookTimeMinutes: number | null | undefined,
): boolean {
  return (
    recipeSatisfiesRestrictions(recipe, restrictions) &&
    recipeWithinCookTime(recipe, maxCookTimeMinutes)
  );
}
