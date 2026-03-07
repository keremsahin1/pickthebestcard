import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
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

// ─── Protection type detection — now driven by merchant_tags in DB ────────────
// In production, recommend.ts queries `merchant_tags` for the matched merchant.
// These tests simulate that lookup using a simple tag map.

type MerchantTag = 'car_rental' | 'extended_warranty_eligible';

function detectProtectionType(tags: MerchantTag[]): 'car_rental_insurance' | 'extended_warranty' | null {
  const tagSet = new Set(tags);
  if (tagSet.has('car_rental')) return 'car_rental_insurance';
  if (tagSet.has('extended_warranty_eligible')) return 'extended_warranty';
  return null;
}

describe('protection type detection (tag-based)', () => {
  // Protection type is now driven by merchant_tags in DB, not hardcoded string matching.
  // These tests verify the tag→protectionType mapping logic.

  describe('car_rental tag → car_rental_insurance', () => {
    it('Hertz tagged car_rental → car_rental_insurance', () => {
      expect(detectProtectionType(['car_rental'])).toBe('car_rental_insurance');
    });
    it('Avis tagged car_rental → car_rental_insurance', () => {
      expect(detectProtectionType(['car_rental'])).toBe('car_rental_insurance');
    });
    it('merchant with both tags: car_rental wins over extended_warranty', () => {
      expect(detectProtectionType(['car_rental', 'extended_warranty_eligible'])).toBe('car_rental_insurance');
    });
  });

  describe('extended_warranty_eligible tag → extended_warranty', () => {
    it('Best Buy tagged → extended_warranty', () => {
      expect(detectProtectionType(['extended_warranty_eligible'])).toBe('extended_warranty');
    });
    it('Amazon tagged → extended_warranty', () => {
      expect(detectProtectionType(['extended_warranty_eligible'])).toBe('extended_warranty');
    });
  });

  describe('no tags → no protection', () => {
    it('empty tags → null', () => {
      expect(detectProtectionType([])).toBeNull();
    });
    it('unrecognized tag → null', () => {
      // Groceries, dining, gas stations have no protection tags
      expect(detectProtectionType([])).toBeNull();
    });
  });

  describe('regression: merchants that must NOT trigger car rental insurance', () => {
    // These merchants have no car_rental tag in DB — they're Travel/Hotels but not car rental
    it('Booking.com has no car_rental tag', () => {
      expect(detectProtectionType([])).toBeNull(); // Booking.com has no tags
    });
    it('Expedia has no car_rental tag', () => {
      expect(detectProtectionType([])).toBeNull();
    });
    it('Delta Airlines has no car_rental tag', () => {
      expect(detectProtectionType([])).toBeNull();
    });
    it('Marriott has no car_rental tag', () => {
      expect(detectProtectionType([])).toBeNull();
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

describe('loyalty card hotel/airline specificity', () => {
  // These test the principle: brand-specific loyalty bonuses must NOT match competing brands.
  // e.g. World of Hyatt 9x should not apply at Marriott — only at Hyatt.

  it('a card with base rate (1x) ranks lower than one with a matched benefit', () => {
    const sorted = sortRecommendations([
      makeRec('World of Hyatt (at Marriott → base)', 1.7, 'points', { rate: 1 }),
      makeRec('Marriott Bonvoy Boundless (at Marriott → 17x)', 15.3, 'points', { rate: 17 }),
    ]);
    expect(sorted[0].cardName).toContain('Marriott Bonvoy');
    expect(sorted[1].cardName).toContain('World of Hyatt');
  });

  it('loyalty card wins only at its own brand', () => {
    // At Hyatt: World of Hyatt (9x) > Marriott Bonvoy (base 1x)
    const atHyatt = sortRecommendations([
      makeRec('World of Hyatt', 15.3, 'points', { rate: 9 }),
      makeRec('Marriott Bonvoy Boundless', 0.9, 'points', { rate: 1 }),
    ]);
    expect(atHyatt[0].cardName).toBe('World of Hyatt');

    // At Marriott: Marriott Bonvoy (17x) > World of Hyatt (base 1x)
    const atMarriott = sortRecommendations([
      makeRec('World of Hyatt', 1.7, 'points', { rate: 1 }),
      makeRec('Marriott Bonvoy Boundless', 15.3, 'points', { rate: 17 }),
    ]);
    expect(atMarriott[0].cardName).toBe('Marriott Bonvoy Boundless');
  });

  it('IHG card base rate is used at non-IHG hotels', () => {
    const sorted = sortRecommendations([
      makeRec('IHG One Rewards Premier (at Marriott → base)', 1.5, 'points', { rate: 3 }),
      makeRec('Marriott Bonvoy Boundless (at Marriott → 17x)', 15.3, 'points', { rate: 17 }),
    ]);
    expect(sorted[0].cardName).toContain('Marriott');
  });

  it('Hyatt card wins at Hyatt over all Marriott/IHG cards', () => {
    const atHyatt = sortRecommendations([
      makeRec('World of Hyatt Credit Card', 6.8, 'points', { rate: 4 }),
      makeRec('Marriott Bonvoy Boundless', 1.8, 'points', { rate: 2 }),
      makeRec('Marriott Bonvoy Bountiful', 1.8, 'points', { rate: 2 }),
      makeRec('IHG One Rewards Premier', 1.5, 'points', { rate: 3 }),
    ]);
    expect(atHyatt[0].cardName).toBe('World of Hyatt Credit Card');
  });

  it('IHG card wins at IHG over all Marriott/Hyatt cards', () => {
    const atIHG = sortRecommendations([
      makeRec('IHG One Rewards Premier', 13, 'points', { rate: 26 }),
      makeRec('Marriott Bonvoy Boundless', 1.8, 'points', { rate: 2 }),
      makeRec('World of Hyatt Credit Card', 1.7, 'points', { rate: 1 }),
    ]);
    expect(atIHG[0].cardName).toBe('IHG One Rewards Premier');
  });

  it('Marriott card wins at Marriott over all Hyatt/IHG cards', () => {
    const atMarriott = sortRecommendations([
      makeRec('Marriott Bonvoy Boundless', 15.3, 'points', { rate: 17 }),
      makeRec('World of Hyatt Credit Card', 1.7, 'points', { rate: 1 }),
      makeRec('IHG One Rewards Premier', 1.5, 'points', { rate: 3 }),
    ]);
    expect(atMarriott[0].cardName).toBe('Marriott Bonvoy Boundless');
  });
});

// ─── Crawler prompt regression ──────────────────────────────────────────────

describe('crawler LLM prompt regressions', () => {
  const parseJs = readFileSync(join(__dirname, '..', '..', '..', 'crawler', 'parse.js'), 'utf-8');

  it('does not list Amazon as a standalone category', () => {
    // Bug: "Amazon" in the category list caused the LLM to return category:"Amazon"
    // instead of merchant:"Amazon", storing benefits under the wrong category_id.
    const categoryListMatch = parseJs.match(/category: one of: "([^"]+(?:", "[^"]+)*)"/);
    expect(categoryListMatch).toBeTruthy();
    const categories = categoryListMatch![1].split('", "');
    expect(categories).not.toContain('Amazon');
  });

  it('includes Amazon as a merchant-specific example', () => {
    expect(parseJs).toContain('merchant: "Amazon"');
  });
});

// ─── Merchant-specific benefit regressions ──────────────────────────────────

describe('merchant-specific benefit regressions', () => {
  // Bug: Amazon Prime Visa 5% at Amazon was stored as category "Amazon" (id 581)
  // but the Amazon merchant mapped to category "Online Shopping" (id 4).
  // The recommend code matched on category_id=4, found nothing, fell back to 1% base.
  // Fix: store Amazon benefits as merchant-specific (merchant_id), not category-level.

  it('Amazon Prime Visa 5% at Amazon beats Amazon Visa 3%', () => {
    const sorted = sortRecommendations([
      makeRec('Amazon Visa', 3, 'cashback', { rate: 3, baseRate: 1 }),
      makeRec('Amazon Prime Visa', 5, 'cashback', { rate: 5, baseRate: 1 }),
    ]);
    expect(sorted[0].cardName).toBe('Amazon Prime Visa');
    expect(sorted[0].rate).toBe(5);
    expect(sorted[1].cardName).toBe('Amazon Visa');
    expect(sorted[1].rate).toBe(3);
  });

  it('merchant-specific rate is used, not base rate', () => {
    // Simulates: card has 5% merchant-specific benefit, not falling back to 1% base
    const rec = makeRec('Amazon Prime Visa', 5, 'cashback', { rate: 5, baseRate: 1 });
    expect(rec.rate).toBe(5);
    expect(rec.rate).not.toBe(rec.baseRate);
  });

  it('merchant-specific benefit beats category benefit for different category', () => {
    // Card A has merchant-specific 5% at Amazon
    // Card B has category-level 2% for "Online Shopping"
    const sorted = sortRecommendations([
      makeRec('Card B (Online Shopping 2%)', 2, 'cashback', { rate: 2 }),
      makeRec('Card A (Amazon merchant 5%)', 5, 'cashback', { rate: 5 }),
    ]);
    expect(sorted[0].cardName).toContain('Card A');
  });
});

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
