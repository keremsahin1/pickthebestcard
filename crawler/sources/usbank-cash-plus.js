/**
 * US Bank Cash+ Visa — 5% user-selected categories
 * Source: https://www.usbank.com/credit-cards/cash-plus-visa-signature-credit-card.html
 *
 * Note: Users pick 2 categories each quarter. The crawler extracts available
 * 5% categories so the DB reflects what's currently eligible.
 */
const { upsertRotatingBenefit } = require('../db');
const { parseBenefits } = require('../parse');

const URL = 'https://www.usbank.com/credit-cards/cash-plus-visa-signature-credit-card.html';
const CARD_NAME = 'US Bank Cash+';
const RATE = 5;
const SPEND_CAP = 2000;
const CAP_PERIOD = 'quarter';

// Known 5% eligible categories from US Bank Cash+
// These rarely change but the crawler verifies them
const KNOWN_CATEGORIES = [
  'Home Improvement',
  'Streaming Services',
  'Fitness Clubs',
  'Drugstores & Pharmacy',
  'Dining & Restaurants',
  'Entertainment',
  'Department Stores',
  'Online Shopping',
];

const CATEGORY_MAP = {
  'home improvement': 'Home Improvement',
  'select clothing': 'Online Shopping',
  'clothing stores': 'Online Shopping',
  'streaming': 'Streaming Services',
  'tv, internet': 'Streaming Services',
  'gym': 'Fitness Clubs',
  'fitness': 'Fitness Clubs',
  'sporting goods': 'Online Shopping',
  'drug store': 'Drugstores & Pharmacy',
  'drugstore': 'Drugstores & Pharmacy',
  'fast food': 'Dining & Restaurants',
  'restaurant': 'Dining & Restaurants',
  'dining': 'Dining & Restaurants',
  'department store': 'Department Stores',
  'cell phone': 'Online Shopping',
  'electronics': 'Online Shopping',
  'furniture': 'Home Improvement',
  'ground transportation': 'Travel',
  'travel': 'Travel',
  'entertainment': 'Entertainment',
};

function normalizeCategory(raw) {
  const lower = raw.toLowerCase();
  for (const [key, val] of Object.entries(CATEGORY_MAP)) {
    if (lower.includes(key)) return val;
  }
  return null;
}

function getQuarterDates() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  if (month <= 3)  return { from: `${year}-01-01`, until: `${year}-03-31` };
  if (month <= 6)  return { from: `${year}-04-01`, until: `${year}-06-30` };
  if (month <= 9)  return { from: `${year}-07-01`, until: `${year}-09-30` };
  return { from: `${year}-10-01`, until: `${year}-12-31` };
}

function parseText(text) {
  const results = [];
  const dates = getQuarterDates();

  // Find "More 5% cash back categories" section
  const blockMatch = text.match(/More 5% cash back categories([\s\S]+?)(?:2% cash back|Additional 5%|Choose your categories)/i);
  const block = blockMatch ? blockMatch[1] : text;

  const lines = block.split('\n').map(l => l.trim()).filter(l => l.length > 2 && l.length < 60);
  for (const line of lines) {
    if (/^\d|select|pick|first|second|choose|earn|cash back|category|calculator/i.test(line)) continue;
    const category = normalizeCategory(line);
    if (category) {
      results.push({ category, validFrom: dates.from, validUntil: dates.until, notes: `US Bank Cash+ eligible 5% category (user must select)` });
    }
  }

  // If parsing found nothing, fall back to known categories
  if (results.length === 0) {
    for (const cat of KNOWN_CATEGORIES) {
      results.push({ category: cat, validFrom: dates.from, validUntil: dates.until, notes: 'US Bank Cash+ eligible 5% category (user must select)' });
    }
  }

  return results;
}

async function crawl(page) {
  console.log(`\n📋 Crawling US Bank Cash+ categories...`);
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);

  const rawText = await page.evaluate(() => document.body.innerText);
  let benefits = parseText(rawText);

  if (benefits.length === 0) {
    const parsed = await parseBenefits(rawText, 'US Bank Cash+ Visa 5% user-selected categories');
    if (parsed && parsed.length > 0) benefits = parsed;
  }

  const seen = new Set();
  let count = 0;
  for (const b of benefits) {
    const key = `${b.category}|${b.validFrom}`;
    if (seen.has(key)) continue;
    seen.add(key);

    upsertRotatingBenefit({
      cardName: CARD_NAME,
      categoryName: b.category,
      rate: RATE,
      validFrom: b.validFrom,
      validUntil: b.validUntil,
      notes: b.notes,
      requiresActivation: true,
      spendCap: SPEND_CAP,
      capPeriod: CAP_PERIOD,
    });
    count++;
  }

  console.log(`  → ${count} US Bank Cash+ categories updated`);
  return count;
}

module.exports = { crawl };
