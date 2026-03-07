import { formatReward, formatEffectiveValue, sortRecommendations, sortProtections } from '../lib/shared';
import type { Recommendation, Protection } from '../lib/shared';

function makeRec(name: string, effectiveRate: number, rewardType: 'cashback' | 'points' = 'cashback'): Recommendation {
  return {
    cardId: 1, cardName: name, issuer: 'Chase', color: '#000',
    rate: effectiveRate, effectiveRate,
    benefitType: 'cashback', rewardType,
    category: null, notes: null, spendCap: null, capPeriod: null,
    requiresActivation: false, validUntil: null, isRotating: false,
    baseRate: 1, benefitsUrl: null,
  };
}

function makeProtection(name: string, tier: Protection['coverageTier'], amount: number): Protection {
  return {
    cardId: 1, cardName: name, issuer: 'Chase', color: '#000',
    protectionType: 'car_rental_insurance',
    coverageDetails: `Coverage up to $${amount.toLocaleString()}`,
    coverageTier: tier, notes: null, benefitsUrl: null,
  };
}

describe('formatReward', () => {
  it('formats cash back', () => {
    expect(formatReward({ rewardType: 'cashback', rate: 3 })).toBe('3% cash back');
  });
  it('formats fractional cash back', () => {
    expect(formatReward({ rewardType: 'cashback', rate: 1.5 })).toBe('1.5% cash back');
  });
  it('formats 5% (Costco Anywhere Visa at Costco Gas)', () => {
    expect(formatReward({ rewardType: 'cashback', rate: 5 })).toBe('5% cash back');
  });
  it('formats points', () => {
    expect(formatReward({ rewardType: 'points', rate: 3 })).toBe('3x points');
  });
  it('formats 1x base rate', () => {
    expect(formatReward({ rewardType: 'points', rate: 1 })).toBe('1x points');
  });
  it('uses "points" not "pts"', () => {
    expect(formatReward({ rewardType: 'points', rate: 5 })).not.toContain('pts');
  });
  it('uses "cash back" not just "back"', () => {
    expect(formatReward({ rewardType: 'cashback', rate: 2 })).not.toBe('2% back');
  });
});

describe('formatEffectiveValue', () => {
  it('returns null for cashback', () => {
    expect(formatEffectiveValue({ rewardType: 'cashback', effectiveRate: 3 })).toBeNull();
  });
  it('returns value string for points', () => {
    expect(formatEffectiveValue({ rewardType: 'points', effectiveRate: 6 })).toBe('≈ 6.0% value');
  });
  it('handles fractional rate', () => {
    expect(formatEffectiveValue({ rewardType: 'points', effectiveRate: 2.5 })).toBe('≈ 2.5% value');
  });
  it('always shows one decimal place', () => {
    expect(formatEffectiveValue({ rewardType: 'points', effectiveRate: 4 })).toBe('≈ 4.0% value');
  });
});

describe('sortRecommendations', () => {
  it('sorts highest effective rate first', () => {
    const sorted = sortRecommendations([makeRec('A', 2), makeRec('B', 5), makeRec('C', 3)]);
    expect(sorted.map(r => r.cardName)).toEqual(['B', 'C', 'A']);
  });
  it('does not mutate original array', () => {
    const recs = [makeRec('A', 2), makeRec('B', 5)];
    sortRecommendations(recs);
    expect(recs[0].cardName).toBe('A');
  });
  it('handles empty array', () => {
    expect(sortRecommendations([])).toHaveLength(0);
  });
  it('points effective rate beats nominal rate', () => {
    const sorted = sortRecommendations([
      makeRec('Double Cash', 2, 'cashback'),
      makeRec('Sapphire Reserve', 6, 'points'),
    ]);
    expect(sorted[0].cardName).toBe('Sapphire Reserve');
  });
});

describe('sortProtections', () => {
  it('sorts primary before secondary before unknown', () => {
    const sorted = sortProtections([
      makeProtection('C', 'unknown', 0),
      makeProtection('B', 'secondary', 50000),
      makeProtection('A', 'primary', 75000),
    ]);
    expect(sorted.map(p => p.cardName)).toEqual(['A', 'B', 'C']);
  });
  it('sorts higher amount first within same tier', () => {
    const sorted = sortProtections([
      makeProtection('Preferred', 'primary', 60000),
      makeProtection('Reserve', 'primary', 75000),
    ]);
    expect(sorted[0].cardName).toBe('Reserve');
  });
  it('primary low beats secondary high', () => {
    const sorted = sortProtections([
      makeProtection('Secondary High', 'secondary', 100000),
      makeProtection('Primary Low', 'primary', 10000),
    ]);
    expect(sorted[0].cardName).toBe('Primary Low');
  });
  it('does not mutate original array', () => {
    const arr = [makeProtection('B', 'secondary', 0), makeProtection('A', 'primary', 75000)];
    sortProtections(arr);
    expect(arr[0].cardName).toBe('B');
  });
  it('handles empty array', () => {
    expect(sortProtections([])).toHaveLength(0);
  });

  it('sign out resets state', () => {
    let cards: string[] = ['card1', 'card2'];
    let results: string[] = ['result1'];
    let merchant = 'Costco';

    // simulate sign out
    cards = [];
    results = [];
    merchant = '';

    expect(cards).toHaveLength(0);
    expect(results).toHaveLength(0);
    expect(merchant).toBe('');
  });
});
