const TYPE_MAP: Array<[string[], string]> = [
  [['grocery_store', 'grocery_or_supermarket', 'supermarket', 'food_store', 'asian_grocery_store'], 'Groceries'],
  [['restaurant', 'cafe', 'bakery', 'bar', 'fast_food_restaurant', 'coffee_shop'], 'Dining & Restaurants'],
  [['gas_station'], 'Gas Stations'],
  [['pharmacy', 'drugstore'], 'Drugstores & Pharmacy'],
  [['lodging', 'hotel'], 'Hotels'],
  [['home_goods_store', 'hardware_store', 'furniture_store'], 'Home Improvement'],
  [['department_store', 'shopping_mall', 'clothing_store', 'electronics_store'], 'Online Shopping'],
];

// Priority-based: checks all types against the first category before moving to the next.
// This ensures grocery_store beats 'food' (which could match dining).
export function googleTypesToCategoryName(types: string[]): string {
  for (const [googleTypes, categoryName] of TYPE_MAP) {
    if (types.some(t => googleTypes.includes(t))) return categoryName;
  }
  return 'General / Everything Else';
}
