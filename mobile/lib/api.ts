const BASE_URL = 'https://pickthebestcard.com';

export interface Card {
  id: number;
  name: string;
  issuer: string;
  base_rate: number;
  reward_type: string;
  points_value: number;
  color: string;
}

export interface Merchant {
  id: number;
  name: string;
  category_name: string;
  category_icon: string;
}

export interface Category {
  id: number;
  name: string;
  icon: string;
}

export interface Recommendation {
  cardId: number;
  cardName: string;
  issuer: string;
  color: string;
  rate: number;
  effectiveRate: number;
  benefitType: string;
  rewardType: string;
  category: string | null;
  notes: string | null;
  spendCap: number | null;
  capPeriod: string | null;
  requiresActivation: boolean;
  validUntil: string | null;
  isRotating: boolean;
  baseRate: number;
  benefitsUrl: string | null;
}

export interface MerchantMatch {
  merchantId: number | null;
  merchantName: string;
  categoryId: number | null;
  categoryName: string | null;
  isOnline: boolean;
}

export async function fetchCards(): Promise<Card[]> {
  const res = await fetch(`${BASE_URL}/api/cards`);
  return res.json();
}

export async function fetchCategories(): Promise<Category[]> {
  const res = await fetch(`${BASE_URL}/api/categories`);
  return res.json();
}

export async function searchMerchants(q: string): Promise<Merchant[]> {
  if (q.length < 1) return [];
  const res = await fetch(`${BASE_URL}/api/merchants?q=${encodeURIComponent(q)}`);
  return res.json();
}

export async function getRecommendations(
  cardIds: number[],
  merchant: string,
  categoryId?: number | null
): Promise<{ recommendations: Recommendation[]; merchant: MerchantMatch }> {
  const res = await fetch(`${BASE_URL}/api/recommend`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cardIds, merchant, categoryId }),
  });
  return res.json();
}
