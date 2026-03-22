const TYPE_MAP: Array<[string[], string]> = [
  [['grocery_or_supermarket', 'supermarket'], 'Groceries'],
  [['restaurant', 'food', 'cafe', 'bakery', 'bar'], 'Dining & Restaurants'],
  [['gas_station'], 'Gas Stations'],
  [['pharmacy', 'drugstore'], 'Drugstores & Pharmacy'],
  [['lodging'], 'Hotels'],
  [['home_goods_store', 'hardware_store', 'furniture_store'], 'Home Improvement'],
  [['department_store', 'shopping_mall', 'clothing_store', 'electronics_store'], 'Online Shopping'],
];

export function googleTypesToCategoryName(types: string[]): string {
  for (const type of types) {
    for (const [googleTypes, categoryName] of TYPE_MAP) {
      if (googleTypes.includes(type)) return categoryName;
    }
  }
  return 'General / Everything Else';
}
