import type { Recommendation, Protection, MerchantMatch, Merchant, Category } from '@pickthebestcard/shared';
export type { Recommendation, Protection, MerchantMatch, Merchant, Category };

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

export async function fetchCards(): Promise<Card[]> {
  const res = await fetch(`${BASE_URL}/api/cards`);
  return res.json();
}

export async function fetchUserCards(accessToken: string): Promise<Card[]> {
  const res = await fetch(`${BASE_URL}/api/mobile/cards`, {
    headers: { 'x-google-token': accessToken },
  });
  return res.json();
}

export async function saveUserCard(accessToken: string, cardId: number): Promise<void> {
  await fetch(`${BASE_URL}/api/mobile/cards`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-google-token': accessToken },
    body: JSON.stringify({ cardId }),
  });
}

export async function deleteUserCard(accessToken: string, cardId: number): Promise<void> {
  await fetch(`${BASE_URL}/api/mobile/cards`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', 'x-google-token': accessToken },
    body: JSON.stringify({ cardId }),
  });
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
): Promise<{ recommendations: Recommendation[]; merchant: MerchantMatch; protections?: Protection[] }> {
  const res = await fetch(`${BASE_URL}/api/recommend`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cardIds, merchant, categoryId }),
  });
  return res.json();
}
