/**
 * Benefit parser — LLM-based if OPENAI_API_KEY is set, DOM-based fallback otherwise.
 */

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

/**
 * Parse raw page text into structured rotating benefits.
 * Returns array of: { category, validFrom, validUntil, notes }
 */
async function parseBenefits(rawText, context) {
  if (OPENAI_API_KEY) {
    return parseBenefitsLLM(rawText, context);
  }
  console.log('  ℹ️  No OPENAI_API_KEY — using DOM extraction (set key for smarter parsing)');
  return null; // caller falls back to DOM extraction
}

/**
 * Parse raw page text into structured FIXED (non-rotating) benefits.
 * Returns array of: { category, rate, type, notes }
 */
async function parseFixedBenefits(rawText, context) {
  if (!OPENAI_API_KEY) {
    console.log('  ℹ️  No OPENAI_API_KEY — skipping fixed benefit extraction');
    return [];
  }

  const prompt = `You are extracting credit card reward rates from an official card product page.

Context: ${context}

Page content:
${rawText.slice(0, 6000)}

Extract all FIXED (non-rotating, always-on) reward rates per spend category.
Do NOT include rotating/quarterly bonus categories or sign-up bonuses.

CRITICAL RULES about merchant-specific vs category-wide benefits:

1. When a benefit applies only to a SPECIFIC brand (hotel chain, airline, store), set "merchant" to that brand name.
   DO NOT use a category like "Hotels" or "Airlines" for loyalty card bonuses.
   Examples:
   - "9x points at Hyatt hotels" → merchant: "Hyatt", NOT category: "Hotels"
   - "26x points at IHG Hotels and Resorts" → merchant: "InterContinental Hotels Group (IHG)", NOT category: "Hotels"
   - "6x points at Marriott hotels" → merchant: "Marriott", NOT category: "Hotels"
   - "10x miles at United Airlines" → merchant: "United Airlines", NOT category: "Travel"
   - "5x at Hilton properties" → merchant: "Hilton", NOT category: "Hotels"
   - "5% at Costco gas stations, 4% elsewhere" → TWO entries: merchant: "Costco Gas" at 5%, then category: "Gas Stations" at 4%
   - "5% back at Amazon.com" → merchant: "Amazon", category: "Online Shopping" (Amazon is a merchant, NOT a category)
   - "5% back at Whole Foods Market" → merchant: "Whole Foods Market", category: "Groceries"

2. Only use a category (no merchant) when the benefit truly applies to ALL merchants in that category.
   Example: "3x on all dining" → category: "Dining & Restaurants", merchant: null

For each benefit, return JSON with:
- category: one of: "Groceries", "Dining & Restaurants", "Gas Stations", "Online Shopping", "Travel", "Hotels", "Streaming Services", "Drugstores & Pharmacy", "Wholesale Clubs", "Home Improvement", "General / Everything Else"
- merchant: string or null — the specific merchant/brand name when the rate is brand-specific (see rules above)
- rate: number (e.g. 3 for 3x points or 3% cashback)
- type: "cashback" or "points"
- notes: string or null
- spendCap: number or null — annual/period spend cap in dollars (e.g. 7000 for $7,000/year)
- capPeriod: "year" or "quarter" or null

Return ONLY a JSON array, no explanation. Example:
[
  {"category":"Hotels","merchant":"Hyatt","rate":9,"type":"points","notes":"Up to 9x total points at Hyatt hotels","spendCap":null,"capPeriod":null},
  {"category":"Online Shopping","merchant":"Amazon","rate":5,"type":"cashback","notes":"5% back at Amazon.com","spendCap":null,"capPeriod":null},
  {"category":"Dining & Restaurants","merchant":null,"rate":2,"type":"points","notes":"2x on dining worldwide","spendCap":null,"capPeriod":null},
  {"category":"Gas Stations","merchant":"Costco Gas","rate":5,"type":"cashback","notes":"5% at Costco gas","spendCap":7000,"capPeriod":"year"},
  {"category":"Gas Stations","merchant":null,"rate":4,"type":"cashback","notes":"4% at other gas stations","spendCap":7000,"capPeriod":"year"}
]`;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }], temperature: 0 }),
  });

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content ?? '[]';
  try {
    return JSON.parse(text.replace(/```json|```/g, '').trim());
  } catch {
    console.warn('  ⚠️  LLM returned unparseable JSON');
    return [];
  }
}

async function parseBenefitsLLM(rawText, context) {
  const prompt = `You are extracting credit card rotating cashback benefit data from a webpage.

Context: ${context}

Page content (may be partial):
${rawText.slice(0, 6000)}

Extract all rotating cashback categories. For each, return JSON with:
- category: string (e.g. "Groceries", "Gas & EV Charging", "Online Shopping", "Restaurants")
- validFrom: "YYYY-MM-DD" (quarter start date)
- validUntil: "YYYY-MM-DD" (quarter end date)
- notes: string or null (any extra context)

Return ONLY a JSON array, no explanation. Example:
[{"category":"Groceries","validFrom":"2025-01-01","validUntil":"2025-03-31","notes":null}]`;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
    }),
  });

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content ?? '[]';
  try {
    return JSON.parse(text.replace(/```json|```/g, '').trim());
  } catch {
    console.warn('  ⚠️  LLM returned unparseable JSON:', text.slice(0, 200));
    return [];
  }
}

/**
 * Parse raw page text to extract card protection benefits.
 * Returns array of: { protectionType, coverageDetails, notes }
 */
async function parseProtections(rawText, context) {
  if (!OPENAI_API_KEY) {
    console.log('  ℹ️  No OPENAI_API_KEY — skipping protection extraction');
    return [];
  }

  const prompt = `You are extracting card protection benefits from an official credit card product page.

Context: ${context}

Page content:
${rawText.slice(0, 12000)}

Extract ONLY these two protection types if present:
1. Car rental insurance / auto rental collision damage waiver (CDW)
2. Extended warranty protection

For each protection found, return JSON with:
- protectionType: "car_rental_insurance" or "extended_warranty"
- coverageDetails: copy the EXACT sentence(s) from the page describing the coverage. Do not summarize or paraphrase. Include the full description as it appears on the page (e.g. "Coverage is primary and provides reimbursement up to $75,000 for theft and collision damage for most rental vehicles in the U.S. and abroad"). The word "primary" or "secondary" must appear in this text if it is mentioned on the page.
- notes: string with any important conditions/caveats, or null (e.g. "Must decline rental company CDW", "Original warranty must be 3 years or less")

Return ONLY a JSON array, no explanation. If neither protection is found, return [].
Example:
[{"protectionType":"car_rental_insurance","coverageDetails":"Primary coverage up to $75,000","notes":"Must decline the rental company's collision damage waiver"},{"protectionType":"extended_warranty","coverageDetails":"Extends manufacturer warranty by 1 additional year","notes":"Original warranty must be 3 years or less. Max $10,000 per claim."}]`;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }], temperature: 0 }),
  });

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content ?? '[]';
  try {
    return JSON.parse(text.replace(/```json|```/g, '').trim());
  } catch {
    console.warn('  ⚠️  LLM returned unparseable JSON for protections');
    return [];
  }
}

module.exports = { parseBenefits, parseFixedBenefits, parseProtections };
