/**
 * Chase Cards Crawler
 * Step 1: Discover all Chase cards + URLs from the index page
 * Step 2: Visit each card page and extract benefit rates
 * Step 3: Update DB with URLs and benefits
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env.local') });
const { neon } = require('../node_modules/@neondatabase/serverless');
const { parseFixedBenefits } = require('../parse');

const INDEX_URL = 'https://creditcards.chase.com/all-credit-cards';
const sql = neon(process.env.DATABASE_URL);

// Cards we care about (personal, not business/airline/hotel co-brand)
// Maps Chase page card name patterns → our DB card names
const CARD_NAME_MAP = {
  'sapphire reserve': 'Chase Sapphire Reserve',
  'sapphire preferred': 'Chase Sapphire Preferred',
  'freedom unlimited': 'Chase Freedom Unlimited',
  'freedom flex': 'Chase Freedom Flex',
  'freedom rise': null, // not in our DB yet
  'prime visa': 'Amazon Prime Visa',
  'amazon visa': null, // basic amazon card, skip
  'doordash rewards': null,
  'instacart mastercard': null,
};

/**
 * Step 1: Scrape the index page and return { cardName, url }[]
 */
async function discoverCards(page) {
  console.log('  🔍 Discovering Chase cards from index...');
  await page.goto(INDEX_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);

  const cards = await page.evaluate(() => {
    const results = [];
    document.querySelectorAll('a[href]').forEach(a => {
      const href = a.href || '';
      const text = a.innerText?.trim().replace(/[®℠™]/g, '').trim();
      // Only individual product pages (not category pages)
      if (
        href.includes('creditcards.chase.com') &&
        a.closest('[class*="card"]') &&
        text && text.length > 5 && text.length < 80 &&
        !href.includes('?iCELL') === false // has iCELL = product link
      ) {
        // Clean URL — strip query params
        const cleanUrl = href.split('?')[0];
        results.push({ name: text, url: cleanUrl });
      }
    });
    return results;
  });

  // Deduplicate by URL
  const seen = new Set();
  return cards.filter(c => { if (seen.has(c.url)) return false; seen.add(c.url); return true; });
}

/**
 * Step 2: Update benefits_url for matched cards in DB
 */
async function updateCardUrls(cards) {
  let updated = 0;
  for (const { name, url } of cards) {
    const lower = name.toLowerCase();
    let dbName = null;

    for (const [pattern, mapped] of Object.entries(CARD_NAME_MAP)) {
      if (lower.includes(pattern)) { dbName = mapped; break; }
    }

    if (!dbName) continue;

    await sql`UPDATE cards SET benefits_url = ${url} WHERE name = ${dbName}`;
    console.log(`  🔗 ${dbName} → ${url}`);
    updated++;
  }
  return updated;
}

/**
 * Step 3: Extract fixed benefits from a card page using LLM
 * Returns: { category, rate, type, notes }[]
 */
async function extractCardBenefits(page, cardName, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2500);
  const rawText = await page.evaluate(() => document.body.innerText);

  if (!process.env.OPENAI_API_KEY) {
    console.log(`  ℹ️  No OPENAI_API_KEY — skipping benefit extraction for ${cardName}`);
    return [];
  }

  const context = `Chase credit card: ${cardName}. Extract fixed (non-rotating) reward rates per category.`;
  return await parseFixedBenefits(rawText, context);
}

async function crawl(page) {
  console.log(`\n📋 Crawling Chase cards index...`);

  // Step 1: Discover
  const discovered = await discoverCards(page);
  console.log(`  Found ${discovered.length} cards on index page`);

  // Step 2: Update URLs in DB
  const urlsUpdated = await updateCardUrls(discovered);
  console.log(`  Updated URLs for ${urlsUpdated} cards in DB`);

  // Step 3: For each card we track, crawl its benefit page
  const trackedCards = Object.entries(CARD_NAME_MAP)
    .filter(([, v]) => v !== null)
    .map(([, v]) => v);

  let benefitsUpdated = 0;

  for (const cardName of trackedCards) {
    // Get URL from DB
    const rows = await sql`SELECT id, benefits_url FROM cards WHERE name = ${cardName}`;
    const card = rows[0];
    if (!card?.benefits_url) {
      console.log(`  ⚠️  No URL found for ${cardName}, skipping`);
      continue;
    }

    // Skip rotating cards — handled by dedicated crawlers
    if (cardName.includes('Freedom Flex')) {
      console.log(`  ⏭️  Skipping ${cardName} (handled by chase-freedom-flex crawler)`);
      continue;
    }

    console.log(`\n  📄 Extracting benefits for ${cardName}...`);
    const benefits = await extractCardBenefits(page, cardName, card.benefits_url);

    for (const b of benefits) {
      if (!b.category || b.rate == null) continue;

      // Ensure category exists
      await sql`INSERT INTO categories (name, icon) VALUES (${b.category}, '🏷️') ON CONFLICT (name) DO NOTHING`;

      // Delete existing fixed (non-rotating) benefit for this card+category before reinserting
      await sql`
        DELETE FROM card_benefits
        WHERE card_id = ${card.id}
          AND category_id = (SELECT id FROM categories WHERE name = ${b.category})
          AND valid_from IS NULL AND valid_until IS NULL
      `;

      await sql`
        INSERT INTO card_benefits (card_id, category_id, rate, benefit_type, notes)
        SELECT ${card.id}, c.id, ${b.rate}, ${b.type ?? 'cashback'}, ${b.notes ?? null}
        FROM categories c WHERE c.name = ${b.category}
      `;
      console.log(`    ✓ ${cardName} → ${b.category} @ ${b.rate}${b.type === 'points' ? 'x' : '%'}`);
      benefitsUpdated++;
    }
  }

  console.log(`\n  → ${urlsUpdated} URLs + ${benefitsUpdated} benefits updated`);
  return urlsUpdated + benefitsUpdated;
}

module.exports = { crawl, discoverCards, updateCardUrls };
