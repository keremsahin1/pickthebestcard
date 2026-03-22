import { NextRequest, NextResponse } from 'next/server';
import { fetchPlacesAutocomplete, categorizePlaces } from '@/lib/nearby';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const q = req.nextUrl.searchParams.get('q') ?? '';
  if (q.length < 2) return NextResponse.json({ places: [] });

  try {
    const googlePlaces = await fetchPlacesAutocomplete(q);
    const places = await categorizePlaces(googlePlaces);
    return NextResponse.json({ places });
  } catch {
    return NextResponse.json({ places: [] });
  }
}
