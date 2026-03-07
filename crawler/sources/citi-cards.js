/**
 * Citi Cards Crawler
 * Individual card pages at citi.com/credit-cards/{slug} load fine.
 * Extracts fixed benefits from all Citi cards in DB.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env.local') });
const { neon } = require('../node_modules/@neondatabase/serverless');
const { parseFixedBenefits, parseProtections } = require('../parse');
const { upsertProtection } = require('../db');

const sql = neon(process.env.DATABASE_URL);

async function extractAllBenefits(page) {
  const cards = await sql`
    SELECT id, name, benefits_url FROM cards
    WHERE issuer = 'Citi' AND benefits_url IS NOT NULL
      AND name NOT IN ('Citi Simplicity', 'Citi Diamond Preferred')  -- no rewards cards
    ORDER BY name
  `;

  let total = 0;
  for (const card of cards) {
    // Citi Custom Cash is handled by the dedicated citi-custom-cash crawler
    if (card.name === 'Citi Custom Cash') {
      console.log(`  ⏭️  ${card.name} — handled by citi-custom-cash crawler`);
      continue;
    }

    console.log(`\n  📄 ${card.name}`);
    try {
      await page.goto(card.benefits_url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2500);
      const rawText = await page.locator('body').innerText().catch(() => '');
      if (rawText.length < 1000) { console.log(`    ⚠️  Page too short (${rawText.length}), skipping`); continue; }

      const benefits = await parseFixedBenefits(rawText, `Citi credit card: ${card.name}`);
      if (!benefits.length) { console.log(`    ℹ️  No benefits extracted`); continue; }

      await sql`DELETE FROM card_benefits WHERE card_id = ${card.id} AND valid_from IS NULL AND valid_until IS NULL`;

      for (const b of benefits) {
        if (!b.category || b.rate == null) continue;
        await sql`INSERT INTO categories (name, icon) VALUES (${b.category}, '🏷️') ON CONFLICT (name) DO NOTHING`;
        const cats = await sql`SELECT id FROM categories WHERE name = ${b.category}`;
        if (!cats.length) continue;
        const catId = cats[0].id;

        // Special case: Costco Anywhere Visa gas benefit must be split:
        //   5% merchant-specific at Costco Gas, 4% category-level for all other gas stations.
        // The LLM sees "5% at Costco, 4% elsewhere" and returns a single 5% Gas Stations benefit.
        if (card.name === 'Costco Anywhere Visa' && b.category === 'Gas Stations' && b.rate === 5) {
          const [costcoGas] = await sql`SELECT id FROM merchants WHERE name = 'Costco Gas'`;
          if (costcoGas) {
            await sql`INSERT INTO card_benefits (card_id, merchant_id, rate, benefit_type, notes, spend_cap, cap_period)
              VALUES (${card.id}, ${costcoGas.id}, 5, 'cashback', '5% cash back on gas at Costco (combined $7,000/year with other gas, then 1%)', 7000, 'year')`;
            console.log(`    ✓ Costco Gas (merchant) @ 5%`);
          }
          await sql`INSERT INTO card_benefits (card_id, category_id, rate, benefit_type, notes, spend_cap, cap_period)
            VALUES (${card.id}, ${catId}, 4, 'cashback', '4% cash back on eligible gas and EV charging (combined $7,000/year with Costco gas, then 1%)', 7000, 'year')`;
          console.log(`    ✓ Gas Stations (category) @ 4%`);
          total += 2;
          continue;
        }

        await sql`INSERT INTO card_benefits (card_id, category_id, rate, benefit_type, notes) VALUES (${card.id}, ${catId}, ${b.rate}, ${b.type ?? 'cashback'}, ${b.notes ?? null})`;
        console.log(`    ✓ ${b.category} @ ${b.rate}${b.type === 'cashback' ? '%' : 'x'}`);
        total++;
      }

      // Extract protections
      const protections = await parseProtections(rawText, `Citi credit card: ${card.name}`);
      for (const p of protections) {
        if (!p.protectionType || !p.coverageDetails) continue;
        await upsertProtection({ cardId: card.id, protectionType: p.protectionType, coverageDetails: p.coverageDetails, notes: p.notes });
      }
    } catch (e) {
      console.log(`    ❌ ${e.message.slice(0, 80)}`);
    }
  }
  return total;
}

async function crawl(page) {
  console.log(`\n📋 Crawling all Citi cards...`);
  const total = await extractAllBenefits(page);
  console.log(`\n  → ${total} fixed benefits updated across all Citi cards`);
  return total;
}

module.exports = { crawl };
