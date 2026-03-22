import { createHash } from 'crypto';
import sql from '@/db/schema';
import { googleTypesToCategoryName } from '@/shared/nearby';
import type { NearbyPlace } from '@/shared/types';

export interface GooglePlace {
  place_id: string;
  name: string;
  types: string[];
}

export async function resolveUserKey(
  sessionEmail: string | null | undefined,
  googleToken: string | null,
  rawIp: string
): Promise<string> {
  if (sessionEmail) return `user:${sessionEmail}`;

  if (googleToken) {
    try {
      const res = await fetch('https://www.googleapis.com/userinfo/v2/me', {
        headers: { Authorization: `Bearer ${googleToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.email) return `user:${data.email}`;
      }
    } catch {
      // fall through
    }
  }

  const hash = createHash('sha256').update(rawIp).digest('hex').slice(0, 16);
  return `anon:${hash}`;
}

export async function checkAndIncrementRateLimit(userKey: string): Promise<boolean> {
  const result = await sql`
    INSERT INTO location_requests (user_key, req_date, count)
    VALUES (${userKey}, CURRENT_DATE, 1)
    ON CONFLICT (user_key, req_date)
    DO UPDATE SET count = location_requests.count + 1
    RETURNING count
  `;
  return result[0].count <= 100;
}

export async function fetchGooglePlaces(lat: number, lng: number): Promise<GooglePlace[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return [];

  const res = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.types',
    },
    body: JSON.stringify({
      locationRestriction: {
        circle: { center: { latitude: lat, longitude: lng }, radius: 5000 },
      },
      includedTypes: [
        'grocery_store', 'supermarket', 'convenience_store',
        'department_store', 'shopping_mall', 'clothing_store', 'electronics_store',
        'home_goods_store', 'hardware_store', 'furniture_store', 'shoe_store',
        'book_store', 'sporting_goods_store',
        'restaurant', 'fast_food_restaurant', 'cafe', 'coffee_shop', 'bakery', 'bar',
        'gas_station', 'pharmacy', 'drugstore', 'hotel',
      ],
      rankPreference: 'DISTANCE',
      maxResultCount: 5,
    }),
  });
  if (!res.ok) return [];

  const data = await res.json();
  if (!Array.isArray(data.places)) return [];

  return data.places.map((p: { id: string; displayName: { text: string }; types: string[] }) => ({
    place_id: p.id,
    name: p.displayName.text,
    types: p.types ?? [],
  }));
}

export async function matchAndLogPlaces(places: GooglePlace[]): Promise<NearbyPlace[]> {
  const results: NearbyPlace[] = [];

  for (const place of places) {
    // Try LIKE match against merchants table (bidirectional: either side can be the substring)
    const likePattern = `%${place.name.toLowerCase()}%`;
    const googleNameLower = place.name.toLowerCase();
    const merchantRows = await sql`
      SELECT id, category_id FROM merchants
      WHERE LOWER(name) LIKE ${likePattern}
         OR ${googleNameLower} LIKE '%' || LOWER(name) || '%'
      LIMIT 1
    `;

    if (merchantRows.length > 0) {
      results.push({
        name: place.name,
        merchantId: merchantRows[0].id,
        categoryId: merchantRows[0].category_id,
        placeId: place.place_id,
      });
      continue;
    }

    // No match — derive category from Google types
    const categoryName = googleTypesToCategoryName(place.types);
    const categoryRows = await sql`
      SELECT id FROM categories WHERE name = ${categoryName} LIMIT 1
    `;
    const categoryId: number | null = categoryRows[0]?.id ?? null;

    // Log to merchant_sightings (idempotent)
    await sql`
      INSERT INTO merchant_sightings (place_id, name, google_types, category_id)
      VALUES (${place.place_id}, ${place.name}, ${place.types}, ${categoryId})
      ON CONFLICT (place_id) DO UPDATE SET
        sighting_count = merchant_sightings.sighting_count + 1,
        last_seen = NOW()
    `;

    results.push({
      name: place.name,
      merchantId: null,
      categoryId,
      placeId: place.place_id,
    });
  }

  return results;
}
