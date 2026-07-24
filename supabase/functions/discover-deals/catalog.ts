/**
 * Ingredient catalog for the extract-flyer edge function.
 *
 * Dependency-free plain TypeScript (no Deno or Node globals) so the same file
 * can be imported by the Deno runtime AND by Jest. This is a hand-off copy of
 * the app catalog in `src/data/ingredients.ts` — it INCLUDES pantry staples so
 * the model can recognize (and the validator can accept) every known id.
 *
 * Kept in sync by `__tests__/catalogSync.test.ts`: ids and nameFr must match
 * the app catalog exactly. If you edit src/data/ingredients.ts, update this too.
 */

export interface CatalogEntry {
  id: string;
  name: string;
  nameFr: string;
  category: string;
  defaultUnit: string;
}

export const CATALOG: CatalogEntry[] = [
  { id: "salt", name: "Salt", nameFr: "Sel", category: "staple", defaultUnit: "tsp" },
  { id: "black_pepper", name: "Black Pepper", nameFr: "Poivre noir", category: "staple", defaultUnit: "tsp" },
  { id: "olive_oil", name: "Olive Oil", nameFr: "Huile d'olive", category: "staple", defaultUnit: "tbsp" },
  { id: "vegetable_oil", name: "Vegetable Oil", nameFr: "Huile végétale", category: "staple", defaultUnit: "tbsp" },
  { id: "cumin", name: "Ground Cumin", nameFr: "Cumin moulu", category: "staple", defaultUnit: "tsp" },
  { id: "paprika", name: "Paprika", nameFr: "Paprika", category: "staple", defaultUnit: "tsp" },
  { id: "oregano", name: "Dried Oregano", nameFr: "Origan séché", category: "staple", defaultUnit: "tsp" },
  { id: "chili_flakes", name: "Chili Flakes", nameFr: "Flocons de piment", category: "staple", defaultUnit: "tsp" },
  { id: "garlic_powder", name: "Garlic Powder", nameFr: "Poudre d'ail", category: "staple", defaultUnit: "tsp" },
  { id: "cinnamon", name: "Cinnamon", nameFr: "Cannelle", category: "staple", defaultUnit: "tsp" },
  { id: "flour", name: "All-Purpose Flour", nameFr: "Farine tout usage", category: "staple", defaultUnit: "cup" },
  { id: "sugar", name: "Sugar", nameFr: "Sucre", category: "staple", defaultUnit: "tbsp" },
  { id: "soy_sauce", name: "Soy Sauce", nameFr: "Sauce soya", category: "staple", defaultUnit: "tbsp" },
  { id: "vinegar", name: "Vinegar", nameFr: "Vinaigre", category: "staple", defaultUnit: "tbsp" },
  { id: "onion", name: "Yellow Onion", nameFr: "Oignon jaune", category: "produce", defaultUnit: "unit" },
  { id: "garlic", name: "Garlic", nameFr: "Ail", category: "produce", defaultUnit: "clove" },
  { id: "carrot", name: "Carrots", nameFr: "Carottes", category: "produce", defaultUnit: "unit" },
  { id: "bell_pepper", name: "Bell Peppers", nameFr: "Poivrons", category: "produce", defaultUnit: "unit" },
  { id: "broccoli", name: "Broccoli", nameFr: "Brocoli", category: "produce", defaultUnit: "bunch" },
  { id: "spinach", name: "Baby Spinach", nameFr: "Bébés épinards", category: "produce", defaultUnit: "container" },
  { id: "tomato", name: "Tomatoes", nameFr: "Tomates", category: "produce", defaultUnit: "unit" },
  { id: "sweet_potato", name: "Sweet Potatoes", nameFr: "Patates douces", category: "produce", defaultUnit: "kg" },
  { id: "potato", name: "Potatoes", nameFr: "Pommes de terre", category: "produce", defaultUnit: "kg" },
  { id: "mushroom", name: "Mushrooms", nameFr: "Champignons", category: "produce", defaultUnit: "pack" },
  { id: "zucchini", name: "Zucchini", nameFr: "Courgettes", category: "produce", defaultUnit: "unit" },
  { id: "lemon", name: "Lemons", nameFr: "Citrons", category: "produce", defaultUnit: "unit" },
  { id: "lime", name: "Limes", nameFr: "Limes", category: "produce", defaultUnit: "unit" },
  { id: "cilantro", name: "Cilantro", nameFr: "Coriandre", category: "produce", defaultUnit: "bunch" },
  { id: "green_onion", name: "Green Onions", nameFr: "Oignons verts", category: "produce", defaultUnit: "bunch" },
  { id: "ginger", name: "Ginger", nameFr: "Gingembre", category: "produce", defaultUnit: "unit" },
  { id: "avocado", name: "Avocados", nameFr: "Avocats", category: "produce", defaultUnit: "unit" },
  { id: "cabbage", name: "Cabbage", nameFr: "Chou", category: "produce", defaultUnit: "unit" },
  { id: "kale", name: "Kale", nameFr: "Chou frisé", category: "produce", defaultUnit: "bunch" },
  { id: "corn", name: "Corn", nameFr: "Maïs", category: "produce", defaultUnit: "unit" },
  { id: "chicken_thigh", name: "Chicken Thighs", nameFr: "Cuisses de poulet", category: "meat", defaultUnit: "kg" },
  { id: "chicken_breast", name: "Chicken Breast", nameFr: "Poitrine de poulet", category: "meat", defaultUnit: "kg" },
  { id: "ground_beef", name: "Ground Beef", nameFr: "Bœuf haché", category: "meat", defaultUnit: "kg" },
  { id: "beef_strips", name: "Beef Strips", nameFr: "Lanières de bœuf", category: "meat", defaultUnit: "kg" },
  { id: "pork_shoulder", name: "Pork Shoulder", nameFr: "Épaule de porc", category: "meat", defaultUnit: "kg" },
  { id: "ground_pork", name: "Ground Pork", nameFr: "Porc haché", category: "meat", defaultUnit: "kg" },
  { id: "salmon", name: "Atlantic Salmon Fillets", nameFr: "Filets de saumon", category: "seafood", defaultUnit: "g" },
  { id: "tilapia", name: "Tilapia Fillets", nameFr: "Filets de tilapia", category: "seafood", defaultUnit: "g" },
  { id: "shrimp", name: "Shrimp", nameFr: "Crevettes", category: "seafood", defaultUnit: "g" },
  { id: "eggs", name: "Eggs", nameFr: "Œufs", category: "dairy", defaultUnit: "dozen" },
  { id: "butter", name: "Butter", nameFr: "Beurre", category: "dairy", defaultUnit: "block" },
  { id: "milk", name: "Milk", nameFr: "Lait", category: "dairy", defaultUnit: "L" },
  { id: "cheddar", name: "Cheddar Cheese", nameFr: "Cheddar", category: "dairy", defaultUnit: "block" },
  { id: "parmesan", name: "Parmesan", nameFr: "Parmesan", category: "dairy", defaultUnit: "wedge" },
  { id: "greek_yogurt", name: "Greek Yogurt", nameFr: "Yogourt grec", category: "dairy", defaultUnit: "tub" },
  { id: "cream", name: "Cooking Cream", nameFr: "Crème à cuisson", category: "dairy", defaultUnit: "carton" },
  { id: "feta", name: "Feta Cheese", nameFr: "Feta", category: "dairy", defaultUnit: "pack" },
  { id: "rice", name: "Jasmine Rice", nameFr: "Riz jasmin", category: "grain", defaultUnit: "bag" },
  { id: "pasta", name: "Pasta", nameFr: "Pâtes", category: "grain", defaultUnit: "box" },
  { id: "penne_ww", name: "Whole Wheat Penne", nameFr: "Penne de blé entier", category: "grain", defaultUnit: "box" },
  { id: "rice_gf", name: "Brown Rice", nameFr: "Riz brun", category: "grain", defaultUnit: "bag" },
  { id: "quinoa", name: "Quinoa", nameFr: "Quinoa", category: "grain", defaultUnit: "bag" },
  { id: "tortilla", name: "Corn Tortillas", nameFr: "Tortillas de maïs", category: "grain", defaultUnit: "pack" },
  { id: "burger_buns", name: "Burger Buns", nameFr: "Pains à burger", category: "grain", defaultUnit: "pack" },
  { id: "arborio_rice", name: "Arborio Rice", nameFr: "Riz arborio", category: "grain", defaultUnit: "bag" },
  { id: "couscous", name: "Couscous", nameFr: "Couscous", category: "grain", defaultUnit: "box" },
  { id: "black_beans", name: "Black Beans", nameFr: "Haricots noirs", category: "canned", defaultUnit: "can" },
  { id: "chickpeas", name: "Chickpeas", nameFr: "Pois chiches", category: "canned", defaultUnit: "can" },
  { id: "lentils", name: "Lentils", nameFr: "Lentilles", category: "canned", defaultUnit: "bag" },
  { id: "canned_tomatoes", name: "Diced Tomatoes", nameFr: "Tomates en dés", category: "canned", defaultUnit: "can" },
  { id: "tomato_sauce", name: "Tomato Sauce", nameFr: "Sauce tomate", category: "canned", defaultUnit: "jar" },
  { id: "coconut_milk", name: "Coconut Milk", nameFr: "Lait de coco", category: "canned", defaultUnit: "can" },
  { id: "kidney_beans", name: "Kidney Beans", nameFr: "Haricots rouges", category: "canned", defaultUnit: "can" },
  { id: "tofu", name: "Firm Tofu", nameFr: "Tofu ferme", category: "protein", defaultUnit: "pack" },
  { id: "peanut_butter", name: "Peanut Butter", nameFr: "Beurre d'arachide", category: "pantry", defaultUnit: "jar" },
  { id: "bbq_sauce", name: "BBQ Sauce", nameFr: "Sauce BBQ", category: "pantry", defaultUnit: "bottle" },
];

/** All valid catalog ids, in catalog order (used for the model output enum). */
export const CATALOG_IDS: string[] = CATALOG.map((c) => c.id);

/** Fast membership test for validation. */
export const CATALOG_ID_SET: Set<string> = new Set(CATALOG_IDS);

const CATALOG_BY_ID: Record<string, CatalogEntry> = Object.fromEntries(
  CATALOG.map((c) => [c.id, c]),
);

/** Look up a catalog entry by id, or undefined if unknown. */
export function getCatalogEntry(id: string): CatalogEntry | undefined {
  return CATALOG_BY_ID[id];
}
