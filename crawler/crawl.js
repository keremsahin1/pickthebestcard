#!/usr/bin/env node
/**
 * CardWise Benefit Crawler
 * Scrapes card issuer pages and updates the benefits database.
 *
 * Usage:
 *   node crawler/crawl.js              # crawl all sources
 *   node crawler/crawl.js discover     # crawl specific source
 *   OPENAI_API_KEY=sk-... node crawler/crawl.js  # with LLM parsing
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });

const { chromium } = require('./node_modules/playwright-extra');
const StealthPlugin = require('./node_modules/puppeteer-extra-plugin-stealth');
chromium.use(StealthPlugin());

const sources = {
  discover: require('./sources/discover'),
  'chase-cards': require('./sources/chase-cards'), // discovers all Chase cards + extracts benefits
  'usbank-cash-plus': require('./sources/usbank-cash-plus'),
  'bofa-customized-cash': require('./sources/bofa-customized-cash'),
  'citi-custom-cash': require('./sources/citi-custom-cash'),
};

const LOG_FILE = require('path').join(__dirname, '..', 'crawler.log');
const fs = require('fs');

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + '\n');
}

async function run() {
  const target = process.argv[2]; // optional: run only one source
  const toRun = target ? { [target]: sources[target] } : sources;

  if (target && !sources[target]) {
    console.error(`Unknown source: ${target}. Available: ${Object.keys(sources).join(', ')}`);
    process.exit(1);
  }

  log(`Starting crawler (sources: ${Object.keys(toRun).join(', ')})`);

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });

  let totalUpdated = 0;

  try {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    });
    const page = await context.newPage();

    for (const [name, source] of Object.entries(toRun)) {
      try {
        log(`Running source: ${name}`);
        const count = await source.crawl(page);
        totalUpdated += count;
        log(`${name}: ${count} benefits updated`);
      } catch (err) {
        log(`❌ ${name} failed: ${err.message}`);
      }
      await page.waitForTimeout(1000);
    }
  } finally {
    await browser.close();
  }

  log(`✅ Crawler done. ${totalUpdated} benefits updated total.`);
}

run().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
