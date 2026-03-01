/**
 * Citi Custom Cash Card — 5% on top eligible spend category
 * Source: https://www.citi.com/credit-cards/citi-custom-cash-credit-card
 *
 * Auto-applies to highest spend category each billing cycle — no activation needed.
 * Crawler extracts the list of eligible 5% categories.
 */
const { upsertRotatingBenefit } = require('../db');
const { parseBenefits } = require('../parse');

const URL = 'https://www.citi.com/credit-cards/citi-custom-cash-credit-card';
const CARD_NAME = 'Citi Custom Cash';
const RATE = 5;
const SPEND_CAP = 500;
const CAP_PERIOD = 'month';

const CATEGORY_MAP = {
  'restaurant': 'Dining & Restaurants',
  'dining': 'Dining & Restaurants',
  'gas station': 'Gas & EV Charging',
  'gas': 'Gas & EV Charging',
  'ev charging': 'Gas & EV Charging',
  'grocery': 'Groceries',
  'travel': 'Travel',
  'transit': 'Travel',
  'streaming': 'Streaming Services',
  'drugstore': 'Drugstores & Pharmacy',
  'drug store': 'Drugstores & Pharmacy',
  'pharmacy': 'Drugstores & Pharmacy',
  'home improvement': 'Home Improvement',
  'fitness': 'Fitness Clubs',
  'live entertainment': 'Entertainment',
  'entertainment': 'Entertainment',
};

function normalizeCategory(raw) {
  const lower = raw.toLowerCase().replace(/^select\s+/, '');
  for (const [key, val] of Object.entries(CATEGORY_MAP)) {
    if (lower.includes(key)) return val;
  }
  return null;
}

function getMonthDates() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return { from: `${year}-${month}-01`, until: `${year}-${month}-${lastDay}` };
}

function parseText(text) {
  const results = [];
  const dates = getMonthDates();

  // Key line: "5% eligible categories: Restaurants, gas stations, grocery stores, ..."
  const match = text.match(/5% eligible categories[:\s]+([^\n.]+)/i);
  if (!match) return results;

  const categoriesRaw = match[1];
  const parts = categoriesRaw.split(/,\s*/);

  for (const part of parts) {
    const category = normalizeCategory(part.trim());
    if (category) {
      results.push({
        category,
        validFrom: dates.from,
        validUntil: dates.until,
        notes: 'Citi Custom Cash 5% — auto-applies to top spend category, no activation needed',
      });
    }
  }

  return results;
}

async function crawl(page) {
  console.log(`\n📋 Crawling Citi Custom Cash eligible categories...`);
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);

  const rawText = await page.evaluate(() => document.body.innerText);
  let benefits = parseText(rawText);

  if (benefits.length === 0) {
    const parsed = await parseBenefits(rawText, 'Citi Custom Cash 5% eligible spend categories');
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
      requiresActivation: false, // auto-applies!
      spendCap: SPEND_CAP,
      capPeriod: CAP_PERIOD,
    });
    count++;
  }

  console.log(`  → ${count} Citi Custom Cash categories updated`);
  return count;
}

module.exports = { crawl };
