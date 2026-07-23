/**
 * Base (regular) price per canonical unit for every non-staple ingredient.
 * Recipes express quantities in the ingredient's canonical unit, so cost math
 * is a straight `quantity * unitPrice` with no unit conversion.
 *
 * Deals (see deals.ts) provide sale prices that override these for on-sale
 * items; this table is the fallback regular price for everything else.
 * Prices are CAD. Staples are intentionally absent (excluded from cost).
 */
export interface BasePrice {
  unitPrice: number;
  unit: string;
}

export const BASE_PRICES: Record<string, BasePrice> = {
  // Produce
  onion: { unitPrice: 0.6, unit: 'unit' },
  garlic: { unitPrice: 0.15, unit: 'clove' },
  carrot: { unitPrice: 0.3, unit: 'unit' },
  bell_pepper: { unitPrice: 1.2, unit: 'unit' },
  broccoli: { unitPrice: 2.49, unit: 'bunch' },
  spinach: { unitPrice: 3.49, unit: 'container' },
  tomato: { unitPrice: 0.8, unit: 'unit' },
  sweet_potato: { unitPrice: 2.99, unit: 'kg' },
  potato: { unitPrice: 1.99, unit: 'kg' },
  mushroom: { unitPrice: 2.99, unit: 'pack' },
  zucchini: { unitPrice: 1.0, unit: 'unit' },
  lemon: { unitPrice: 0.79, unit: 'unit' },
  lime: { unitPrice: 0.69, unit: 'unit' },
  cilantro: { unitPrice: 1.29, unit: 'bunch' },
  green_onion: { unitPrice: 1.29, unit: 'bunch' },
  ginger: { unitPrice: 0.99, unit: 'unit' },
  avocado: { unitPrice: 1.49, unit: 'unit' },
  cabbage: { unitPrice: 2.49, unit: 'unit' },
  kale: { unitPrice: 2.79, unit: 'bunch' },
  corn: { unitPrice: 0.99, unit: 'unit' },

  // Meat & seafood
  chicken_thigh: { unitPrice: 9.9, unit: 'kg' },
  chicken_breast: { unitPrice: 13.2, unit: 'kg' },
  ground_beef: { unitPrice: 11.0, unit: 'kg' },
  beef_strips: { unitPrice: 17.6, unit: 'kg' },
  pork_shoulder: { unitPrice: 8.8, unit: 'kg' },
  ground_pork: { unitPrice: 9.9, unit: 'kg' },
  salmon: { unitPrice: 0.033, unit: 'g' },
  tilapia: { unitPrice: 0.022, unit: 'g' },
  shrimp: { unitPrice: 0.03, unit: 'g' },

  // Dairy & eggs
  eggs: { unitPrice: 4.99, unit: 'dozen' },
  butter: { unitPrice: 5.49, unit: 'block' },
  milk: { unitPrice: 2.99, unit: 'L' },
  cheddar: { unitPrice: 6.49, unit: 'block' },
  parmesan: { unitPrice: 6.99, unit: 'wedge' },
  greek_yogurt: { unitPrice: 4.29, unit: 'tub' },
  cream: { unitPrice: 3.29, unit: 'carton' },
  feta: { unitPrice: 4.49, unit: 'pack' },

  // Grains, pasta & bread
  rice: { unitPrice: 5.49, unit: 'bag' },
  pasta: { unitPrice: 2.49, unit: 'box' },
  penne_ww: { unitPrice: 2.79, unit: 'box' },
  rice_gf: { unitPrice: 5.99, unit: 'bag' },
  quinoa: { unitPrice: 6.99, unit: 'bag' },
  tortilla: { unitPrice: 3.49, unit: 'pack' },
  burger_buns: { unitPrice: 3.29, unit: 'pack' },
  arborio_rice: { unitPrice: 5.99, unit: 'bag' },
  couscous: { unitPrice: 3.49, unit: 'box' },

  // Legumes & canned
  black_beans: { unitPrice: 1.49, unit: 'can' },
  chickpeas: { unitPrice: 1.49, unit: 'can' },
  lentils: { unitPrice: 3.29, unit: 'bag' },
  canned_tomatoes: { unitPrice: 1.79, unit: 'can' },
  tomato_sauce: { unitPrice: 2.99, unit: 'jar' },
  coconut_milk: { unitPrice: 2.29, unit: 'can' },
  kidney_beans: { unitPrice: 1.49, unit: 'can' },
  tofu: { unitPrice: 3.49, unit: 'pack' },
  peanut_butter: { unitPrice: 4.99, unit: 'jar' },
  bbq_sauce: { unitPrice: 3.99, unit: 'bottle' },
};

export function getBasePrice(ingredientId: string): BasePrice | undefined {
  return BASE_PRICES[ingredientId];
}
