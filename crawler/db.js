/**
 * Crawler DB helpers — read/write card benefits into Neon Postgres
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });
const { neon } = require('./node_modules/@neondatabase/serverless');

const sql = neon(process.env.DATABASE_URL);

async function getCardId(name) {
  const rows = await sql`SELECT id FROM cards WHERE name = ${name}`;
  return rows[0]?.id ?? null;
}

async function getCategoryId(name) {
  const rows = await sql`SELECT id FROM categories WHERE name = ${name}`;
  return rows[0]?.id ?? null;
}

async function ensureCategory(name) {
  await sql`INSERT INTO categories (name, icon) VALUES (${name}, '🏷️') ON CONFLICT (name) DO NOTHING`;
  return getCategoryId(name);
}

/**
 * Upsert a rotating benefit into Neon.
 */
async function upsertRotatingBenefit({ cardName, categoryName, rate, validFrom, validUntil, notes, requiresActivation, spendCap, capPeriod }) {
  const cardId = await getCardId(cardName);
  if (!cardId) { console.warn(`  ⚠️  Card not found: ${cardName}`); return; }

  let categoryId = await getCategoryId(categoryName);
  if (!categoryId) categoryId = await ensureCategory(categoryName);
  if (!categoryId) { console.warn(`  ⚠️  Could not create category: ${categoryName}`); return; }

  // Remove existing entry for same card+category+period to avoid duplicates
  await sql`
    DELETE FROM card_benefits
    WHERE card_id = ${cardId} AND category_id = ${categoryId}
      AND valid_from = ${validFrom} AND valid_until = ${validUntil}
  `;

  await sql`
    INSERT INTO card_benefits (card_id, category_id, rate, benefit_type, spend_cap, cap_period, notes, valid_from, valid_until, requires_activation)
    VALUES (${cardId}, ${categoryId}, ${rate}, 'cashback', ${spendCap ?? null}, ${capPeriod ?? null}, ${notes ?? null}, ${validFrom ?? null}, ${validUntil ?? null}, ${requiresActivation ?? false})
  `;

  console.log(`  ✓ ${cardName} → ${categoryName} @ ${rate}% (${validFrom} – ${validUntil})`);
}

/**
 * Upsert a card protection benefit.
 * Replaces existing entry for same card + protection type.
 */
async function upsertProtection({ cardId, protectionType, coverageDetails, notes }) {
  const lower = (coverageDetails ?? '').toLowerCase();
  const tier = lower.includes('primary') ? 'primary' : lower.includes('secondary') ? 'secondary' : 'unknown';

  await sql`DELETE FROM card_protections WHERE card_id = ${cardId} AND protection_type = ${protectionType}`;
  await sql`
    INSERT INTO card_protections (card_id, protection_type, coverage_details, notes, coverage_tier)
    VALUES (${cardId}, ${protectionType}, ${coverageDetails}, ${notes ?? null}, ${tier})
  `;
  console.log(`  🛡️  ${protectionType} [${tier}] → ${coverageDetails}`);
}

module.exports = { getCardId, getCategoryId, upsertRotatingBenefit, upsertProtection };
