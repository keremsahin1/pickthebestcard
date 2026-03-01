/**
 * Bank of America Customized Cash Rewards — 3% user-selected category
 * Source: https://www.bankofamerica.com/credit-cards/products/cash-back-credit-card/
 *
 * Users pick 1 category each month for 3% (6% first year).
 * Crawler extracts the available choice categories.
 */
const { upsertRotatingBenefit } = require('../db');
const { parseBenefits } = require('../parse');

const URL = 'https://www.bankofamerica.com/credit-cards/products/cash-back-credit-card/';
const CARD_NAME = 'Bank of America Customized Cash Rewards';
const RATE = 3; // standard rate (6% first year, but 3% is the ongoing rate)
const SPEND_CAP = 2500;
const CAP_PERIOD = 'quarter';

const CATEGORY_MAP = {
  'gas': 'Gas & EV Charging',
  'ev charging': 'Gas & EV Charging',
  'online shopping': 'Online Shopping',
  'cable': 'Streaming Services',
  'internet': 'Streaming Services',
  'streaming': 'Streaming Services',
  'dining': 'Dining & Restaurants',
  'travel': 'Travel',
  'drug store': 'Drugstores & Pharmacy',
  'drugstore': 'Drugstores & Pharmacy',
  'pharmacy': 'Drugstores & Pharmacy',
  'home improvement': 'Home Improvement',
  'furnishing': 'Home Improvement',
};

function normalizeCategory(raw) {
  const lower = raw.toLowerCase();
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

  // Find the categories listed after "Choose which category you want to earn"
  const blockMatch = text.match(/Choose which category[^:]*:([\s\S]+?)(?:After the first year|Learn more about|Automatic 2%)/i);
  if (!blockMatch) return results;

  const block = blockMatch[1];
  const lines = block.split(/[;,\n]/).map(l => l.trim()).filter(l => l.length > 3 && l.length < 60);

  for (const line of lines) {
    if (/earn|cash back|purchase|fee|first year|intro|bonus/i.test(line)) continue;
    const category = normalizeCategory(line);
    if (category) {
      results.push({ category, validFrom: dates.from, validUntil: dates.until, notes: 'BofA Customized Cash 3% choice category (user selects monthly)' });
    }
  }

  return results;
}

async function crawl(page) {
  console.log(`\n📋 Crawling BofA Customized Cash Rewards categories...`);
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);

  const rawText = await page.evaluate(() => document.body.innerText);
  let benefits = parseText(rawText);

  if (benefits.length === 0) {
    const parsed = await parseBenefits(rawText, 'Bank of America Customized Cash Rewards 3% choice category options');
    if (parsed && parsed.length > 0) benefits = parsed;
  }

  // Deduplicate
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

  console.log(`  → ${count} BofA Customized Cash categories updated`);
  return count;
}

module.exports = { crawl };
