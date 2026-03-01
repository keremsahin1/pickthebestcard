import { NextRequest, NextResponse } from 'next/server';
import { getRecommendations } from '@/lib/recommend';
import { seedDatabase } from '@/db/seed';

export function POST(req: NextRequest) {
  seedDatabase();
  const body = req.json().then((data: { cardIds: number[]; merchant: string }) => {
    const result = getRecommendations(data.cardIds, data.merchant);
    return NextResponse.json(result);
  });
  return body;
}
