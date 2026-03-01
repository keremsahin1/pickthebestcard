/**
 * NerdWallet Rotating Categories — Discover, Chase Freedom Flex, Citi Dividend
 * Source: https://www.nerdwallet.com/credit-cards/learn/current-credit-card-bonus-categories
 *
 * One page gives current + historical quarterly data for all three cards.
 * This replaces the individual Discover and Chase Freedom Flex crawlers.
 */
const { upsertRotatingBenefit } = require('../db');
const { parseBenefits } = require('../parse');

const URL = 'https://www.nerdwallet.com/credit-cards/learn/current-credit-card-bonus-categories';

const CARD_MAP = {
  'discover': 'Discover it Cash Back',
  'chase': 'Chase Freedom Flex',
  'citi dividend': 'Citi Dividend Card',
};

const CATEGORY_MAP = {
  'grocery store': 'Groceries',
  'groceries': 'Groceries',
  'supermarket': 'Groceries',
  'wholesale club': 'Wholesale Clubs',
  'wholesale': 'Wholesale Clubs',
  'streaming service': 'Streaming Services',
  'streaming': 'Streaming Services',
  'restaurant': 'Dining & Restaurants',
  'dining': 'Dining & Restaurants',
  'norwegian cruise': 'Travel',
  'cruise': 'Travel',
  'travel': 'Travel',
  'transit': 'Travel',
  'gas station': 'Gas & EV Charging',
  'gas': 'Gas & EV Charging',
  'ev charging': 'Gas & EV Charging',
  'amazon': 'Amazon',
  'target': 'Online Shopping',
  'walmart': 'Groceries',
  'drugstore': 'Drugstores & Pharmacy',
  'drug store': 'Drugstores & Pharmacy',
  'home improvement': 'Home Improvement',
  'fitness': 'Fitness Clubs',
  'gym': 'Fitness Clubs',
  'live entertainment': 'Entertainment',
  'entertainment': 'Entertainment',
  'paypal': 'PayPal',
  'department store': 'Department Stores',
  'digital wallet': 'Online Shopping',
  'instacart': 'Groceries',
  'utilities': 'General / Everything Else',
  'chase travel': 'Travel',
};

function normalizeCategory(raw) {
  const lower = raw.toLowerCase().trim()
    .replace(/^select\s+/, '')
    .replace(/\.$/, '')
    .replace(/\s+and\s+.+$/, ''); // strip "and EV charging" etc

  for (const [key, val] of Object.entries(CATEGORY_MAP)) {
    if (lower.includes(key)) return val;
  }
  return null;
}

const QUARTER_DATES = {
  'Q1': { start: '01-01', end: '03-31' },
  'Q2': { start: '04-01', end: '06-30' },
  'Q3': { start: '07-01', end: '09-30' },
  'Q4': { start: '10-01', end: '12-31' },
};

/**
 * Parse NerdWallet's structured text into benefit objects.
 * Returns: { cardName, category, validFrom, validUntil, notes }[]
 */
function parseText(text) {
  const results = [];
  const currentYear = new Date().getFullYear();

  // Split into card sections
  const sections = [
    { key: 'discover', marker: /Current Discover bonus categories/i, endMarker: /Current Chase bonus categories/i },
    { key: 'chase', marker: /Current Chase bonus categories/i, endMarker: /Current Citi Dividend/i },
    { key: 'citi dividend', marker: /Current Citi Dividend bonus categories/i, endMarker: /Categories from previous years/i },
  ];

  for (const { key, marker, endMarker } of sections) {
    const cardName = CARD_MAP[key];
    const startIdx = text.search(marker);
    const endIdx = text.search(endMarker);
    if (startIdx === -1) continue;

    const section = text.slice(startIdx, endIdx === -1 ? startIdx + 3000 : endIdx);

    // Find year header like "Discover bonus rewards categories for 2026"
    const yearMatch = section.match(/for (\d{4})/i);
    const year = yearMatch ? parseInt(yearMatch[1]) : currentYear;

    // Match quarter blocks: "Q1 (Jan. 1-March 31)\nCategory1.\nCategory2."
    const quarterPattern = /(Q[1-4])\s*\([^)]+\)\s*\n([\s\S]+?)(?=Q[1-4]\s*\(|$)/g;
    let qMatch;

    while ((qMatch = quarterPattern.exec(section)) !== null) {
      const quarter = qMatch[1];
      const body = qMatch[2];
      const dates = QUARTER_DATES[quarter];
      if (!dates) continue;

      const validFrom = `${year}-${dates.start}`;
      const validUntil = `${year}-${dates.end}`;

      // Skip TBD quarters
      if (/^TBD/i.test(body.trim())) continue;

      const lines = body.split('\n').map(l => l.trim()).filter(Boolean);

      for (const line of lines) {
        // Skip footnote lines, parenthetical hints, ratings, buttons
        if (/^\(|TBD|NerdWallet|APPLY|READ|Rates|How is/i.test(line)) continue;
        if (/only:|^plus$/i.test(line)) continue;

        // Handle compound lines like "Gas stations/EV charging; public transit; utilities."
        const parts = line.split(/[;\/,]/).map(p => p.trim());
        for (const part of parts) {
          const clean = part.replace(/\.$/, '').trim();
          if (!clean || clean.length < 3) continue;
          const category = normalizeCategory(clean);
          if (category) {
            results.push({
              cardName,
              category,
              validFrom,
              validUntil,
              notes: `${cardName} ${quarter} ${year}: ${line.replace(/\.$/, '')}`,
            });
          }
        }
      }
    }
  }

  return results;
}

async function crawl(page) {
  console.log(`\n📋 Crawling NerdWallet rotating categories (Discover + Chase + Citi Dividend)...`);
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);

  const rawText = await page.evaluate(() => document.body.innerText);
  let benefits = parseText(rawText);

  if (benefits.length === 0) {
    console.log('  DOM parsing found nothing, trying LLM...');
    const parsed = await parseBenefits(rawText, 'Rotating credit card bonus categories for Discover, Chase Freedom Flex, and Citi Dividend by quarter');
    if (parsed && parsed.length > 0) {
      benefits = parsed.map(b => ({ ...b, cardName: b.cardName ?? 'Discover it Cash Back' }));
    } else {
      console.warn('  ⚠️  Could not extract NerdWallet categories.');
      return 0;
    }
  }

  const seen = new Set();
  let count = 0;
  for (const b of benefits) {
    const key = `${b.cardName}|${b.category}|${b.validFrom}`;
    if (seen.has(key)) continue;
    seen.add(key);

    await upsertRotatingBenefit({
      cardName: b.cardName,
      categoryName: b.category,
      rate: 5,
      validFrom: b.validFrom,
      validUntil: b.validUntil,
      notes: b.notes,
      requiresActivation: b.cardName !== 'Citi Dividend Card', // Citi Dividend requires activation too
      spendCap: b.cardName === 'Citi Dividend Card' ? null : 1500,
      capPeriod: b.cardName === 'Citi Dividend Card' ? null : 'quarter',
    });
    count++;
  }

  console.log(`  → ${count} benefits updated across Discover, Chase Freedom Flex, Citi Dividend`);
  return count;
}

module.exports = { crawl };
