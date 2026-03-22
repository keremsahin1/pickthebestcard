# Location-Based Store Recommendation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a user focuses the "Where are you shopping?" merchant field, the app silently acquires GPS, calls `/api/nearby-store`, and surfaces up to 5 nearby businesses as suggestions at the top of the merchant dropdown on both web and mobile.

**Architecture:** A new `shared/src/nearby.ts` maps Google Place types to our category names. A new `web/src/lib/nearby.ts` encapsulates rate-limit checking, Google Places Nearby Search, merchant matching, and sightings logging. The single `/api/nearby-store` route accepts both NextAuth cookies (web) and `x-google-token` headers (mobile), falling back to a hashed-IP key for anonymous users. Both clients acquire GPS on field focus (once per session) and render a `📍 Nearby` section in the existing dropdown above text-search results.

**Tech Stack:** Next.js App Router API routes, Neon PostgreSQL (`@neondatabase/serverless`), Google Places Nearby Search API, `expo-location` (mobile only), `navigator.geolocation` (web only), vitest (shared + web tests), jest (mobile tests)

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `shared/src/types.ts` | Modify | Add `NearbyPlace` interface |
| `shared/src/nearby.ts` | Create | `googleTypesToCategoryName()` — maps Google Place types to our category name strings |
| `shared/src/nearby.test.ts` | Create | Tests for `googleTypesToCategoryName()` |
| `web/src/shared/` | Sync | Verbatim copy of `shared/src/` for Vercel build |
| `mobile/lib/shared/` | Sync | Verbatim copy of `shared/src/` for Expo build |
| `web/src/db/schema.ts` | Modify | Add `location_requests` and `merchant_sightings` tables to `initSchema()` |
| `web/src/lib/nearby.ts` | Create | Testable helpers: `resolveUserKey`, `checkAndIncrementRateLimit`, `fetchGooglePlaces`, `matchAndLogPlaces` |
| `web/src/app/api/nearby-store/route.ts` | Create | `POST /api/nearby-store` — thin orchestrator calling lib helpers |
| `web/src/test/nearby-store.test.ts` | Create | Unit tests for rate limit logic and place matching (mocked DB + fetch) |
| `web/src/app/page.tsx` | Modify | GPS acquisition on field focus + `📍 Nearby` section in merchant dropdown |
| `mobile/app/index.tsx` | Modify | `expo-location` on field focus + `📍 Nearby` section in merchant dropdown |
| `mobile/app.json` | Modify | Add iOS `NSLocationWhenInUseUsageDescription` and Android `ACCESS_COARSE_LOCATION` |
| `mobile/__tests__/location.test.ts` | Create | Tests that GPS permission denial skips the nearby fetch |
| `.github/workflows/promote-merchants.yml` | Create | Daily cron (3 AM UTC): promotes `merchant_sightings` rows to `merchants` table |
| `.env.example` | Modify | Add `GOOGLE_PLACES_API_KEY` placeholder |

---

## Task 1: Add `NearbyPlace` to shared types

**Files:**
- Modify: `shared/src/types.ts`
- Sync: `web/src/shared/types.ts`, `mobile/lib/shared/types.ts`

- [ ] **Step 1: Append `NearbyPlace` to `shared/src/types.ts`**

Add at the end of the file:

```typescript
export interface NearbyPlace {
  name: string;
  merchantId: number | null;
  categoryId: number | null;
  placeId: string;
}
```

- [ ] **Step 2: Sync to web and mobile**

```bash
cp shared/src/types.ts web/src/shared/types.ts
cp shared/src/types.ts mobile/lib/shared/types.ts
```

- [ ] **Step 3: Commit**

```bash
git add shared/src/types.ts web/src/shared/types.ts mobile/lib/shared/types.ts
git commit -m "feat: add NearbyPlace type to shared types"
```

---

## Task 2: Shared logic — `googleTypesToCategoryName`

**Files:**
- Create: `shared/src/nearby.test.ts`
- Create: `shared/src/nearby.ts`
- Sync: `web/src/shared/nearby.ts`, `mobile/lib/shared/nearby.ts`

- [ ] **Step 1: Write failing test at `shared/src/nearby.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { googleTypesToCategoryName } from './nearby';

describe('googleTypesToCategoryName', () => {
  it('maps grocery types', () => {
    expect(googleTypesToCategoryName(['grocery_or_supermarket'])).toBe('Groceries');
    expect(googleTypesToCategoryName(['supermarket'])).toBe('Groceries');
  });

  it('maps dining types', () => {
    expect(googleTypesToCategoryName(['restaurant'])).toBe('Dining & Restaurants');
    expect(googleTypesToCategoryName(['food'])).toBe('Dining & Restaurants');
    expect(googleTypesToCategoryName(['cafe'])).toBe('Dining & Restaurants');
    expect(googleTypesToCategoryName(['bakery'])).toBe('Dining & Restaurants');
    expect(googleTypesToCategoryName(['bar'])).toBe('Dining & Restaurants');
  });

  it('maps gas station', () => {
    expect(googleTypesToCategoryName(['gas_station'])).toBe('Gas Stations');
  });

  it('maps pharmacy types', () => {
    expect(googleTypesToCategoryName(['pharmacy'])).toBe('Drugstores & Pharmacy');
    expect(googleTypesToCategoryName(['drugstore'])).toBe('Drugstores & Pharmacy');
  });

  it('maps lodging', () => {
    expect(googleTypesToCategoryName(['lodging'])).toBe('Hotels');
  });

  it('maps home improvement types', () => {
    expect(googleTypesToCategoryName(['home_goods_store'])).toBe('Home Improvement');
    expect(googleTypesToCategoryName(['hardware_store'])).toBe('Home Improvement');
    expect(googleTypesToCategoryName(['furniture_store'])).toBe('Home Improvement');
  });

  it('maps retail/shopping types', () => {
    expect(googleTypesToCategoryName(['department_store'])).toBe('Online Shopping');
    expect(googleTypesToCategoryName(['shopping_mall'])).toBe('Online Shopping');
    expect(googleTypesToCategoryName(['clothing_store'])).toBe('Online Shopping');
    expect(googleTypesToCategoryName(['electronics_store'])).toBe('Online Shopping');
  });

  it('returns General for unknown types', () => {
    expect(googleTypesToCategoryName(['point_of_interest'])).toBe('General / Everything Else');
    expect(googleTypesToCategoryName([])).toBe('General / Everything Else');
    expect(googleTypesToCategoryName(['establishment'])).toBe('General / Everything Else');
  });

  it('uses first matching type in the array', () => {
    expect(googleTypesToCategoryName(['restaurant', 'food', 'establishment'])).toBe('Dining & Restaurants');
    expect(googleTypesToCategoryName(['establishment', 'grocery_or_supermarket'])).toBe('Groceries');
  });
});
```

- [ ] **Step 2: Run to confirm it fails**

```bash
cd shared && npm test -- nearby.test.ts
```

Expected: FAIL with `Cannot find module './nearby'`

- [ ] **Step 3: Implement `shared/src/nearby.ts`**

```typescript
const TYPE_MAP: Array<[string[], string]> = [
  [['grocery_or_supermarket', 'supermarket'], 'Groceries'],
  [['restaurant', 'food', 'cafe', 'bakery', 'bar'], 'Dining & Restaurants'],
  [['gas_station'], 'Gas Stations'],
  [['pharmacy', 'drugstore'], 'Drugstores & Pharmacy'],
  [['lodging'], 'Hotels'],
  [['home_goods_store', 'hardware_store', 'furniture_store'], 'Home Improvement'],
  [['department_store', 'shopping_mall', 'clothing_store', 'electronics_store'], 'Online Shopping'],
];

export function googleTypesToCategoryName(types: string[]): string {
  for (const type of types) {
    for (const [googleTypes, categoryName] of TYPE_MAP) {
      if (googleTypes.includes(type)) return categoryName;
    }
  }
  return 'General / Everything Else';
}
```

- [ ] **Step 4: Run tests to confirm pass**

```bash
cd shared && npm test -- nearby.test.ts
```

Expected: 9 tests PASS

- [ ] **Step 5: Sync to web and mobile**

```bash
cp shared/src/nearby.ts web/src/shared/nearby.ts
cp shared/src/nearby.ts mobile/lib/shared/nearby.ts
```

- [ ] **Step 6: Commit**

```bash
git add shared/src/nearby.ts shared/src/nearby.test.ts web/src/shared/nearby.ts mobile/lib/shared/nearby.ts
git commit -m "feat: add googleTypesToCategoryName shared logic with tests"
```

---

## Task 3: Database schema — new tables

**Files:**
- Modify: `web/src/db/schema.ts`

The file exports a default `sql` tagged-template function and an `initSchema()` async function. Add two new `CREATE TABLE IF NOT EXISTS` blocks inside `initSchema()`, after the existing tables.

- [ ] **Step 1: Add tables inside `initSchema()` in `web/src/db/schema.ts`**

After the last `await sql\`CREATE INDEX...\`` lines, append:

```typescript
  await sql`
    CREATE TABLE IF NOT EXISTS location_requests (
      user_key  TEXT NOT NULL,
      req_date  DATE NOT NULL DEFAULT CURRENT_DATE,
      count     INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_key, req_date)
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS merchant_sightings (
      place_id       TEXT PRIMARY KEY,
      name           TEXT NOT NULL,
      google_types   TEXT[],
      category_id    INTEGER REFERENCES categories(id),
      sighting_count INTEGER NOT NULL DEFAULT 1,
      last_seen      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
```

- [ ] **Step 2: Run schema migration against Neon**

```bash
cd web && npx tsx -e "import { initSchema } from './src/db/schema'; initSchema().then(() => { console.log('ok'); process.exit(0); }).catch(e => { console.error(e); process.exit(1); })"
```

Expected output: `ok`

- [ ] **Step 3: Commit**

```bash
git add web/src/db/schema.ts
git commit -m "feat: add location_requests and merchant_sightings tables"
```

---

## Task 4: API library — `web/src/lib/nearby.ts`

**Files:**
- Create: `web/src/lib/nearby.ts`

This file exports testable helper functions that the route handler calls. It imports `sql` from `@/db/schema` (default export) and `googleTypesToCategoryName` from `@/shared/nearby`.

- [ ] **Step 1: Write failing tests at `web/src/test/nearby-store.test.ts`**

```typescript
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
const { checkAndIncrementRateLimit, matchAndLogPlaces } = await import('@/lib/nearby');
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
  });
});
```

- [ ] **Step 2: Run to confirm it fails**

```bash
cd web && npm test -- nearby-store.test.ts
```

Expected: FAIL with `Cannot find module '@/lib/nearby'`

- [ ] **Step 3: Implement `web/src/lib/nearby.ts`**

```typescript
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

  const url =
    `https://maps.googleapis.com/maps/api/place/nearbysearch/json` +
    `?location=${lat},${lng}&rankby=distance&type=establishment&key=${apiKey}`;

  const res = await fetch(url);
  if (!res.ok) return [];

  const data = await res.json();
  if (data.status !== 'OK') return [];

  return (data.results as GooglePlace[]).slice(0, 5);
}

export async function matchAndLogPlaces(places: GooglePlace[]): Promise<NearbyPlace[]> {
  const results: NearbyPlace[] = [];

  for (const place of places) {
    // Try exact/LIKE match against merchants table
    const merchantRows = await sql`
      SELECT id, category_id FROM merchants
      WHERE LOWER(name) LIKE LOWER(${place.name})
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
```

- [ ] **Step 4: Run tests to confirm pass**

```bash
cd web && npm test -- nearby-store.test.ts
```

Expected: 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/nearby.ts web/src/test/nearby-store.test.ts
git commit -m "feat: add nearby-store lib helpers with unit tests"
```

---

## Task 5: API route — `POST /api/nearby-store`

**Files:**
- Create: `web/src/app/api/nearby-store/route.ts`

The route is a thin orchestrator. Auth pattern mirrors `web/src/app/api/mobile/cards/route.ts` (Google token header) combined with `web/src/app/api/user/cards/route.ts` (NextAuth session via `getAuth()`).

- [ ] **Step 1: Create `web/src/app/api/nearby-store/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import {
  resolveUserKey,
  checkAndIncrementRateLimit,
  fetchGooglePlaces,
  matchAndLogPlaces,
} from '@/lib/nearby';

export async function POST(req: NextRequest) {
  let body: { lat?: unknown; lng?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const { lat, lng } = body;
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return NextResponse.json({ error: 'missing_lat_lng' }, { status: 400 });
  }

  const session = await getAuth();
  const googleToken = req.headers.get('x-google-token');
  const rawIp =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';

  const userKey = await resolveUserKey(session?.user?.email, googleToken, rawIp);
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
```

- [ ] **Step 2: Run full web test suite to confirm no regressions**

```bash
cd web && npx tsc --noEmit && npm test
```

Expected: All tests pass, no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add web/src/app/api/nearby-store/route.ts
git commit -m "feat: add POST /api/nearby-store route"
```

---

## Task 6: Web client — GPS + nearby dropdown

**Files:**
- Modify: `web/src/app/page.tsx`

Read the file before editing. Key existing patterns:
- Imports: `useState, useEffect, useRef` already imported from `'react'`
- State declarations are at lines ~27–43
- Merchant input is at line ~296–323. The `onFocus` handler currently calls `setShowMerchantDropdown(true)` only
- The merchant dropdown renders when `{showMerchantDropdown && merchantSuggestions.length > 0 && (...)}`

- [ ] **Step 1: Add `NearbyPlace` import**

In the existing type import line from `@pickthebestcard/shared`, add `NearbyPlace`:

```typescript
import type { Recommendation, Protection, MerchantMatch, Merchant, Category, NearbyPlace } from '@pickthebestcard/shared';
```

- [ ] **Step 2: Add nearby state variables after the existing `useState` declarations (around line 43)**

```typescript
  const [nearbyPlaces, setNearbyPlaces] = useState<NearbyPlace[]>([]);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const coordsRef = useRef<{ lat: number; lng: number } | null>(null);
  const nearbyFetchedRef = useRef(false);
```

- [ ] **Step 3: Add `fetchNearby` and `handleMerchantFocus` functions inside the component, before the `return`**

```typescript
  async function fetchNearby(lat: number, lng: number) {
    if (nearbyFetchedRef.current) return;
    nearbyFetchedRef.current = true;
    setNearbyLoading(true);
    try {
      const res = await fetch('/api/nearby-store', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lng }),
      });
      if (res.ok) {
        const data = await res.json();
        setNearbyPlaces(data.places ?? []);
      }
    } catch {
      // silent failure
    } finally {
      setNearbyLoading(false);
    }
  }

  function handleMerchantFocus() {
    setShowMerchantDropdown(true);
    if (coordsRef.current) {
      fetchNearby(coordsRef.current.lat, coordsRef.current.lng);
      return;
    }
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        coordsRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        fetchNearby(coordsRef.current.lat, coordsRef.current.lng);
      },
      () => { /* permission denied — silent */ },
      { timeout: 5000 }
    );
  }
```

- [ ] **Step 4: Add `filteredNearby` computation before the `return` statement**

```typescript
  const filteredNearby = nearbyPlaces.filter(
    (p) => !merchantQuery || p.name.toLowerCase().includes(merchantQuery.toLowerCase())
  );
```

- [ ] **Step 5: Update the merchant input's `onFocus` handler**

Find the merchant `<input>` element (it has `placeholder="e.g. Amazon, Costco..."`) and change:

```typescript
// Before:
onFocus={() => setShowMerchantDropdown(true)}

// After:
onFocus={handleMerchantFocus}
```

- [ ] **Step 6: Update the merchant dropdown condition and add the `📍 Nearby` section**

Find the merchant dropdown JSX. It currently reads:

```tsx
{showMerchantDropdown && merchantSuggestions.length > 0 && (
  <div className="absolute top-full ...">
    {merchantSuggestions.map(...)}
  </div>
)}
```

Replace it with:

```tsx
{showMerchantDropdown && (filteredNearby.length > 0 || nearbyLoading || merchantSuggestions.length > 0) && (
  <div className="absolute top-full mt-1 w-full bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-2xl z-10">
    {/* Nearby section */}
    {(filteredNearby.length > 0 || nearbyLoading) && (
      <div>
        <div className="px-4 py-1.5 text-xs text-slate-500 font-medium border-b border-slate-700/50">
          📍 Nearby
        </div>
        {nearbyLoading && filteredNearby.length === 0 && (
          <div className="px-4 py-2 text-sm text-slate-500">Loading...</div>
        )}
        {filteredNearby.map((place) => (
          <button
            key={place.placeId}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-700 text-left transition-colors"
            onClick={() => {
              setMerchantQuery(place.name);
              setShowMerchantDropdown(false);
              setNearbyPlaces([]);
            }}
          >
            <span className="text-lg">📍</span>
            <div>
              <div className="text-sm font-medium">{place.name}</div>
            </div>
          </button>
        ))}
      </div>
    )}
    {/* Text-search results */}
    {merchantSuggestions.map((m: Merchant) => (
      <button
        key={m.id}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-700 text-left transition-colors"
        onClick={() => { setMerchantQuery(m.name); setShowMerchantDropdown(false); }}
      >
        <span className="text-lg">{m.category_icon}</span>
        <div>
          <div className="text-sm font-medium">{m.name}</div>
          <div className="text-xs text-slate-400">{m.category_name}</div>
        </div>
      </button>
    ))}
  </div>
)}
```

- [ ] **Step 7: Verify TypeScript and tests**

```bash
cd web && npx tsc --noEmit && npm test
```

Expected: All pass, no TypeScript errors.

- [ ] **Step 8: Commit**

```bash
git add web/src/app/page.tsx
git commit -m "feat: add location-based nearby suggestions to web merchant dropdown"
```

---

## Task 7: Mobile client — expo-location + nearby dropdown

**Files:**
- Modify: `mobile/app.json`
- Create: `mobile/__tests__/location.test.ts`
- Modify: `mobile/app/index.tsx`

- [ ] **Step 1: Install `expo-location`**

```bash
cd mobile && npx expo install expo-location
```

Expected: `expo-location` added to `dependencies` in `mobile/package.json`.

- [ ] **Step 2: Add location permissions to `mobile/app.json`**

Read `mobile/app.json` first to understand its structure, then add under `expo`:

```json
"ios": {
  "infoPlist": {
    "NSLocationWhenInUseUsageDescription": "Used to find nearby stores and suggest the best card to use."
  }
},
"android": {
  "permissions": ["ACCESS_COARSE_LOCATION"]
}
```

If `ios` or `android` keys already exist, merge these keys in without removing existing ones.

- [ ] **Step 3: Write failing test at `mobile/__tests__/location.test.ts`**

```typescript
import { requestForegroundPermissionsAsync, getCurrentPositionAsync } from 'expo-location';

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));

// Mirrors the logic in handleMerchantFocus
async function fetchNearbyIfAllowed(): Promise<{ coords: { latitude: number; longitude: number } } | null> {
  const { status } = await requestForegroundPermissionsAsync();
  if (status !== 'granted') return null;
  return getCurrentPositionAsync({});
}

describe('location permission handling', () => {
  beforeEach(() => jest.clearAllMocks());

  it('does not call getCurrentPositionAsync when permission denied', async () => {
    (requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied' });

    const result = await fetchNearbyIfAllowed();

    expect(result).toBeNull();
    expect(getCurrentPositionAsync).not.toHaveBeenCalled();
  });

  it('calls getCurrentPositionAsync when permission granted', async () => {
    (requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
    (getCurrentPositionAsync as jest.Mock).mockResolvedValue({
      coords: { latitude: 37.7749, longitude: -122.4194 },
    });

    const result = await fetchNearbyIfAllowed();

    expect(result).not.toBeNull();
    expect(result?.coords.latitude).toBe(37.7749);
    expect(getCurrentPositionAsync).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 4: Run test to confirm it fails**

```bash
cd mobile && npm test -- location.test.ts
```

Expected: FAIL (expo-location module not found or mock not wired)

- [ ] **Step 5: Update `mobile/app/index.tsx`**

Read the file before editing. Key existing patterns:
- Imports: `useEffect, useState` from `'react'` (no `useRef` yet)
- Merchant TextInput at ~line 228, has `onFocus={() => { setShowCardDropdown(false); setShowMerchantDropdown(true); }}`
- Merchant dropdown renders when `{showMerchantDropdown && merchantSuggestions.length > 0 && (...)}`

**a) Update imports:**

Add `useRef` to the React import:
```typescript
import { useEffect, useState, useRef } from 'react';
```

Add expo-location and NearbyPlace type imports:
```typescript
import * as Location from 'expo-location';
import type { NearbyPlace } from '../lib/shared/types';
```

**b) Add nearby state variables after existing `useState` declarations:**

```typescript
  const [nearbyPlaces, setNearbyPlaces] = useState<NearbyPlace[]>([]);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const coordsRef = useRef<{ lat: number; lng: number } | null>(null);
  const nearbyFetchedRef = useRef(false);
```

**c) Add `fetchNearby` and `handleMerchantFocus` functions inside the component, before `return`:**

Check `mobile/lib/api.ts` for the existing base URL pattern and use the same one. If the API client uses a base URL constant, use it. Otherwise use `'https://pickthebestcard.com'`.

```typescript
  async function fetchNearby(lat: number, lng: number) {
    if (nearbyFetchedRef.current) return;
    nearbyFetchedRef.current = true;
    setNearbyLoading(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (user?.accessToken) headers['x-google-token'] = user.accessToken;
      const res = await fetch('https://pickthebestcard.com/api/nearby-store', {
        method: 'POST',
        headers,
        body: JSON.stringify({ lat, lng }),
      });
      if (res.ok) {
        const data = await res.json();
        setNearbyPlaces(data.places ?? []);
      }
    } catch {
      // silent
    } finally {
      setNearbyLoading(false);
    }
  }

  async function handleMerchantFocus() {
    setShowCardDropdown(false);
    setShowMerchantDropdown(true);
    if (coordsRef.current) {
      fetchNearby(coordsRef.current.lat, coordsRef.current.lng);
      return;
    }
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;
    try {
      const pos = await Location.getCurrentPositionAsync({});
      coordsRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      fetchNearby(coordsRef.current.lat, coordsRef.current.lng);
    } catch {
      // silent
    }
  }
```

**d) Add `filteredNearby` computation before `return`:**

```typescript
  const filteredNearby = nearbyPlaces.filter(
    (p) => !merchantQuery || p.name.toLowerCase().includes(merchantQuery.toLowerCase())
  );
```

**e) Update merchant TextInput's `onFocus`:**

```typescript
// Before:
onFocus={() => { setShowCardDropdown(false); setShowMerchantDropdown(true); }}

// After:
onFocus={handleMerchantFocus}
```

**f) Update merchant dropdown condition and add `📍 Nearby` section:**

Find the block `{showMerchantDropdown && merchantSuggestions.length > 0 && (...)}` and replace with:

```tsx
{showMerchantDropdown && (filteredNearby.length > 0 || nearbyLoading || merchantSuggestions.length > 0) && (
  <View style={s.dropdown}>
    {/* Nearby section */}
    {(filteredNearby.length > 0 || nearbyLoading) && (
      <>
        <Text style={s.nearbyHeader}>📍 Nearby</Text>
        {nearbyLoading && filteredNearby.length === 0 && (
          <Text style={s.nearbyLoading}>Loading...</Text>
        )}
        {filteredNearby.map((place) => (
          <TouchableOpacity
            key={place.placeId}
            style={s.dropdownItem}
            onPress={() => {
              setMerchantQuery(place.name);
              setShowMerchantDropdown(false);
              setNearbyPlaces([]);
            }}
          >
            <Text style={s.emoji}>📍</Text>
            <View>
              <Text style={s.dropdownItemTitle}>{place.name}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </>
    )}
    {/* Text-search results */}
    {merchantSuggestions.map(m => (
      <TouchableOpacity
        key={m.id}
        style={s.dropdownItem}
        onPress={() => { setMerchantQuery(m.name); setShowMerchantDropdown(false); }}
      >
        <Text style={s.emoji}>{m.category_icon}</Text>
        <View>
          <Text style={s.dropdownItemTitle}>{m.name}</Text>
          <Text style={s.dropdownItemSub}>{m.category_name}</Text>
        </View>
      </TouchableOpacity>
    ))}
  </View>
)}
```

**g) Add styles for the nearby section inside the existing `StyleSheet.create({...})`:**

```typescript
  nearbyHeader: { fontSize: 11, color: '#64748b', fontWeight: '600', paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4 },
  nearbyLoading: { fontSize: 14, color: '#94a3b8', paddingHorizontal: 12, paddingVertical: 8 },
```

- [ ] **Step 6: Run mobile tests**

```bash
cd mobile && npm test
```

Expected: All pass including new location tests.

- [ ] **Step 7: TypeScript check**

```bash
cd mobile && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 8: Commit**

```bash
git add mobile/app/index.tsx mobile/app.json mobile/package.json mobile/__tests__/location.test.ts
git commit -m "feat: add location-based nearby suggestions to mobile merchant dropdown"
```

---

## Task 8: Daily merchant promotion pipeline

**Files:**
- Create: `.github/workflows/promote-merchants.yml`

This workflow runs daily and promotes all rows in `merchant_sightings` that don't already have a matching name in `merchants`.

- [ ] **Step 1: Create `.github/workflows/promote-merchants.yml`**

```yaml
name: Promote Merchant Sightings

on:
  schedule:
    - cron: '0 3 * * *'   # 3 AM UTC daily
  workflow_dispatch:        # allow manual runs

jobs:
  promote:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install @neondatabase/serverless
        run: npm install @neondatabase/serverless

      - name: Promote sightings to merchants table
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
        run: |
          node --input-type=module <<'EOF'
          import { neon } from '@neondatabase/serverless';
          const sql = neon(process.env.DATABASE_URL);

          const sightings = await sql`
            SELECT ms.place_id, ms.name, ms.category_id
            FROM merchant_sightings ms
            WHERE NOT EXISTS (
              SELECT 1 FROM merchants m
              WHERE LOWER(m.name) LIKE LOWER(ms.name)
            )
          `;

          let count = 0;
          for (const s of sightings) {
            await sql`
              INSERT INTO merchants (name, category_id, is_online)
              VALUES (${s.name}, ${s.category_id}, false)
              ON CONFLICT DO NOTHING
            `;
            count++;
          }

          console.log(`Promoted ${count} merchant(s)`);
          EOF
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/promote-merchants.yml
git commit -m "feat: add daily merchant promotion pipeline from sightings"
```

---

## Task 9: Environment variable

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Add `GOOGLE_PLACES_API_KEY` to `.env.example`**

Append after existing entries:

```
GOOGLE_PLACES_API_KEY=your-google-places-api-key   # Server-side only, never exposed to client
```

- [ ] **Step 2: Commit**

```bash
git add .env.example
git commit -m "docs: add GOOGLE_PLACES_API_KEY to env example"
```

---

## Task 10: Final verification

- [ ] **Step 1: Run all three test suites**

```bash
cd shared && npm test
cd web && npx tsc --noEmit && npm test
cd mobile && npm test
```

Expected: All pass with no TypeScript errors.

- [ ] **Step 2: Verify new tests are included in coverage**

```bash
cd shared && npm run test:coverage
cd web && npm run test:coverage
cd mobile && npm run test:coverage
```

Expected: `shared/src/nearby.ts`, `web/src/lib/nearby.ts`, and `mobile/__tests__/location.test.ts` appear in coverage output.
