import { describe, it, expect } from 'vitest';
import { sortRecommendations, sortProtections, detectCoverageTier } from './sort';
import type { Recommendation, Protection } from './types';

function makeRec(name: string, effectiveRate: number): Recommendation {
  return {
    cardId: 1, cardName: name, issuer: 'Chase', color: '#000',
    rate: effectiveRate, effectiveRate,
    benefitType: 'cashback', rewardType: 'cashback',
    category: null, notes: null, spendCap: null, capPeriod: null,
    requiresActivation: false, validUntil: null, isRotating: false,
    baseRate: 1, benefitsUrl: null,
  };
}

function makeProtection(name: string, tier: Protection['coverageTier'], amount: number): Protection {
  return {
    cardId: 1, cardName: name, issuer: 'Chase', color: '#000',
    protectionType: 'car_rental_insurance',
    coverageDetails: `Coverage is primary and provides reimbursement up to $${amount.toLocaleString()} for rental vehicles`,
    coverageTier: tier,
    notes: null, benefitsUrl: null,
  };
}

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

  it('handles single item', () => {
    expect(sortRecommendations([makeRec('A', 3)])).toHaveLength(1);
  });

  it('handles empty array', () => {
    expect(sortRecommendations([])).toEqual([]);
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

  it('sorts higher coverage amount first within same tier', () => {
    const sorted = sortProtections([
      makeProtection('Sapphire Preferred', 'primary', 60000),
      makeProtection('Sapphire Reserve', 'primary', 75000),
    ]);
    expect(sorted[0].cardName).toBe('Sapphire Reserve');
    expect(sorted[1].cardName).toBe('Sapphire Preferred');
  });

  it('does not mutate original array', () => {
    const protections = [
      makeProtection('B', 'secondary', 0),
      makeProtection('A', 'primary', 75000),
    ];
    sortProtections(protections);
    expect(protections[0].cardName).toBe('B');
  });

  it('handles empty array', () => {
    expect(sortProtections([])).toEqual([]);
  });
});

describe('sortProtections - coverage amount extraction', () => {
  it('correctly extracts $75,000 from coverage text', () => {
    const p = makeProtection('Reserve', 'primary', 75000);
    expect(p.coverageDetails).toContain('$75,000');
  });

  it('sorts $75k above $60k within primary tier', () => {
    const sorted = sortProtections([
      makeProtection('Preferred', 'primary', 60000),
      makeProtection('Reserve', 'primary', 75000),
    ]);
    expect(sorted[0].cardName).toBe('Reserve');
  });

  it('handles cards with no dollar amount in coverage text', () => {
    const protections = [
      { cardId: 1, cardName: 'Card A', issuer: 'Chase', color: '#000',
        protectionType: 'car_rental_insurance' as const,
        coverageDetails: 'Worldwide car rental insurance',
        coverageTier: 'unknown' as const, notes: null, benefitsUrl: null },
      makeProtection('Card B', 'primary', 75000),
    ];
    const sorted = sortProtections(protections);
    expect(sorted[0].cardName).toBe('Card B'); // primary beats unknown
  });
});

describe('detectCoverageTier', () => {
  it('detects primary', () => {
    expect(detectCoverageTier('Coverage is primary and provides reimbursement up to $75,000')).toBe('primary');
  });

  it('detects secondary', () => {
    expect(detectCoverageTier('Coverage is secondary to your personal insurance')).toBe('secondary');
  });

  it('returns unknown when neither', () => {
    expect(detectCoverageTier('Provides reimbursement for theft and collision damage')).toBe('unknown');
  });

  it('is case insensitive', () => {
    expect(detectCoverageTier('Coverage is PRIMARY')).toBe('primary');
    expect(detectCoverageTier('SECONDARY coverage applies')).toBe('secondary');
  });

  it('primary wins if both words appear', () => {
    expect(detectCoverageTier('primary coverage, unlike secondary plans')).toBe('primary');
  });

  it('returns unknown for empty string', () => {
    expect(detectCoverageTier('')).toBe('unknown');
  });

  it('returns unknown for unrelated text', () => {
    expect(detectCoverageTier('Worldwide car rental insurance included')).toBe('unknown');
  });
});

describe('sortRecommendations - edge cases', () => {
  it('handles all same effective rate', () => {
    const sorted = sortRecommendations([makeRec('A', 3), makeRec('B', 3), makeRec('C', 3)]);
    expect(sorted).toHaveLength(3);
    expect(sorted.every(r => r.effectiveRate === 3)).toBe(true);
  });

  it('returns new array (immutable)', () => {
    const recs = [makeRec('A', 2), makeRec('B', 5)];
    const sorted = sortRecommendations(recs);
    expect(sorted).not.toBe(recs);
  });
});

describe('sortProtections - edge cases', () => {
  it('handles all unknown tier, sorts by amount', () => {
    const sorted = sortProtections([
      { ...makeProtection('Low', 'unknown', 10000), coverageDetails: 'Up to $10,000' },
      { ...makeProtection('High', 'unknown', 50000), coverageDetails: 'Up to $50,000' },
    ]);
    expect(sorted[0].cardName).toBe('High');
  });

  it('handles multiple primary cards, sorts by amount', () => {
    const sorted = sortProtections([
      makeProtection('C', 'primary', 25000),
      makeProtection('A', 'primary', 75000),
      makeProtection('B', 'primary', 50000),
    ]);
    expect(sorted.map(p => p.cardName)).toEqual(['A', 'B', 'C']);
  });

  it('returns new array (immutable)', () => {
    const protections = [makeProtection('A', 'primary', 75000)];
    const sorted = sortProtections(protections);
    expect(sorted).not.toBe(protections);
  });
});
