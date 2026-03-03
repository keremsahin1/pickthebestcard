import { NextRequest, NextResponse } from 'next/server';
import { getRecommendations } from '@/lib/recommend';
import { seedDatabase } from '@/db/seed';

export async function POST(req: NextRequest) {
  await seedDatabase();
  const { cardIds, merchant, categoryId } = await req.json();
  const result = await getRecommendations(cardIds, merchant, categoryId ?? null);
  return NextResponse.json(result);
}
