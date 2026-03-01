import { getDb } from '@/db/schema';

export interface CardRecommendation {
  cardId: number;
  cardName: string;
  issuer: string;
  color: string;
  rate: number;
  effectiveRate: number; // rate * points_value (normalized to cents per dollar)
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
}

export interface MerchantMatch {
  merchantId: number | null;
  merchantName: string;
  categoryId: number | null;
  categoryName: string | null;
}

export function findMerchant(query: string): MerchantMatch {
  const db = getDb();
  const q = query.toLowerCase().trim();

  // Exact name match
  let merchant = db.prepare(`
    SELECT m.id, m.name, m.category_id, c.name as category_name
    FROM merchants m
    LEFT JOIN categories c ON c.id = m.category_id
    WHERE LOWER(m.name) = ?
  `).get(q) as any;

  // Partial name match
  if (!merchant) {
    merchant = db.prepare(`
      SELECT m.id, m.name, m.category_id, c.name as category_name
      FROM merchants m
      LEFT JOIN categories c ON c.id = m.category_id
      WHERE LOWER(m.name) LIKE ?
      LIMIT 1
    `).get(`%${q}%`) as any;
  }

  // Domain match
  if (!merchant) {
    merchant = db.prepare(`
      SELECT m.id, m.name, m.category_id, c.name as category_name
      FROM merchants m
      LEFT JOIN categories c ON c.id = m.category_id
      WHERE LOWER(m.domain) LIKE ?
      LIMIT 1
    `).get(`%${q}%`) as any;
  }

  if (merchant) {
    return {
      merchantId: merchant.id,
      merchantName: merchant.name,
      categoryId: merchant.category_id,
      categoryName: merchant.category_name,
    };
  }

  return {
    merchantId: null,
    merchantName: query,
    categoryId: null,
    categoryName: null,
  };
}

export function getRecommendations(
  cardIds: number[],
  merchantQuery: string
): { recommendations: CardRecommendation[]; merchant: MerchantMatch } {
  const db = getDb();
  if (cardIds.length === 0) return { recommendations: [], merchant: findMerchant(merchantQuery) };

  const merchant = findMerchant(merchantQuery);
  const today = new Date().toISOString().split('T')[0];

  const results: CardRecommendation[] = [];

  for (const cardId of cardIds) {
    const card = db.prepare(`
      SELECT id, name, issuer, base_rate, reward_type, points_value, color
      FROM cards WHERE id = ?
    `).get(cardId) as any;

    if (!card) continue;

    // Find best benefit for this card at this merchant/category
    let bestBenefit: any = null;

    // 1. Merchant-specific benefit (highest priority)
    if (merchant.merchantId) {
      const mb = db.prepare(`
        SELECT cb.*, c.name as category_name
        FROM card_benefits cb
        LEFT JOIN categories c ON c.id = cb.category_id
        WHERE cb.card_id = ? AND cb.merchant_id = ?
          AND (cb.valid_from IS NULL OR cb.valid_from <= ?)
          AND (cb.valid_until IS NULL OR cb.valid_until >= ?)
        ORDER BY cb.rate DESC LIMIT 1
      `).get(cardId, merchant.merchantId, today, today) as any;
      if (mb) bestBenefit = mb;
    }

    // 2. Category benefit
    if (!bestBenefit && merchant.categoryId) {
      const cb = db.prepare(`
        SELECT cb.*, c.name as category_name
        FROM card_benefits cb
        LEFT JOIN categories c ON c.id = cb.category_id
        WHERE cb.card_id = ? AND cb.category_id = ?
          AND (cb.valid_from IS NULL OR cb.valid_from <= ?)
          AND (cb.valid_until IS NULL OR cb.valid_until >= ?)
        ORDER BY cb.rate DESC LIMIT 1
      `).get(cardId, merchant.categoryId, today, today) as any;
      if (cb) bestBenefit = cb;
    }

    const rate = bestBenefit ? bestBenefit.rate : card.base_rate;
    const effectiveRate = rate * (card.reward_type === 'points' ? card.points_value / 100 * 100 : 1);

    results.push({
      cardId: card.id,
      cardName: card.name,
      issuer: card.issuer,
      color: card.color,
      rate,
      effectiveRate: rate * (card.reward_type === 'points' ? card.points_value : 1),
      benefitType: bestBenefit?.benefit_type ?? 'cashback',
      rewardType: card.reward_type,
      category: bestBenefit?.category_name ?? merchant.categoryName,
      notes: bestBenefit?.notes ?? null,
      spendCap: bestBenefit?.spend_cap ?? null,
      capPeriod: bestBenefit?.cap_period ?? null,
      requiresActivation: bestBenefit?.requires_activation === 1,
      validUntil: bestBenefit?.valid_until ?? null,
      isRotating: !!(bestBenefit?.valid_from || bestBenefit?.valid_until),
      baseRate: card.base_rate,
    });
  }

  // Sort by effective rate descending
  results.sort((a, b) => b.effectiveRate - a.effectiveRate);

  return { recommendations: results, merchant };
}

export function getAllCards() {
  const db = getDb();
  return db.prepare('SELECT * FROM cards ORDER BY issuer, name').all();
}

export function searchMerchants(query: string) {
  const db = getDb();
  return db.prepare(`
    SELECT m.*, c.name as category_name, c.icon as category_icon
    FROM merchants m
    LEFT JOIN categories c ON c.id = m.category_id
    WHERE LOWER(m.name) LIKE ? OR LOWER(m.domain) LIKE ?
    ORDER BY m.name
    LIMIT 8
  `).all(`%${query.toLowerCase()}%`, `%${query.toLowerCase()}%`);
}
