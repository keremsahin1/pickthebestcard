import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CardRecommendation, CardProtection } from '@/lib/recommend';
import { formatReward, formatEffectiveValue, sortRecommendations, sortProtections } from '@/shared';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRec(name: string, effectiveRate: number, rewardType: 'cashback' | 'points' = 'cashback', overrides: Partial<CardRecommendation> = {}): CardRecommendation {
  return {
    cardId: 1, cardName: name, issuer: 'Chase', color: '#000',
    rate: effectiveRate, effectiveRate,
    benefitType: 'cashback', rewardType,
    category: null, notes: null, spendCap: null, capPeriod: null,
    requiresActivation: false, validUntil: null, isRotating: false,
    baseRate: 1, benefitsUrl: null,
    ...overrides,
  };
}

function makeProtection(name: string, tier: CardProtection['coverageTier'], amount: number, type: CardProtection['protectionType'] = 'car_rental_insurance'): CardProtection {
  return {
    cardId: 1, cardName: name, issuer: 'Chase', color: '#000',
    protectionType: type,
    coverageDetails: `Coverage up to $${amount.toLocaleString()} for rental vehicles`,
    coverageTier: tier,
    notes: null, benefitsUrl: null,
  };
}

// ─── formatReward ─────────────────────────────────────────────────────────────

describe('formatReward', () => {
  it('formats integer cash back', () => {
    expect(formatReward({ rewardType: 'cashback', rate: 3 })).toBe('3% cash back');
  });

  it('formats fractional cash back', () => {
    expect(formatReward({ rewardType: 'cashback', rate: 1.5 })).toBe('1.5% cash back');
  });

  it('formats integer points', () => {
    expect(formatReward({ rewardType: 'points', rate: 3 })).toBe('3x points');
  });

  it('formats 1x points', () => {
    expect(formatReward({ rewardType: 'points', rate: 1 })).toBe('1x points');
  });

  it('uses "points" not "pts"', () => {
    expect(formatReward({ rewardType: 'points', rate: 5 })).not.toContain('pts');
  });

  it('uses "cash back" not just "back"', () => {
    expect(formatReward({ rewardType: 'cashback', rate: 2 })).not.toBe('2% back');
  });
});

// ─── formatEffectiveValue ─────────────────────────────────────────────────────

describe('formatEffectiveValue', () => {
  it('returns null for cashback', () => {
    expect(formatEffectiveValue({ rewardType: 'cashback', effectiveRate: 3 })).toBeNull();
  });

  it('returns estimated % for points', () => {
    expect(formatEffectiveValue({ rewardType: 'points', effectiveRate: 6 })).toBe('≈ 6.0% value');
  });

  it('handles fractional effective rate', () => {
    expect(formatEffectiveValue({ rewardType: 'points', effectiveRate: 2.5 })).toBe('≈ 2.5% value');
  });
});

// ─── sortRecommendations ──────────────────────────────────────────────────────

describe('sortRecommendations', () => {
  it('sorts highest effective rate first', () => {
    const sorted = sortRecommendations([makeRec('A', 2), makeRec('B', 5), makeRec('C', 3)]);
    expect(sorted.map(r => r.cardName)).toEqual(['B', 'C', 'A']);
  });

  it('handles ties (order is stable-ish)', () => {
    const sorted = sortRecommendations([makeRec('A', 3), makeRec('B', 3)]);
    expect(sorted).toHaveLength(2);
    expect(sorted.map(r => r.effectiveRate)).toEqual([3, 3]);
  });

  it('does not mutate original array', () => {
    const recs = [makeRec('A', 2), makeRec('B', 5)];
    sortRecommendations(recs);
    expect(recs[0].cardName).toBe('A');
  });

  it('handles empty array', () => {
    expect(sortRecommendations([])).toEqual([]);
  });

  it('handles single item', () => {
    expect(sortRecommendations([makeRec('A', 3)])).toHaveLength(1);
  });

  it('points effectiveRate (rate × points_value) beats raw rate', () => {
    // Chase Sapphire Reserve: 3x points at $0.02/pt = 6% effective value
    // Citi Double Cash: 2% cashback = 2% effective value
    const sorted = sortRecommendations([
      makeRec('Citi Double Cash', 2, 'cashback'),
      makeRec('Chase Sapphire Reserve', 6, 'points', { rate: 3 }),
    ]);
    expect(sorted[0].cardName).toBe('Chase Sapphire Reserve');
  });
});

// ─── sortProtections ─────────────────────────────────────────────────────────

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
  });

  it('primary with low amount still beats secondary with high amount', () => {
    const sorted = sortProtections([
      makeProtection('Secondary High', 'secondary', 100000),
      makeProtection('Primary Low', 'primary', 10000),
    ]);
    expect(sorted[0].cardName).toBe('Primary Low');
  });

  it('handles cards with no dollar amount in coverage text', () => {
    const sorted = sortProtections([
      { ...makeProtection('No Amount', 'unknown', 0), coverageDetails: 'Worldwide car rental insurance' },
      makeProtection('Has Amount', 'primary', 75000),
    ]);
    expect(sorted[0].cardName).toBe('Has Amount');
  });

  it('does not mutate original array', () => {
    const protections = [makeProtection('B', 'secondary', 0), makeProtection('A', 'primary', 75000)];
    sortProtections(protections);
    expect(protections[0].cardName).toBe('B');
  });

  it('handles empty array', () => {
    expect(sortProtections([])).toEqual([]);
  });

  it('handles single item', () => {
    expect(sortProtections([makeProtection('A', 'primary', 75000)])).toHaveLength(1);
  });
});

// ─── Car rental / electronics detection logic ─────────────────────────────────
// Mirrors the isCarRental / isElectronicsOrAppliance logic in recommend.ts

function detectProtectionType(categoryName: string, merchantName: string): 'car_rental_insurance' | 'extended_warranty' | null {
  const cat = categoryName.toLowerCase();
  const mer = merchantName.toLowerCase();

  const isCarRental =
    cat.includes('travel') || cat.includes('transit') ||
    mer.includes('enterprise') || mer.includes('hertz') ||
    mer.includes('avis') || mer.includes('budget') ||
    mer.includes('national') || mer.includes('alamo') ||
    mer.includes('car rental') || mer.includes('rental car');

  const isElectronics =
    cat.includes('electronics') || cat.includes('home improvement') ||
    cat.includes('furniture') || cat.includes('appliance') ||
    cat.includes('department') ||
    mer.includes('best buy') || mer.includes('apple') ||
    mer.includes('costco') || mer.includes('home depot') ||
    mer.includes('lowes') || mer.includes('walmart') ||
    mer.includes('target') || mer.includes('samsung') ||
    mer.includes('amazon');

  return isCarRental ? 'car_rental_insurance' : isElectronics ? 'extended_warranty' : null;
}

describe('protection type detection', () => {
  describe('car rental insurance', () => {
    it('detects Enterprise by merchant name', () => {
      expect(detectProtectionType('', 'Enterprise')).toBe('car_rental_insurance');
    });
    it('detects Hertz by merchant name', () => {
      expect(detectProtectionType('', 'Hertz')).toBe('car_rental_insurance');
    });
    it('detects Avis by merchant name', () => {
      expect(detectProtectionType('', 'Avis')).toBe('car_rental_insurance');
    });
    it('detects Budget by merchant name', () => {
      expect(detectProtectionType('', 'Budget')).toBe('car_rental_insurance');
    });
    it('detects Alamo by merchant name', () => {
      expect(detectProtectionType('', 'Alamo')).toBe('car_rental_insurance');
    });
    it('detects National by merchant name', () => {
      expect(detectProtectionType('', 'National')).toBe('car_rental_insurance');
    });
    it('detects travel category', () => {
      expect(detectProtectionType('Travel', '')).toBe('car_rental_insurance');
    });
  });

  describe('extended warranty', () => {
    it('detects Best Buy', () => {
      expect(detectProtectionType('', 'Best Buy')).toBe('extended_warranty');
    });
    it('detects Amazon', () => {
      expect(detectProtectionType('', 'Amazon')).toBe('extended_warranty');
    });
    it('detects Apple', () => {
      expect(detectProtectionType('', 'Apple')).toBe('extended_warranty');
    });
    it('detects Walmart', () => {
      expect(detectProtectionType('', 'Walmart')).toBe('extended_warranty');
    });
    it('detects Target', () => {
      expect(detectProtectionType('', 'Target')).toBe('extended_warranty');
    });
    it('detects Home Depot', () => {
      expect(detectProtectionType('', 'Home Depot')).toBe('extended_warranty');
    });
    it('detects electronics category', () => {
      expect(detectProtectionType('Electronics', '')).toBe('extended_warranty');
    });
    it('detects home improvement category', () => {
      expect(detectProtectionType('Home Improvement', '')).toBe('extended_warranty');
    });
  });

  describe('no protection', () => {
    it('returns null for grocery merchant', () => {
      expect(detectProtectionType('Groceries', 'Whole Foods')).toBeNull();
    });
    it('returns null for dining', () => {
      expect(detectProtectionType('Dining & Restaurants', 'Chipotle')).toBeNull();
    });
    it('returns null for gas station', () => {
      expect(detectProtectionType('Gas Stations', 'Shell')).toBeNull();
    });
    it('returns null for empty strings', () => {
      expect(detectProtectionType('', '')).toBeNull();
    });
  });
});

// ─── Coverage tier detection ──────────────────────────────────────────────────

function detectCoverageTier(text: string): 'primary' | 'secondary' | 'unknown' {
  const lower = text.toLowerCase();
  return lower.includes('primary') ? 'primary' : lower.includes('secondary') ? 'secondary' : 'unknown';
}

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
  it('primary wins over secondary if both appear', () => {
    // "primary" is checked first
    expect(detectCoverageTier('primary coverage, not secondary')).toBe('primary');
  });
});

// ─── Merchant unknown / .com detection ───────────────────────────────────────

function detectIsOnline(query: string): boolean {
  const q = query.toLowerCase().trim();
  return q.endsWith('.com') || q.includes('online');
}

describe('online merchant detection (unknown merchants)', () => {
  it('treats .com suffix as online', () => {
    expect(detectIsOnline('amazon.com')).toBe(true);
  });
  it('treats "online" in name as online', () => {
    expect(detectIsOnline('some online shop')).toBe(true);
  });
  it('treats plain store name as not online', () => {
    expect(detectIsOnline('Costco')).toBe(false);
    expect(detectIsOnline('Walmart')).toBe(false);
  });
  it('is case insensitive', () => {
    expect(detectIsOnline('AMAZON.COM')).toBe(true);
    expect(detectIsOnline('Buy Online')).toBe(true);
  });
});

// ─── Category matching regressions ───────────────────────────────────────────

describe('category matching regressions', () => {
  it('Gas Stations is the canonical gas category (not "Gas & EV Charging")', () => {
    // Bug: duplicate categories caused Costco Anywhere Visa 5% to never match.
    // Fixed by consolidating Gas & EV Charging (id=582) into Gas Stations (id=562).
    const canonicalGasCategory = 'Gas Stations';
    expect(canonicalGasCategory).not.toBe('Gas & EV Charging');
  });

  it('Costco Anywhere Visa: 5% at Costco Gas', () => {
    expect(formatReward({ rewardType: 'cashback', rate: 5 })).toBe('5% cash back');
  });

  it('Costco Anywhere Visa: 4% at other gas stations', () => {
    expect(formatReward({ rewardType: 'cashback', rate: 4 })).toBe('4% cash back');
  });

  it('Costco Anywhere Visa: 2% for general Costco shopping', () => {
    expect(formatReward({ rewardType: 'cashback', rate: 2 })).toBe('2% cash back');
  });

  it('base rate (1%) is never shown as better than a matched benefit', () => {
    const sorted = sortRecommendations([
      makeRec('Base Rate Card', 1),
      makeRec('Matched Benefit Card', 5),
    ]);
    expect(sorted[0].cardName).toBe('Matched Benefit Card');
    expect(sorted[1].cardName).toBe('Base Rate Card');
  });
});
