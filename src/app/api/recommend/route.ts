import { NextRequest, NextResponse } from 'next/server';
import { getRecommendations } from '@/lib/recommend';
import { seedDatabase } from '@/db/seed';

export async function POST(req: NextRequest) {
  await seedDatabase();
  const { cardIds, merchant } = await req.json();
  const result = await getRecommendations(cardIds, merchant);
  return NextResponse.json(result);
}
