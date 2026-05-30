// Normalised (lowercase) ingredient → allergen group
const ALLERGEN_MAP: Record<string, string> = {
  // Peanuts
  groundnut: 'Peanuts',
  groundnuts: 'Peanuts',
  peanut: 'Peanuts',
  peanuts: 'Peanuts',
  'peanut butter': 'Peanuts',
  'groundnut oil': 'Peanuts',

  // Dairy
  milk: 'Dairy',
  butter: 'Dairy',
  cream: 'Dairy',
  cheese: 'Dairy',
  yoghurt: 'Dairy',
  yogurt: 'Dairy',
  'evaporated milk': 'Dairy',
  'condensed milk': 'Dairy',
  'powdered milk': 'Dairy',
  'soya milk': 'Dairy',
  ghee: 'Dairy',

  // Eggs
  egg: 'Eggs',
  eggs: 'Eggs',
  mayonnaise: 'Eggs',

  // Wheat / Gluten
  wheat: 'Wheat/Gluten',
  flour: 'Wheat/Gluten',
  semolina: 'Wheat/Gluten',
  bread: 'Wheat/Gluten',
  pasta: 'Wheat/Gluten',
  noodles: 'Wheat/Gluten',
  spaghetti: 'Wheat/Gluten',
  oats: 'Wheat/Gluten',
  barley: 'Wheat/Gluten',
  bun: 'Wheat/Gluten',

  // Soy
  soy: 'Soy',
  soybean: 'Soy',
  soybeans: 'Soy',
  'soya beans': 'Soy',
  'soy sauce': 'Soy',
  tofu: 'Soy',

  // Sesame
  sesame: 'Sesame',
  'sesame oil': 'Sesame',
  'sesame seeds': 'Sesame',
  tahini: 'Sesame',

  // Fish
  fish: 'Fish',
  catfish: 'Fish',
  tilapia: 'Fish',
  mackerel: 'Fish',
  sardine: 'Fish',
  sardines: 'Fish',
  stockfish: 'Fish',
  'dried fish': 'Fish',
  salmon: 'Fish',
  tuna: 'Fish',
  cod: 'Fish',
  'smoked fish': 'Fish',

  // Shellfish
  crayfish: 'Shellfish',
  shrimp: 'Shellfish',
  prawn: 'Shellfish',
  prawns: 'Shellfish',
  lobster: 'Shellfish',
  crab: 'Shellfish',
  periwinkle: 'Shellfish',
  oyster: 'Shellfish',
  oysters: 'Shellfish',
  snail: 'Shellfish',
  shellfish: 'Shellfish',

  // Tree nuts
  'tree nuts': 'Tree nuts',
  almond: 'Tree nuts',
  almonds: 'Tree nuts',
  cashew: 'Tree nuts',
  cashews: 'Tree nuts',
  walnut: 'Tree nuts',
  walnuts: 'Tree nuts',
  coconut: 'Tree nuts',
  pistachio: 'Tree nuts',
  hazelnut: 'Tree nuts',
};

export const INGREDIENT_SUGGESTIONS = [
  'Rice', 'Tomato', 'Groundnut', 'Fish', 'Crayfish', 'Milk', 'Egg',
  'Wheat', 'Soy', 'Sesame', 'Shellfish', 'Tree Nuts',
  'Chicken', 'Beef', 'Pork', 'Lamb', 'Turkey', 'Goat meat',
  'Onion', 'Garlic', 'Scotch bonnet', 'Tatashe', 'Ginger', 'Turmeric',
  'Palm oil', 'Vegetable oil', 'Groundnut oil', 'Coconut oil',
  'Tomato paste', 'Seasoning cube', 'Salt', 'Curry powder', 'Thyme', 'Bay leaf',
  'Plantain', 'Yam', 'Cassava', 'Sweet potato', 'Cocoyam', 'Potatoes',
  'Spinach', 'Ugu', 'Waterleaf', 'Okra', 'Bitter leaf', 'Ewedu',
  'Egusi', 'Ogbono', 'Cowpea', 'Black-eyed peas',
  'Catfish', 'Tilapia', 'Mackerel', 'Sardine', 'Stockfish', 'Dried fish', 'Smoked fish',
  'Shrimp', 'Prawn', 'Periwinkle', 'Snail',
  'Butter', 'Cream', 'Cheese', 'Evaporated milk', 'Powdered milk',
  'Flour', 'Semolina', 'Cornmeal', 'Oats', 'Noodles', 'Spaghetti',
  'Soy sauce', 'Soybean', 'Soya beans', 'Tofu',
  'Sesame oil', 'Sesame seeds',
  'Almond', 'Cashew', 'Walnut', 'Coconut', 'Peanut butter',
  'Pepper', 'Stock cube', 'Uziza', 'Uda', 'Ehuru',
  'Beans', 'Lentils', 'Corn', 'Millet', 'Sorghum',
  'Banana', 'Mango', 'Pineapple', 'Pawpaw', 'Orange',
];

export function deriveAllergens(ingredients: string[]): string[] {
  const set = new Set<string>();
  for (const ing of ingredients) {
    const allergen = ALLERGEN_MAP[ing.toLowerCase()];
    if (allergen) set.add(allergen);
  }
  return Array.from(set);
}

export interface AllergenMatch {
  matchedAllergens: string[];
  matchedIngredients: string[];
}

export function computeAllergenMatches(
  customerAllergens: string[],
  dishIngredients: string[],
  dishAllergens: string[],
): AllergenMatch {
  if (customerAllergens.length === 0) return { matchedAllergens: [], matchedIngredients: [] };

  const derived = deriveAllergens(dishIngredients);
  const allDishAllergens = Array.from(new Set([...dishAllergens, ...derived]));
  const customerNorm = customerAllergens.map(a => a.toLowerCase());

  const matchedAllergens = allDishAllergens.filter(a =>
    customerNorm.includes(a.toLowerCase()),
  );

  const matchedIngredients = dishIngredients.filter(ing => {
    const allergen = ALLERGEN_MAP[ing.toLowerCase()];
    return allergen && matchedAllergens.some(ma => ma.toLowerCase() === allergen.toLowerCase());
  });

  return { matchedAllergens, matchedIngredients };
}
