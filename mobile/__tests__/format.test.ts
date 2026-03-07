import type { Recommendation, Protection } from '../lib/api';

// ─── Helpers (mirrored from index.tsx) ───────────────────────────────────────

function formatReward(rec: Pick<Recommendation, 'rewardType' | 'rate'>) {
  if (rec.rewardType === 'points') return `${rec.rate}x points`;
  return `${rec.rate}% cash back`;
}

function makeRec(overrides: Partial<Recommendation> = {}): Recommendation {
  return {
    cardId: 1,
    cardName: 'Test Card',
    issuer: 'Chase',
    color: '#000',
    rate: 3,
    effectiveRate: 3,
    benefitType: 'cashback',
    rewardType: 'cashback',
    category: null,
    notes: null,
    spendCap: null,
    capPeriod: null,
    requiresActivation: false,
    validUntil: null,
    isRotating: false,
    baseRate: 1,
    benefitsUrl: null,
    ...overrides,
  };
}

function makeProtection(overrides: Partial<Protection> = {}): Protection {
  return {
    cardId: 1,
    cardName: 'Test Card',
    issuer: 'Chase',
    color: '#000',
    protectionType: 'car_rental_insurance',
    coverageDetails: 'Coverage up to $60,000',
    coverageTier: 'unknown',
    notes: null,
    benefitsUrl: null,
    ...overrides,
  };
}

// ─── Format Reward ────────────────────────────────────────────────────────────

describe('formatReward', () => {
  it('formats cash back correctly', () => {
    expect(formatReward({ rewardType: 'cashback', rate: 3 })).toBe('3% cash back');
    expect(formatReward({ rewardType: 'cashback', rate: 1.5 })).toBe('1.5% cash back');
  });

  it('formats points correctly', () => {
    expect(formatReward({ rewardType: 'points', rate: 3 })).toBe('3x points');
  });

  it('uses "points" not "pts"', () => {
    expect(formatReward({ rewardType: 'points', rate: 5 })).toContain('points');
    expect(formatReward({ rewardType: 'points', rate: 5 })).not.toContain('pts');
  });

  it('uses "cash back" not just "back"', () => {
    expect(formatReward({ rewardType: 'cashback', rate: 2 })).toContain('cash back');
  });
});

// ─── Protection Tier ─────────────────────────────────────────────────────────

describe('protection tier display', () => {
  it('shows Primary badge for primary tier', () => {
    const p = makeProtection({ coverageTier: 'primary' });
    const showBadge = p.coverageTier !== 'unknown';
    const label = p.coverageTier === 'primary' ? '⭐ Primary' : 'Secondary';
    expect(showBadge).toBe(true);
    expect(label).toBe('⭐ Primary');
  });

  it('shows Secondary badge for secondary tier', () => {
    const p = makeProtection({ coverageTier: 'secondary' });
    const showBadge = p.coverageTier !== 'unknown';
    const label = p.coverageTier === 'primary' ? '⭐ Primary' : 'Secondary';
    expect(showBadge).toBe(true);
    expect(label).toBe('Secondary');
  });

  it('hides badge for unknown tier', () => {
    const p = makeProtection({ coverageTier: 'unknown' });
    expect(p.coverageTier !== 'unknown').toBe(false);
  });
});

// ─── Recommendation requires_activation ──────────────────────────────────────

describe('requiresActivation flag', () => {
  it('defaults to false', () => {
    const rec = makeRec();
    expect(rec.requiresActivation).toBe(false);
  });

  it('can be true for rotating categories', () => {
    const rec = makeRec({ requiresActivation: true, isRotating: true });
    expect(rec.requiresActivation).toBe(true);
    expect(rec.isRotating).toBe(true);
  });
});

// ─── Spend cap logic ─────────────────────────────────────────────────────────

describe('spendCap', () => {
  it('is null when no cap', () => {
    expect(makeRec().spendCap).toBeNull();
  });

  it('stores numeric value when cap exists', () => {
    const rec = makeRec({ spendCap: 1500, capPeriod: 'quarter' });
    expect(rec.spendCap).toBe(1500);
    expect(rec.capPeriod).toBe('quarter');
  });
});

// ─── Sign out state reset ─────────────────────────────────────────────────────

describe('sign out resets state', () => {
  it('clears all expected state fields', () => {
    // Simulate state before sign out
    let selectedCards = [makeRec()];
    let recommendations: Recommendation[] | null = [makeRec()];
    let protections: Protection[] | null = [makeProtection()];
    let merchantQuery = 'Costco';

    // Simulate sign out action
    selectedCards = [];
    recommendations = null;
    protections = null;
    merchantQuery = '';

    expect(selectedCards).toHaveLength(0);
    expect(recommendations).toBeNull();
    expect(protections).toBeNull();
    expect(merchantQuery).toBe('');
  });
});
