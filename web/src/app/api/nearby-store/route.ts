// Placeholder — full implementation in Task 5
import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { resolveUserKey, checkAndIncrementRateLimit, fetchGooglePlaces, matchAndLogPlaces } from '@/lib/nearby';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = await req.json().catch(() => ({}));
  const { lat, lng } = body as { lat?: number; lng?: number };

  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return NextResponse.json({ error: 'missing_lat_lng' }, { status: 400 });
  }

  const session = await getAuth();
  const sessionEmail = session?.user?.email;
  const googleToken = req.headers.get('x-google-token');
  const rawIp = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';

  const userKey = await resolveUserKey(sessionEmail, googleToken, rawIp);
  const allowed = await checkAndIncrementRateLimit(userKey);
  if (!allowed) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  try {
    const googlePlaces = await fetchGooglePlaces(lat, lng);
    const places = await matchAndLogPlaces(googlePlaces);
    return NextResponse.json({ places });
  } catch {
    return NextResponse.json({ places: [] });
  }
}
