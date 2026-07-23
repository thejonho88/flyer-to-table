import type { Ingredient } from '@/domain/types';

/**
 * Canonical ingredient catalog. Every recipe ingredient ref and every deal
 * keys into an `id` here. Pantry staples (isPantryStaple: true) are excluded
 * from shopping lists and cost estimates by default (non-negotiable rule).
 */
export const INGREDIENTS: Ingredient[] = [
  // --- Pantry staples (assumed on hand) ---
  { id: 'salt', name: 'Salt', nameFr: 'Sel', category: 'staple', isPantryStaple: true, defaultUnit: 'tsp' },
  { id: 'black_pepper', name: 'Black Pepper', nameFr: 'Poivre noir', category: 'staple', isPantryStaple: true, defaultUnit: 'tsp' },
  { id: 'olive_oil', name: 'Olive Oil', nameFr: "Huile d'olive", category: 'staple', isPantryStaple: true, defaultUnit: 'tbsp' },
  { id: 'vegetable_oil', name: 'Vegetable Oil', nameFr: 'Huile végétale', category: 'staple', isPantryStaple: true, defaultUnit: 'tbsp' },
  { id: 'cumin', name: 'Ground Cumin', nameFr: 'Cumin moulu', category: 'staple', isPantryStaple: true, defaultUnit: 'tsp' },
  { id: 'paprika', name: 'Paprika', nameFr: 'Paprika', category: 'staple', isPantryStaple: true, defaultUnit: 'tsp' },
  { id: 'oregano', name: 'Dried Oregano', nameFr: 'Origan séché', category: 'staple', isPantryStaple: true, defaultUnit: 'tsp' },
  { id: 'chili_flakes', name: 'Chili Flakes', nameFr: 'Flocons de piment', category: 'staple', isPantryStaple: true, defaultUnit: 'tsp' },
  { id: 'garlic_powder', name: 'Garlic Powder', nameFr: "Poudre d'ail", category: 'staple', isPantryStaple: true, defaultUnit: 'tsp' },
  { id: 'cinnamon', name: 'Cinnamon', nameFr: 'Cannelle', category: 'staple', isPantryStaple: true, defaultUnit: 'tsp' },
  { id: 'flour', name: 'All-Purpose Flour', nameFr: 'Farine tout usage', category: 'staple', isPantryStaple: true, defaultUnit: 'cup' },
  { id: 'sugar', name: 'Sugar', nameFr: 'Sucre', category: 'staple', isPantryStaple: true, defaultUnit: 'tbsp' },
  { id: 'soy_sauce', name: 'Soy Sauce', nameFr: 'Sauce soya', category: 'staple', isPantryStaple: true, defaultUnit: 'tbsp' },
  { id: 'vinegar', name: 'Vinegar', nameFr: 'Vinaigre', category: 'staple', isPantryStaple: true, defaultUnit: 'tbsp' },

  // --- Produce ---
  { id: 'onion', name: 'Yellow Onion', nameFr: 'Oignon jaune', category: 'produce', isPantryStaple: false, defaultUnit: 'unit' },
  { id: 'garlic', name: 'Garlic', nameFr: 'Ail', category: 'produce', isPantryStaple: false, defaultUnit: 'clove' },
  { id: 'carrot', name: 'Carrots', nameFr: 'Carottes', category: 'produce', isPantryStaple: false, defaultUnit: 'unit' },
  { id: 'bell_pepper', name: 'Bell Peppers', nameFr: 'Poivrons', category: 'produce', isPantryStaple: false, defaultUnit: 'unit' },
  { id: 'broccoli', name: 'Broccoli', nameFr: 'Brocoli', category: 'produce', isPantryStaple: false, defaultUnit: 'bunch' },
  { id: 'spinach', name: 'Baby Spinach', nameFr: 'Bébés épinards', category: 'produce', isPantryStaple: false, defaultUnit: 'container' },
  { id: 'tomato', name: 'Tomatoes', nameFr: 'Tomates', category: 'produce', isPantryStaple: false, defaultUnit: 'unit' },
  { id: 'sweet_potato', name: 'Sweet Potatoes', nameFr: 'Patates douces', category: 'produce', isPantryStaple: false, defaultUnit: 'kg' },
  { id: 'potato', name: 'Potatoes', nameFr: 'Pommes de terre', category: 'produce', isPantryStaple: false, defaultUnit: 'kg' },
  { id: 'mushroom', name: 'Mushrooms', nameFr: 'Champignons', category: 'produce', isPantryStaple: false, defaultUnit: 'pack' },
  { id: 'zucchini', name: 'Zucchini', nameFr: 'Courgettes', category: 'produce', isPantryStaple: false, defaultUnit: 'unit' },
  { id: 'lemon', name: 'Lemons', nameFr: 'Citrons', category: 'produce', isPantryStaple: false, defaultUnit: 'unit' },
  { id: 'lime', name: 'Limes', nameFr: 'Limes', category: 'produce', isPantryStaple: false, defaultUnit: 'unit' },
  { id: 'cilantro', name: 'Cilantro', nameFr: 'Coriandre', category: 'produce', isPantryStaple: false, defaultUnit: 'bunch' },
  { id: 'green_onion', name: 'Green Onions', nameFr: 'Oignons verts', category: 'produce', isPantryStaple: false, defaultUnit: 'bunch' },
  { id: 'ginger', name: 'Ginger', nameFr: 'Gingembre', category: 'produce', isPantryStaple: false, defaultUnit: 'unit' },
  { id: 'avocado', name: 'Avocados', nameFr: 'Avocats', category: 'produce', isPantryStaple: false, defaultUnit: 'unit' },
  { id: 'cabbage', name: 'Cabbage', nameFr: 'Chou', category: 'produce', isPantryStaple: false, defaultUnit: 'unit' },
  { id: 'kale', name: 'Kale', nameFr: 'Chou frisé', category: 'produce', isPantryStaple: false, defaultUnit: 'bunch' },
  { id: 'corn', name: 'Corn', nameFr: 'Maïs', category: 'produce', isPantryStaple: false, defaultUnit: 'unit' },

  // --- Meat & seafood ---
  { id: 'chicken_thigh', name: 'Chicken Thighs', nameFr: 'Cuisses de poulet', category: 'meat', isPantryStaple: false, defaultUnit: 'kg' },
  { id: 'chicken_breast', name: 'Chicken Breast', nameFr: 'Poitrine de poulet', category: 'meat', isPantryStaple: false, defaultUnit: 'kg' },
  { id: 'ground_beef', name: 'Ground Beef', nameFr: 'Bœuf haché', category: 'meat', isPantryStaple: false, defaultUnit: 'kg' },
  { id: 'beef_strips', name: 'Beef Strips', nameFr: 'Lanières de bœuf', category: 'meat', isPantryStaple: false, defaultUnit: 'kg' },
  { id: 'pork_shoulder', name: 'Pork Shoulder', nameFr: 'Épaule de porc', category: 'meat', isPantryStaple: false, defaultUnit: 'kg' },
  { id: 'ground_pork', name: 'Ground Pork', nameFr: 'Porc haché', category: 'meat', isPantryStaple: false, defaultUnit: 'kg' },
  { id: 'salmon', name: 'Atlantic Salmon Fillets', nameFr: 'Filets de saumon', category: 'seafood', isPantryStaple: false, defaultUnit: 'g' },
  { id: 'tilapia', name: 'Tilapia Fillets', nameFr: 'Filets de tilapia', category: 'seafood', isPantryStaple: false, defaultUnit: 'g' },
  { id: 'shrimp', name: 'Shrimp', nameFr: 'Crevettes', category: 'seafood', isPantryStaple: false, defaultUnit: 'g' },

  // --- Dairy & eggs ---
  { id: 'eggs', name: 'Eggs', nameFr: 'Œufs', category: 'dairy', isPantryStaple: false, defaultUnit: 'dozen' },
  { id: 'butter', name: 'Butter', nameFr: 'Beurre', category: 'dairy', isPantryStaple: false, defaultUnit: 'block' },
  { id: 'milk', name: 'Milk', nameFr: 'Lait', category: 'dairy', isPantryStaple: false, defaultUnit: 'L' },
  { id: 'cheddar', name: 'Cheddar Cheese', nameFr: 'Cheddar', category: 'dairy', isPantryStaple: false, defaultUnit: 'block' },
  { id: 'parmesan', name: 'Parmesan', nameFr: 'Parmesan', category: 'dairy', isPantryStaple: false, defaultUnit: 'wedge' },
  { id: 'greek_yogurt', name: 'Greek Yogurt', nameFr: 'Yogourt grec', category: 'dairy', isPantryStaple: false, defaultUnit: 'tub' },
  { id: 'cream', name: 'Cooking Cream', nameFr: 'Crème à cuisson', category: 'dairy', isPantryStaple: false, defaultUnit: 'carton' },
  { id: 'feta', name: 'Feta Cheese', nameFr: 'Feta', category: 'dairy', isPantryStaple: false, defaultUnit: 'pack' },

  // --- Grains, pasta & bread ---
  { id: 'rice', name: 'Jasmine Rice', nameFr: 'Riz jasmin', category: 'grain', isPantryStaple: false, defaultUnit: 'bag' },
  { id: 'pasta', name: 'Pasta', nameFr: 'Pâtes', category: 'grain', isPantryStaple: false, defaultUnit: 'box' },
  { id: 'penne_ww', name: 'Whole Wheat Penne', nameFr: 'Penne de blé entier', category: 'grain', isPantryStaple: false, defaultUnit: 'box' },
  { id: 'rice_gf', name: 'Brown Rice', nameFr: 'Riz brun', category: 'grain', isPantryStaple: false, defaultUnit: 'bag' },
  { id: 'quinoa', name: 'Quinoa', nameFr: 'Quinoa', category: 'grain', isPantryStaple: false, defaultUnit: 'bag' },
  { id: 'tortilla', name: 'Corn Tortillas', nameFr: 'Tortillas de maïs', category: 'grain', isPantryStaple: false, defaultUnit: 'pack' },
  { id: 'burger_buns', name: 'Burger Buns', nameFr: 'Pains à burger', category: 'grain', isPantryStaple: false, defaultUnit: 'pack' },
  { id: 'arborio_rice', name: 'Arborio Rice', nameFr: 'Riz arborio', category: 'grain', isPantryStaple: false, defaultUnit: 'bag' },
  { id: 'couscous', name: 'Couscous', nameFr: 'Couscous', category: 'grain', isPantryStaple: false, defaultUnit: 'box' },

  // --- Legumes & canned ---
  { id: 'black_beans', name: 'Black Beans', nameFr: 'Haricots noirs', category: 'canned', isPantryStaple: false, defaultUnit: 'can' },
  { id: 'chickpeas', name: 'Chickpeas', nameFr: 'Pois chiches', category: 'canned', isPantryStaple: false, defaultUnit: 'can' },
  { id: 'lentils', name: 'Lentils', nameFr: 'Lentilles', category: 'canned', isPantryStaple: false, defaultUnit: 'bag' },
  { id: 'canned_tomatoes', name: 'Diced Tomatoes', nameFr: 'Tomates en dés', category: 'canned', isPantryStaple: false, defaultUnit: 'can' },
  { id: 'tomato_sauce', name: 'Tomato Sauce', nameFr: 'Sauce tomate', category: 'canned', isPantryStaple: false, defaultUnit: 'jar' },
  { id: 'coconut_milk', name: 'Coconut Milk', nameFr: 'Lait de coco', category: 'canned', isPantryStaple: false, defaultUnit: 'can' },
  { id: 'kidney_beans', name: 'Kidney Beans', nameFr: 'Haricots rouges', category: 'canned', isPantryStaple: false, defaultUnit: 'can' },
  { id: 'tofu', name: 'Firm Tofu', nameFr: 'Tofu ferme', category: 'protein', isPantryStaple: false, defaultUnit: 'pack' },
  { id: 'peanut_butter', name: 'Peanut Butter', nameFr: 'Beurre d\'arachide', category: 'pantry', isPantryStaple: false, defaultUnit: 'jar' },
  { id: 'bbq_sauce', name: 'BBQ Sauce', nameFr: 'Sauce BBQ', category: 'pantry', isPantryStaple: false, defaultUnit: 'bottle' },
];

const BY_ID: Record<string, Ingredient> = Object.fromEntries(
  INGREDIENTS.map((i) => [i.id, i]),
);

export function getIngredient(id: string): Ingredient | undefined {
  return BY_ID[id];
}

/** Default pantry-staples set: assumed on hand, excluded from list & cost. */
export const PANTRY_STAPLE_IDS: string[] = INGREDIENTS.filter(
  (i) => i.isPantryStaple,
).map((i) => i.id);

export function isPantryStaple(id: string): boolean {
  return BY_ID[id]?.isPantryStaple ?? false;
}
