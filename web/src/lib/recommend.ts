import sql from '@/db/schema';
import { sortProtections } from '@/shared';

export interface CardRecommendation {
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

export interface CardProtection {
  cardId: number;
  cardName: string;
  issuer: string;
  color: string;
  protectionType: 'car_rental_insurance' | 'extended_warranty';
  coverageDetails: string;
  coverageTier: 'primary' | 'secondary' | 'unknown';
  notes: string | null;
  benefitsUrl: string | null;
}

export interface MerchantMatch {
  merchantId: number | null;
  merchantName: string;
  categoryId: number | null;
  categoryName: string | null;
  isOnline: boolean;
}

export async function findMerchant(query: string): Promise<MerchantMatch> {
  const q = query.toLowerCase().trim();

  let rows = await sql`
    SELECT m.id, m.name, m.category_id, m.is_online, c.name as category_name
    FROM merchants m LEFT JOIN categories c ON c.id = m.category_id
    WHERE LOWER(m.name) = ${q} LIMIT 1
  `;

  if (!rows.length) {
    rows = await sql`
      SELECT m.id, m.name, m.category_id, m.is_online, c.name as category_name
      FROM merchants m LEFT JOIN categories c ON c.id = m.category_id
      WHERE LOWER(m.name) LIKE ${'%' + q + '%'} OR LOWER(m.domain) LIKE ${'%' + q + '%'}
      LIMIT 1
    `;
  }

  if (rows.length) {
    const m = rows[0];
    return { merchantId: m.id, merchantName: m.name, categoryId: m.category_id, categoryName: m.category_name, isOnline: Boolean(m.is_online) };
  }

  // Treat unknown merchants ending in .com as online
  const isOnline = q.endsWith('.com') || q.includes('online');
  return { merchantId: null, merchantName: query, categoryId: null, categoryName: null, isOnline };
}

export async function getRecommendations(cardIds: number[], merchantQuery: string, overrideCategoryId: number | null = null) {
  if (!cardIds.length) return { recommendations: [], merchant: await findMerchant(merchantQuery) };

  const merchant = await findMerchant(merchantQuery);

  // If user provided a category override for unknown merchants, apply it
  if (overrideCategoryId && !merchant.merchantId) {
    const [cat] = await sql`SELECT id, name FROM categories WHERE id = ${overrideCategoryId}`;
    if (cat) {
      merchant.categoryId = cat.id;
      merchant.categoryName = cat.name;
    }
  }
  const today = new Date().toISOString().split('T')[0];
  const results: CardRecommendation[] = [];

  for (const cardId of cardIds) {
    const cards = await sql`SELECT * FROM cards WHERE id = ${cardId}`;
    const card = cards[0];
    if (!card) continue;

    let bestBenefit: Record<string, unknown> | null = null;

    // 1. Merchant-specific benefit
    if (merchant.merchantId) {
      const rows = await sql`
        SELECT cb.*, c.name as category_name FROM card_benefits cb
        LEFT JOIN categories c ON c.id = cb.category_id
        WHERE cb.card_id = ${cardId} AND cb.merchant_id = ${merchant.merchantId}
          AND (cb.valid_from IS NULL OR cb.valid_from <= ${today})
          AND (cb.valid_until IS NULL OR cb.valid_until >= ${today})
        ORDER BY cb.rate DESC LIMIT 1
      `;
      if (rows.length) bestBenefit = rows[0];
    }

    // 2. Category benefit (respect online_only flag)
    if (!bestBenefit && merchant.categoryId) {
      const rows = await sql`
        SELECT cb.*, c.name as category_name FROM card_benefits cb
        LEFT JOIN categories c ON c.id = cb.category_id
        WHERE cb.card_id = ${cardId} AND cb.category_id = ${merchant.categoryId}
          AND (cb.valid_from IS NULL OR cb.valid_from <= ${today})
          AND (cb.valid_until IS NULL OR cb.valid_until >= ${today})
          AND (cb.online_only = false OR ${merchant.isOnline} = true)
        ORDER BY cb.rate DESC LIMIT 1
      `;
      if (rows.length) bestBenefit = rows[0];
    }

    const rate = bestBenefit ? Number(bestBenefit.rate) : Number(card.base_rate);
    const effectiveRate = rate * (card.reward_type === 'points' ? Number(card.points_value) : 1);

    results.push({
      cardId: card.id,
      cardName: card.name,
      issuer: card.issuer,
      color: card.color,
      rate,
      effectiveRate,
      benefitType: (bestBenefit?.benefit_type as string) ?? 'cashback',
      rewardType: card.reward_type,
      category: (bestBenefit?.category_name as string) ?? merchant.categoryName,
      notes: (bestBenefit?.notes as string) ?? null,
      spendCap: bestBenefit?.spend_cap != null ? Number(bestBenefit.spend_cap) : null,
      capPeriod: (bestBenefit?.cap_period as string) ?? null,
      requiresActivation: Boolean(bestBenefit?.requires_activation),
      validUntil: (bestBenefit?.valid_until as string) ?? null,
      isRotating: !!(bestBenefit?.valid_from || bestBenefit?.valid_until),
      baseRate: Number(card.base_rate),
      benefitsUrl: card.benefits_url ?? null,
    });
  }

  results.sort((a, b) => b.effectiveRate - a.effectiveRate);

  // Fetch relevant protections based on category
  const protections: CardProtection[] = [];
  const categoryName = merchant.categoryName?.toLowerCase() ?? '';
  const merchantName = merchant.merchantName?.toLowerCase() ?? '';

  const isCarRental = categoryName.includes('travel') || categoryName.includes('transit') ||
    merchantName.includes('enterprise') || merchantName.includes('hertz') ||
    merchantName.includes('avis') || merchantName.includes('budget') ||
    merchantName.includes('national') || merchantName.includes('alamo') ||
    merchantName.includes('car rental') || merchantName.includes('rental car');

  const isElectronicsOrAppliance = categoryName.includes('electronics') ||
    categoryName.includes('home improvement') || categoryName.includes('furniture') ||
    categoryName.includes('appliance') || categoryName.includes('department') ||
    merchantName.includes('best buy') || merchantName.includes('apple') ||
    merchantName.includes('costco') || merchantName.includes('home depot') ||
    merchantName.includes('lowes') || merchantName.includes('walmart') ||
    merchantName.includes('target') || merchantName.includes('samsung') ||
    merchantName.includes('amazon');

  const protectionType = isCarRental ? 'car_rental_insurance' : isElectronicsOrAppliance ? 'extended_warranty' : null;

  if (protectionType && cardIds.length) {
    const rows = await sql`
      SELECT cp.*, c.name as card_name, c.issuer, c.color, c.benefits_url
      FROM card_protections cp
      JOIN cards c ON c.id = cp.card_id
      WHERE cp.card_id = ANY(${cardIds}::int[]) AND cp.protection_type = ${protectionType}
      ORDER BY
        CASE cp.coverage_tier WHEN 'primary' THEN 1 WHEN 'secondary' THEN 2 ELSE 3 END,
        c.name
    `;
    for (const r of rows) {
      protections.push({
        cardId: r.card_id,
        cardName: r.card_name,
        issuer: r.issuer,
        color: r.color,
        protectionType: r.protection_type,
        coverageDetails: r.coverage_details,
        coverageTier: r.coverage_tier ?? 'unknown',
        notes: r.notes,
        benefitsUrl: r.benefits_url,
      });
    }
  }

  return { recommendations: results, merchant, protections: sortProtections(protections) };
}

export async function getAllCards() {
  return sql`SELECT * FROM cards ORDER BY issuer, name`;
}

export async function searchMerchants(query: string) {
  const q = '%' + query.toLowerCase() + '%';
  return sql`
    SELECT m.*, c.name as category_name, c.icon as category_icon
    FROM merchants m LEFT JOIN categories c ON c.id = m.category_id
    WHERE LOWER(m.name) LIKE ${q} OR LOWER(m.domain) LIKE ${q}
    ORDER BY m.name LIMIT 8
  `;
}
