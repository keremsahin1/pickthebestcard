import { NextResponse } from 'next/server';
import { getAllCards } from '@/lib/recommend';
import { seedDatabase } from '@/db/seed';

export async function GET() {
  await seedDatabase();
  const cards = await getAllCards();
  return NextResponse.json(cards);
}
