import { NextResponse } from 'next/server';
import sql from '@/db/schema';

export async function GET() {
  const results: Record<string, unknown> = {};

  // Test DB connection
  try {
    const r = await sql`SELECT 1 as ok`;
    results.db = 'ok';
  } catch (e: unknown) {
    results.db = String(e);
  }

  // Test users table exists
  try {
    await sql`SELECT id FROM users LIMIT 1`;
    results.users_table = 'ok';
  } catch (e: unknown) {
    results.users_table = String(e);
  }

  // Test user upsert with dummy data
  try {
    await sql`
      INSERT INTO users (id, email, name, image)
      VALUES ('test-debug-id', 'test@test.com', 'Test', null)
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
    `;
    await sql`DELETE FROM users WHERE id = 'test-debug-id'`;
    results.user_upsert = 'ok';
  } catch (e: unknown) {
    results.user_upsert = String(e);
  }

  // Check env vars (redacted)
  results.env = {
    NEXTAUTH_URL: process.env.NEXTAUTH_URL ?? 'missing',
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ? 'set' : 'missing',
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ? process.env.GOOGLE_CLIENT_ID.slice(-10) : 'missing',
    DATABASE_URL: process.env.DATABASE_URL ? 'set' : 'missing',
  };

  return NextResponse.json(results);
}
