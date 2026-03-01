import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);
export default sql;

export async function initSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS cards (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      issuer TEXT NOT NULL,
      base_rate REAL NOT NULL DEFAULT 1.0,
      reward_type TEXT NOT NULL DEFAULT 'cashback',
      points_value REAL DEFAULT 1.0,
      color TEXT DEFAULT '#6366f1',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS categories (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      icon TEXT DEFAULT '🛍️'
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS merchants (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      domain TEXT,
      category_id INTEGER REFERENCES categories(id)
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS card_benefits (
      id SERIAL PRIMARY KEY,
      card_id INTEGER NOT NULL REFERENCES cards(id),
      category_id INTEGER REFERENCES categories(id),
      merchant_id INTEGER REFERENCES merchants(id),
      rate REAL NOT NULL,
      benefit_type TEXT DEFAULT 'cashback',
      spend_cap REAL DEFAULT NULL,
      cap_period TEXT DEFAULT NULL,
      notes TEXT,
      valid_from DATE,
      valid_until DATE,
      requires_activation BOOLEAN DEFAULT FALSE
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      image TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS user_cards (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      card_id INTEGER NOT NULL REFERENCES cards(id),
      UNIQUE(user_id, card_id)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_card_benefits_card ON card_benefits(card_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_card_benefits_category ON card_benefits(category_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_merchants_name ON merchants(name)`;
}
