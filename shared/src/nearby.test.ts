import { describe, it, expect } from 'vitest';
import { googleTypesToCategoryName } from './nearby';

describe('googleTypesToCategoryName', () => {
  it('maps grocery types', () => {
    expect(googleTypesToCategoryName(['grocery_or_supermarket'])).toBe('Groceries');
    expect(googleTypesToCategoryName(['supermarket'])).toBe('Groceries');
  });

  it('maps dining types', () => {
    expect(googleTypesToCategoryName(['restaurant'])).toBe('Dining & Restaurants');
    expect(googleTypesToCategoryName(['food'])).toBe('Dining & Restaurants');
    expect(googleTypesToCategoryName(['cafe'])).toBe('Dining & Restaurants');
    expect(googleTypesToCategoryName(['bakery'])).toBe('Dining & Restaurants');
    expect(googleTypesToCategoryName(['bar'])).toBe('Dining & Restaurants');
  });

  it('maps gas station', () => {
    expect(googleTypesToCategoryName(['gas_station'])).toBe('Gas Stations');
  });

  it('maps pharmacy types', () => {
    expect(googleTypesToCategoryName(['pharmacy'])).toBe('Drugstores & Pharmacy');
    expect(googleTypesToCategoryName(['drugstore'])).toBe('Drugstores & Pharmacy');
  });

  it('maps lodging', () => {
    expect(googleTypesToCategoryName(['lodging'])).toBe('Hotels');
  });

  it('maps home improvement types', () => {
    expect(googleTypesToCategoryName(['home_goods_store'])).toBe('Home Improvement');
    expect(googleTypesToCategoryName(['hardware_store'])).toBe('Home Improvement');
    expect(googleTypesToCategoryName(['furniture_store'])).toBe('Home Improvement');
  });

  it('maps retail/shopping types', () => {
    expect(googleTypesToCategoryName(['department_store'])).toBe('Online Shopping');
    expect(googleTypesToCategoryName(['shopping_mall'])).toBe('Online Shopping');
    expect(googleTypesToCategoryName(['clothing_store'])).toBe('Online Shopping');
    expect(googleTypesToCategoryName(['electronics_store'])).toBe('Online Shopping');
  });

  it('returns General for unknown types', () => {
    expect(googleTypesToCategoryName(['point_of_interest'])).toBe('General / Everything Else');
    expect(googleTypesToCategoryName([])).toBe('General / Everything Else');
    expect(googleTypesToCategoryName(['establishment'])).toBe('General / Everything Else');
  });

  it('uses first matching type in the array', () => {
    expect(googleTypesToCategoryName(['restaurant', 'food', 'establishment'])).toBe('Dining & Restaurants');
    expect(googleTypesToCategoryName(['establishment', 'grocery_or_supermarket'])).toBe('Groceries');
  });
});
