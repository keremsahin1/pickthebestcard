import { NextResponse } from 'next/server';
import { getAllCards } from '@/lib/recommend';
import { seedDatabase } from '@/db/seed';

export function GET() {
  seedDatabase();
  const cards = getAllCards();
  return NextResponse.json(cards);
}
