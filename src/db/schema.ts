import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'data.db');

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    initSchema(db);
  }
  return db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      issuer TEXT NOT NULL,
      base_rate REAL NOT NULL DEFAULT 1.0,
      reward_type TEXT NOT NULL DEFAULT 'cashback', -- cashback | points
      points_value REAL DEFAULT 1.0, -- cents per point (for display)
      color TEXT DEFAULT '#6366f1',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      icon TEXT DEFAULT '🛍️'
    );

    CREATE TABLE IF NOT EXISTS merchants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      domain TEXT,
      category_id INTEGER REFERENCES categories(id)
    );

    CREATE TABLE IF NOT EXISTS card_benefits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      card_id INTEGER NOT NULL REFERENCES cards(id),
      category_id INTEGER REFERENCES categories(id),
      merchant_id INTEGER REFERENCES merchants(id),
      rate REAL NOT NULL,
      benefit_type TEXT DEFAULT 'cashback',
      spend_cap REAL DEFAULT NULL, -- quarterly/annual cap in dollars
      cap_period TEXT DEFAULT NULL, -- quarter | year | month
      notes TEXT,
      valid_from TEXT,
      valid_until TEXT,
      requires_activation INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS user_cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      card_id INTEGER NOT NULL REFERENCES cards(id),
      UNIQUE(session_id, card_id)
    );

    CREATE INDEX IF NOT EXISTS idx_card_benefits_card ON card_benefits(card_id);
    CREATE INDEX IF NOT EXISTS idx_card_benefits_category ON card_benefits(category_id);
    CREATE INDEX IF NOT EXISTS idx_merchants_name ON merchants(name);
  `);
}
