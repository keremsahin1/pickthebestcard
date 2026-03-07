import { describe, it, expect } from 'vitest';
import { formatReward, formatEffectiveValue } from './format';

describe('formatReward', () => {
  it('formats integer cash back', () => {
    expect(formatReward({ rewardType: 'cashback', rate: 3 })).toBe('3% cash back');
  });

  it('formats fractional cash back', () => {
    expect(formatReward({ rewardType: 'cashback', rate: 1.5 })).toBe('1.5% cash back');
  });

  it('formats 2% cash back (e.g. Citi Double Cash)', () => {
    expect(formatReward({ rewardType: 'cashback', rate: 2 })).toBe('2% cash back');
  });

  it('formats 5% cash back (e.g. Costco Anywhere Visa at Costco Gas)', () => {
    expect(formatReward({ rewardType: 'cashback', rate: 5 })).toBe('5% cash back');
  });

  it('formats integer points', () => {
    expect(formatReward({ rewardType: 'points', rate: 3 })).toBe('3x points');
  });

  it('formats 1x points (base rate)', () => {
    expect(formatReward({ rewardType: 'points', rate: 1 })).toBe('1x points');
  });

  it('formats high points multiplier', () => {
    expect(formatReward({ rewardType: 'points', rate: 10 })).toBe('10x points');
  });

  it('uses "points" not "pts"', () => {
    expect(formatReward({ rewardType: 'points', rate: 5 })).not.toContain('pts');
  });

  it('uses "cash back" not just "back"', () => {
    expect(formatReward({ rewardType: 'cashback', rate: 2 })).not.toBe('2% back');
  });

  it('contains % sign for cashback', () => {
    expect(formatReward({ rewardType: 'cashback', rate: 3 })).toContain('%');
  });

  it('contains x for points', () => {
    expect(formatReward({ rewardType: 'points', rate: 3 })).toContain('x');
  });
});

describe('formatEffectiveValue', () => {
  it('returns null for cashback', () => {
    expect(formatEffectiveValue({ rewardType: 'cashback', effectiveRate: 3 })).toBeNull();
  });

  it('returns null for 0% cashback', () => {
    expect(formatEffectiveValue({ rewardType: 'cashback', effectiveRate: 0 })).toBeNull();
  });

  it('returns estimated % string for points', () => {
    expect(formatEffectiveValue({ rewardType: 'points', effectiveRate: 6 })).toBe('≈ 6.0% value');
  });

  it('handles fractional effective rate', () => {
    expect(formatEffectiveValue({ rewardType: 'points', effectiveRate: 2.5 })).toBe('≈ 2.5% value');
  });

  it('always shows one decimal place', () => {
    expect(formatEffectiveValue({ rewardType: 'points', effectiveRate: 4 })).toBe('≈ 4.0% value');
  });

  it('shows ≈ symbol', () => {
    expect(formatEffectiveValue({ rewardType: 'points', effectiveRate: 3 })).toContain('≈');
  });
});
