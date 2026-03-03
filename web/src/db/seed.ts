import sql, { initSchema } from './schema';

let seeded = false;

export async function seedDatabase() {
  if (seeded) return;

  await initSchema();

  const [{ count }] = await sql`SELECT COUNT(*)::int as count FROM cards`;
  if (count > 0) { seeded = true; return; }

  console.log('Seeding database...');

  // --- CATEGORIES ---
  const categories = [
    { name: 'Groceries', icon: '🛒' },
    { name: 'Dining & Restaurants', icon: '🍽️' },
    { name: 'Gas & EV Charging', icon: '⛽' },
    { name: 'Online Shopping', icon: '🛍️' },
    { name: 'Travel', icon: '✈️' },
    { name: 'Hotels', icon: '🏨' },
    { name: 'Streaming Services', icon: '📺' },
    { name: 'Drugstores & Pharmacy', icon: '💊' },
    { name: 'Wholesale Clubs', icon: '🏪' },
    { name: 'Home Improvement', icon: '🔨' },
    { name: 'Department Stores', icon: '🏬' },
    { name: 'Amazon', icon: '📦' },
    { name: 'PayPal', icon: '💳' },
    { name: 'Fitness Clubs', icon: '💪' },
    { name: 'Entertainment', icon: '🎬' },
    { name: 'General / Everything Else', icon: '💰' },
  ];

  for (const c of categories) {
    await sql`INSERT INTO categories (name, icon) VALUES (${c.name}, ${c.icon}) ON CONFLICT (name) DO NOTHING`;
  }

  const catId = async (name: string): Promise<number> => {
    const [row] = await sql`SELECT id FROM categories WHERE name = ${name}`;
    return row.id;
  };

  // --- CARDS ---
  const cards = [
    { name: 'Chase Sapphire Preferred', issuer: 'Chase', base_rate: 1.0, reward_type: 'points', points_value: 2.0, color: '#1a56db' },
    { name: 'Chase Sapphire Reserve', issuer: 'Chase', base_rate: 1.0, reward_type: 'points', points_value: 2.0, color: '#1a56db' },
    { name: 'Chase Freedom Unlimited', issuer: 'Chase', base_rate: 1.5, reward_type: 'cashback', points_value: 1.0, color: '#1a56db' },
    { name: 'Chase Freedom Flex', issuer: 'Chase', base_rate: 1.0, reward_type: 'cashback', points_value: 1.0, color: '#1a56db' },
    { name: 'Amex Gold Card', issuer: 'American Express', base_rate: 1.0, reward_type: 'points', points_value: 2.0, color: '#d4a017' },
    { name: 'Amex Platinum Card', issuer: 'American Express', base_rate: 1.0, reward_type: 'points', points_value: 2.0, color: '#a8a9ad' },
    { name: 'Amex Blue Cash Preferred', issuer: 'American Express', base_rate: 1.0, reward_type: 'cashback', points_value: 1.0, color: '#0066cc' },
    { name: 'Amex Blue Cash Everyday', issuer: 'American Express', base_rate: 1.0, reward_type: 'cashback', points_value: 1.0, color: '#0066cc' },
    { name: 'Citi Double Cash', issuer: 'Citi', base_rate: 2.0, reward_type: 'cashback', points_value: 1.0, color: '#e31837' },
    { name: 'Citi Custom Cash', issuer: 'Citi', base_rate: 1.0, reward_type: 'cashback', points_value: 1.0, color: '#e31837' },
    { name: 'Discover it Cash Back', issuer: 'Discover', base_rate: 1.0, reward_type: 'cashback', points_value: 1.0, color: '#f76f20' },
    { name: 'Capital One Venture X', issuer: 'Capital One', base_rate: 2.0, reward_type: 'points', points_value: 1.85, color: '#004977' },
    { name: 'Capital One Savor Cash Rewards', issuer: 'Capital One', base_rate: 1.0, reward_type: 'cashback', points_value: 1.0, color: '#004977' },
    { name: 'Amazon Prime Visa', issuer: 'Chase', base_rate: 1.0, reward_type: 'cashback', points_value: 1.0, color: '#ff9900' },
    { name: 'Apple Card', issuer: 'Goldman Sachs', base_rate: 1.0, reward_type: 'cashback', points_value: 1.0, color: '#555555' },
    { name: 'Wells Fargo Active Cash', issuer: 'Wells Fargo', base_rate: 2.0, reward_type: 'cashback', points_value: 1.0, color: '#d71e28' },
    { name: 'Bank of America Travel Rewards', issuer: 'Bank of America', base_rate: 1.5, reward_type: 'points', points_value: 1.0, color: '#e31837' },
    { name: 'US Bank Cash+', issuer: 'US Bank', base_rate: 1.0, reward_type: 'cashback', points_value: 1.0, color: '#002E6D' },
  ];

  for (const c of cards) {
    await sql`INSERT INTO cards (name, issuer, base_rate, reward_type, points_value, color) VALUES (${c.name}, ${c.issuer}, ${c.base_rate}, ${c.reward_type}, ${c.points_value}, ${c.color}) ON CONFLICT DO NOTHING`;
  }

  const cardId = async (name: string): Promise<number> => {
    const [row] = await sql`SELECT id FROM cards WHERE name = ${name}`;
    return row.id;
  };

  // --- BENEFITS ---
  type BenefitOpts = {
    cap?: number | null; capPeriod?: string | null; notes?: string;
    from?: string; until?: string; activation?: boolean; type?: string;
    onlineOnly?: boolean;
  };

  const benefit = async (card: string, category: string | null, rate: number, opts: BenefitOpts = {}) => {
    await sql`
      INSERT INTO card_benefits (card_id, category_id, rate, benefit_type, spend_cap, cap_period, notes, valid_from, valid_until, requires_activation, online_only)
      VALUES (
        ${await cardId(card)},
        ${category ? await catId(category) : null},
        ${rate},
        ${opts.type ?? 'cashback'},
        ${opts.cap ?? null},
        ${opts.capPeriod ?? null},
        ${opts.notes ?? null},
        ${opts.from ?? null},
        ${opts.until ?? null},
        ${opts.activation ?? false},
        ${opts.onlineOnly ?? false}
      )
    `;
  };

  // Chase Sapphire Preferred
  await benefit('Chase Sapphire Preferred', 'Dining & Restaurants', 3, { type: 'points' });
  await benefit('Chase Sapphire Preferred', 'Online Shopping', 3, { type: 'points' });
  await benefit('Chase Sapphire Preferred', 'Groceries', 3, { type: 'points', notes: '3x points on online grocery purchases (excluding Target, Walmart and wholesale clubs)', onlineOnly: true });
  await benefit('Chase Sapphire Preferred', 'Travel', 5, { type: 'points' });
  await benefit('Chase Sapphire Preferred', 'Streaming Services', 3, { type: 'points' });

  // Chase Sapphire Reserve
  await benefit('Chase Sapphire Reserve', 'Dining & Restaurants', 3, { type: 'points' });
  await benefit('Chase Sapphire Reserve', 'Travel', 10, { type: 'points' });

  // Chase Freedom Unlimited
  await benefit('Chase Freedom Unlimited', 'Dining & Restaurants', 3);
  await benefit('Chase Freedom Unlimited', 'Drugstores & Pharmacy', 3);
  await benefit('Chase Freedom Unlimited', 'Travel', 5);

  // Chase Freedom Flex
  await benefit('Chase Freedom Flex', 'Dining & Restaurants', 3);
  await benefit('Chase Freedom Flex', 'Drugstores & Pharmacy', 3);
  await benefit('Chase Freedom Flex', 'Travel', 5);

  // Amex Gold
  await benefit('Amex Gold Card', 'Dining & Restaurants', 4, { type: 'points' });
  await benefit('Amex Gold Card', 'Groceries', 4, { type: 'points', notes: 'US supermarkets only' });
  await benefit('Amex Gold Card', 'Travel', 3, { type: 'points', notes: 'Flights booked directly with airlines' });

  // Amex Platinum
  await benefit('Amex Platinum Card', 'Travel', 5, { type: 'points', notes: 'Flights booked directly or via Amex Travel' });
  await benefit('Amex Platinum Card', 'Hotels', 5, { type: 'points', notes: 'Hotels booked via Amex Travel' });

  // Amex Blue Cash Preferred
  await benefit('Amex Blue Cash Preferred', 'Groceries', 6, { notes: 'US supermarkets, up to $6k/year', cap: 6000, capPeriod: 'year' });
  await benefit('Amex Blue Cash Preferred', 'Streaming Services', 6);
  await benefit('Amex Blue Cash Preferred', 'Gas & EV Charging', 3);
  await benefit('Amex Blue Cash Preferred', 'Travel', 3, { notes: 'Transit & commuting' });

  // Amex Blue Cash Everyday
  await benefit('Amex Blue Cash Everyday', 'Groceries', 3, { notes: 'US supermarkets, up to $6k/year', cap: 6000, capPeriod: 'year' });
  await benefit('Amex Blue Cash Everyday', 'Online Shopping', 3, { notes: 'US online retail' });
  await benefit('Amex Blue Cash Everyday', 'Gas & EV Charging', 2);

  // Citi Custom Cash
  await benefit('Citi Custom Cash', 'Dining & Restaurants', 5, { cap: 500, capPeriod: 'month', notes: 'Auto-applies to top spend category' });
  await benefit('Citi Custom Cash', 'Groceries', 5, { cap: 500, capPeriod: 'month' });
  await benefit('Citi Custom Cash', 'Gas & EV Charging', 5, { cap: 500, capPeriod: 'month' });

  // Discover it Cash Back (rotating — seeded by crawler, these are static fallbacks)
  await benefit('Discover it Cash Back', 'Dining & Restaurants', 5, { cap: 1500, capPeriod: 'quarter', notes: 'Q1 2025', from: '2025-01-01', until: '2025-03-31', activation: true });
  await benefit('Discover it Cash Back', 'Online Shopping', 5, { cap: 1500, capPeriod: 'quarter', notes: 'Q4 2025', from: '2025-10-01', until: '2025-12-31', activation: true });

  // Capital One Savor
  await benefit('Capital One Savor Cash Rewards', 'Dining & Restaurants', 3);
  await benefit('Capital One Savor Cash Rewards', 'Entertainment', 3);
  await benefit('Capital One Savor Cash Rewards', 'Groceries', 3);
  await benefit('Capital One Savor Cash Rewards', 'Streaming Services', 3);

  // Amazon Prime Visa
  await benefit('Amazon Prime Visa', 'Amazon', 5, { notes: 'Prime members at Amazon & Whole Foods' });
  await benefit('Amazon Prime Visa', 'Groceries', 5, { notes: 'Whole Foods Market' });
  await benefit('Amazon Prime Visa', 'Dining & Restaurants', 2);
  await benefit('Amazon Prime Visa', 'Gas & EV Charging', 2);

  // Apple Card
  await benefit('Apple Card', 'General / Everything Else', 2, { notes: 'Apple Pay purchases' });

  // US Bank Cash+
  await benefit('US Bank Cash+', 'Home Improvement', 5, { cap: 2000, capPeriod: 'quarter', notes: 'Choose 2 categories each quarter' });
  await benefit('US Bank Cash+', 'Streaming Services', 5, { cap: 2000, capPeriod: 'quarter' });
  await benefit('US Bank Cash+', 'Fitness Clubs', 5, { cap: 2000, capPeriod: 'quarter' });
  await benefit('US Bank Cash+', 'Groceries', 2);
  await benefit('US Bank Cash+', 'Gas & EV Charging', 2);

  // --- MERCHANTS ---
  const merchants = [
    { name: 'Amazon', domain: 'amazon.com', category: 'Amazon' },
    { name: 'Whole Foods', domain: 'wholefoodsmarket.com', category: 'Groceries' },
    { name: 'Costco', domain: 'costco.com', category: 'Wholesale Clubs' },
    { name: 'Walmart', domain: 'walmart.com', category: 'Groceries' },
    { name: 'Target', domain: 'target.com', category: 'Online Shopping' },
    { name: 'Kroger', domain: 'kroger.com', category: 'Groceries' },
    { name: 'Safeway', domain: 'safeway.com', category: 'Groceries' },
    { name: "Trader Joe's", domain: 'traderjoes.com', category: 'Groceries' },
    { name: "McDonald's", domain: 'mcdonalds.com', category: 'Dining & Restaurants' },
    { name: 'Starbucks', domain: 'starbucks.com', category: 'Dining & Restaurants' },
    { name: 'Chipotle', domain: 'chipotle.com', category: 'Dining & Restaurants' },
    { name: 'Uber Eats', domain: 'ubereats.com', category: 'Dining & Restaurants' },
    { name: 'DoorDash', domain: 'doordash.com', category: 'Dining & Restaurants' },
    { name: 'Shell', domain: 'shell.com', category: 'Gas & EV Charging' },
    { name: 'ExxonMobil', domain: 'exxon.com', category: 'Gas & EV Charging' },
    { name: 'Chevron', domain: 'chevron.com', category: 'Gas & EV Charging' },
    { name: 'Tesla Supercharger', domain: 'tesla.com', category: 'Gas & EV Charging' },
    { name: 'Nike', domain: 'nike.com', category: 'Online Shopping' },
    { name: 'Adidas', domain: 'adidas.com', category: 'Online Shopping' },
    { name: 'eBay', domain: 'ebay.com', category: 'Online Shopping' },
    { name: 'Etsy', domain: 'etsy.com', category: 'Online Shopping' },
    { name: 'Best Buy', domain: 'bestbuy.com', category: 'Online Shopping' },
    { name: 'Apple', domain: 'apple.com', category: 'Online Shopping' },
    { name: 'Netflix', domain: 'netflix.com', category: 'Streaming Services' },
    { name: 'Spotify', domain: 'spotify.com', category: 'Streaming Services' },
    { name: 'Hulu', domain: 'hulu.com', category: 'Streaming Services' },
    { name: 'Disney+', domain: 'disneyplus.com', category: 'Streaming Services' },
    { name: 'HBO Max', domain: 'max.com', category: 'Streaming Services' },
    { name: 'CVS', domain: 'cvs.com', category: 'Drugstores & Pharmacy' },
    { name: 'Walgreens', domain: 'walgreens.com', category: 'Drugstores & Pharmacy' },
    { name: 'Home Depot', domain: 'homedepot.com', category: 'Home Improvement' },
    { name: "Lowe's", domain: 'lowes.com', category: 'Home Improvement' },
    { name: 'Marriott', domain: 'marriott.com', category: 'Hotels' },
    { name: 'Hilton', domain: 'hilton.com', category: 'Hotels' },
    { name: 'Airbnb', domain: 'airbnb.com', category: 'Hotels' },
    { name: 'Delta Airlines', domain: 'delta.com', category: 'Travel' },
    { name: 'United Airlines', domain: 'united.com', category: 'Travel' },
    { name: 'American Airlines', domain: 'aa.com', category: 'Travel' },
    { name: 'Expedia', domain: 'expedia.com', category: 'Travel' },
    { name: "Sam's Club", domain: 'samsclub.com', category: 'Wholesale Clubs' },
    { name: "BJ's Wholesale", domain: 'bjs.com', category: 'Wholesale Clubs' },
    { name: "Macy's", domain: 'macys.com', category: 'Department Stores' },
    { name: 'Nordstrom', domain: 'nordstrom.com', category: 'Online Shopping' },
    { name: 'PayPal', domain: 'paypal.com', category: 'PayPal' },
    { name: 'Instacart', domain: 'instacart.com', category: 'Groceries' },
  ];

  for (const m of merchants) {
    await sql`INSERT INTO merchants (name, domain, category_id) VALUES (${m.name}, ${m.domain}, ${await catId(m.category)}) ON CONFLICT DO NOTHING`;
  }

  seeded = true;
  console.log('Database seeded successfully.');
}
