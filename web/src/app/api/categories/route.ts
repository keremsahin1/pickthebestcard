import { NextResponse } from 'next/server';
import sql from '@/db/schema';

export async function GET() {
  const categories = await sql`SELECT id, name, icon FROM categories ORDER BY name`;
  return NextResponse.json(categories);
}
