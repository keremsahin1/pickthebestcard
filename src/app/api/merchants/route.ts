import { NextRequest, NextResponse } from 'next/server';
import { searchMerchants } from '@/lib/recommend';
import { seedDatabase } from '@/db/seed';

export async function GET(req: NextRequest) {
  await seedDatabase();
  const q = req.nextUrl.searchParams.get('q') ?? '';
  if (q.length < 1) return NextResponse.json([]);
  return NextResponse.json(await searchMerchants(q));
}
