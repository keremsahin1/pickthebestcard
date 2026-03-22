import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock the DB default export
vi.mock('@/db/schema', () => ({
  default: vi.fn(),
}));

// Mock @/lib/auth so getAuth() doesn't touch NextAuth internals
vi.mock('@/lib/auth', () => ({
  getAuth: vi.fn().mockResolvedValue(null),
}));

// Mock global fetch (used for Google Places API and Google userinfo)
const mockFetch = vi.fn();
global.fetch = mockFetch;

const { default: sql } = await import('@/db/schema');
const mockSql = vi.mocked(sql);

// Import the lib functions under test (must come after mocks)
const { checkAndIncrementRateLimit, matchAndLogPlaces, resolveUserKey } = await import('@/lib/nearby');
const { POST } = await import('@/app/api/nearby-store/route');

describe('checkAndIncrementRateLimit', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns true when count is 1 (first request)', async () => {
    mockSql.mockResolvedValueOnce([{ count: 1 }]);
    expect(await checkAndIncrementRateLimit('user:test@example.com')).toBe(true);
  });

  it('returns true when count is exactly 100', async () => {
    mockSql.mockResolvedValueOnce([{ count: 100 }]);
    expect(await checkAndIncrementRateLimit('user:test@example.com')).toBe(true);
  });

  it('returns false when count is 101 (rate limited)', async () => {
    mockSql.mockResolvedValueOnce([{ count: 101 }]);
    expect(await checkAndIncrementRateLimit('user:test@example.com')).toBe(false);
  });
});

describe('matchAndLogPlaces', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns NearbyPlace[] with merchantId set when name matches merchants table', async () => {
    const googlePlaces = [
      { place_id: 'ChIJ1', name: 'Whole Foods Market', types: ['grocery_or_supermarket'] },
    ];
    // merchant lookup returns a match
    mockSql.mockResolvedValueOnce([{ id: 56, category_id: 1 }]);

    const result = await matchAndLogPlaces(googlePlaces);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Whole Foods Market');
    expect(result[0].merchantId).toBe(56);
    expect(result[0].categoryId).toBe(1);
    expect(result[0].placeId).toBe('ChIJ1');
  });

  it('returns NearbyPlace[] with null merchantId and logs sighting when no DB match', async () => {
    const googlePlaces = [
      { place_id: 'ChIJ2', name: 'Shell', types: ['gas_station'] },
    ];
    // merchant lookup: no match
    mockSql.mockResolvedValueOnce([]);
    // category lookup
    mockSql.mockResolvedValueOnce([{ id: 5 }]);
    // merchant_sightings upsert
    mockSql.mockResolvedValueOnce([]);

    const result = await matchAndLogPlaces(googlePlaces);

    expect(result[0].merchantId).toBeNull();
    expect(result[0].categoryId).toBe(5); // derived from gas_station → Gas Stations
    // Verify sightings upsert was called (3 sql calls total)
    expect(mockSql).toHaveBeenCalledTimes(3);
  });

  it('NearbyPlace.name is set from Google place name (used by client to prefill merchant query)', async () => {
    // This verifies the data contract: the client sets merchantQuery = place.name
    // so the name must match what the user expects to see in the field.
    const googlePlaces = [
      { place_id: 'ChIJ3', name: 'Trader Joe\'s', types: ['grocery_or_supermarket'] },
    ];
    mockSql.mockResolvedValueOnce([{ id: 99, category_id: 1 }]);

    const result = await matchAndLogPlaces(googlePlaces);

    expect(result[0].name).toBe('Trader Joe\'s'); // this is what gets set as merchantQuery on selection
    expect(result[0].placeId).toBe('ChIJ3');
  });
});

describe('resolveUserKey', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns user:<email> when sessionEmail is provided', async () => {
    const key = await resolveUserKey('user@example.com', null, '1.2.3.4');
    expect(key).toBe('user:user@example.com');
    expect(mockFetch).not.toHaveBeenCalled(); // no Google call needed
  });

  it('falls back to anon:<hash> when no session and no token', async () => {
    const key = await resolveUserKey(null, null, '1.2.3.4');
    expect(key).toMatch(/^anon:[0-9a-f]{16}$/);
  });

  it('falls back to anon:<hash> when google token fetch fails', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network error'));
    const key = await resolveUserKey(null, 'bad-token', '1.2.3.4');
    expect(key).toMatch(/^anon:[0-9a-f]{16}$/);
  });
});

describe('POST /api/nearby-store', () => {
  beforeEach(() => vi.clearAllMocks());

  function makeReq(body: object, headers: Record<string, string> = {}) {
    return new NextRequest('http://localhost/api/nearby-store', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json', ...headers },
    });
  }

  it('returns 400 for missing lat/lng', async () => {
    const res = await POST(makeReq({}));
    expect(res.status).toBe(400);
  });

  it('returns 429 when rate limit exceeded', async () => {
    // rate limit upsert returns count > 100
    mockSql.mockResolvedValueOnce([{ count: 101 }]);
    const res = await POST(makeReq({ lat: 37.7749, lng: -122.4194 }));
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toBe('rate_limited');
  });

  it('returns { places: NearbyPlace[] } with mocked Google response', async () => {
    process.env.GOOGLE_PLACES_API_KEY = 'test-key';
    try {
      // rate limit OK
      mockSql.mockResolvedValueOnce([{ count: 1 }]);
      // Google Places API response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'OK',
          results: [
            { place_id: 'ChIJ1', name: 'Whole Foods Market', types: ['grocery_or_supermarket'] },
            { place_id: 'ChIJ2', name: 'Shell', types: ['gas_station'] },
          ],
        }),
      });
      // merchant lookup for Whole Foods: match
      mockSql.mockResolvedValueOnce([{ id: 56, category_id: 1 }]);
      // merchant lookup for Shell: no match
      mockSql.mockResolvedValueOnce([]);
      // category lookup for Shell
      mockSql.mockResolvedValueOnce([{ id: 5 }]);
      // merchant_sightings upsert for Shell
      mockSql.mockResolvedValueOnce([]);

      const res = await POST(makeReq({ lat: 37.7749, lng: -122.4194 }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.places).toHaveLength(2);
      expect(body.places[0].name).toBe('Whole Foods Market');
      expect(body.places[0].merchantId).toBe(56);
      expect(body.places[1].name).toBe('Shell');
      expect(body.places[1].merchantId).toBeNull();
    } finally {
      delete process.env.GOOGLE_PLACES_API_KEY;
    }
  });
});
