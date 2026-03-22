# Location-Based Store Recommendation — Design Spec

**Date:** 2026-03-21
**Status:** Approved

---

## Overview

When a user focuses the "Where are you shopping?" merchant field, the app silently acquires their GPS location, calls a server-side nearby-places endpoint, and surfaces up to 5 nearby businesses as suggestions at the top of the dropdown. The user can pick one or ignore them and type freely. Unknown merchants discovered via Google Places are logged and promoted to the merchant DB via a daily pipeline, organically growing the merchant list over time.

---

## User Flow

1. User taps/clicks the merchant search field.
2. App requests GPS permission (once per session; result cached in component state).
3. App calls `POST /api/nearby-store` with `{ lat, lng }`.
4. **Empty field:** dropdown shows a "📍 Nearby" section with up to 5 places.
5. **Typing:** nearby results filtered by typed text float to the top, merged above text-search autocomplete results.
6. User picks a suggestion (nearby or typed) or types a completely different query.
7. All failures (permission denied, rate limited, network error, no results) are silent — the field behaves as if the feature doesn't exist.

---

## Architecture

```
Client (web / mobile)
  → focus on merchant field
    → request GPS (once per session, cached)
      → POST /api/nearby-store { lat, lng }
          → resolve user key (user_id or 'anon:<ip_hash>')
          → atomic rate limit upsert (Neon: location_requests)
          → call Google Places Nearby Search API
          → match each place against merchants table (LIKE)
          → log unmatched places to merchant_sightings
          → return [{ name, merchantId?, categoryId?, placeId }]
  → render "📍 Nearby" section in dropdown
  → on typing: filter nearby + merge with text autocomplete
```

---

## Database

Both new tables are added to the existing `initSchema()` function in `web/src/db/schema.ts` using `CREATE TABLE IF NOT EXISTS`.

### New table: `location_requests` (rate limiting)

```sql
CREATE TABLE IF NOT EXISTS location_requests (
  user_key  TEXT NOT NULL,          -- user_id for signed-in, 'anon:<sha256(ip)>' for anonymous
  req_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  count     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_key, req_date)
);
```

**Limit:** 100 requests per `user_key` per day (UTC date). Atomic upsert:
```sql
INSERT INTO location_requests (user_key, req_date, count)
VALUES ($key, CURRENT_DATE, 1)
ON CONFLICT (user_key, req_date)
DO UPDATE SET count = location_requests.count + 1
RETURNING count;
```
If returned `count > 100`, reject with 429. The increment happens before the Google API call — this is intentional; failed/abusive requests still consume quota.

### New table: `merchant_sightings` (dynamic merchant growth)

```sql
CREATE TABLE IF NOT EXISTS merchant_sightings (
  place_id       TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  google_types   TEXT[],           -- e.g. ['grocery_or_supermarket', 'food']
  category_id    INTEGER REFERENCES categories(id),
  sighting_count INTEGER NOT NULL DEFAULT 1,
  last_seen      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Promoted to `merchants` table by the daily pipeline on first sighting. Promoted merchants get `is_online = false` (Google Places returns physical locations only).

---

## Google Place Types → Category Mapping

Mapping function lives in `shared/src/nearby.ts` (shared between web API and any future mobile use). Synced to `web/src/shared/` and `mobile/lib/shared/`.

| Google type | Our category |
|---|---|
| `grocery_or_supermarket`, `supermarket` | Groceries |
| `restaurant`, `food`, `cafe`, `bakery`, `bar` | Dining & Restaurants |
| `gas_station` | Gas Stations |
| `pharmacy`, `drugstore` | Drugstores & Pharmacy |
| `lodging` | Hotels |
| `home_goods_store`, `hardware_store`, `furniture_store` | Home Improvement |
| `department_store`, `shopping_mall`, `clothing_store`, `electronics_store` | Online Shopping |
| Everything else | General / Everything Else |

---

## API Endpoint

### `POST /api/nearby-store`

This single endpoint serves both web and mobile — no separate `/api/mobile/nearby-store` needed. Auth is resolved in this order:
1. NextAuth session cookie (web)
2. `x-google-token` header (mobile) — verified via Google userinfo API (same as `/api/mobile/cards`)
3. Hashed IP fallback for unauthenticated requests (SHA-256 of `X-Forwarded-For` or `req.ip`)

The endpoint is callable without auth (anonymous users get IP-based rate limiting).

**Request body:**
```json
{ "lat": 37.7749, "lng": -122.4194 }
```

**Response (success):**
```json
{
  "places": [
    { "name": "Whole Foods Market", "merchantId": 56, "categoryId": 1, "placeId": "ChIJ..." },
    { "name": "Shell",              "merchantId": null, "categoryId": 562, "placeId": "ChIJ..." }
  ]
}
```

- `merchantId`: set if matched in our `merchants` table via `LOWER(name) LIKE LOWER($name)` (same pattern as `findMerchant()`)
- `categoryId`: from DB match if found, otherwise derived from Google Place types mapping
- Up to 5 results; Google returns them ordered by distance when `rankby=distance`

**Response (rate limited):**
```json
{ "error": "rate_limited" }
```
HTTP 429 — client silently ignores.

**Google Places call:**
`Nearby Search` with `rankby=distance`, `type=establishment`. No fixed radius when using `rankby=distance` (Google requirement). Returns closest businesses first.

---

## Shared Types & Logic

Add to `shared/src/types.ts`:
```typescript
export interface NearbyPlace {
  name: string;
  merchantId: number | null;
  categoryId: number | null;
  placeId: string;
}
```

Add `shared/src/nearby.ts`:
```typescript
// googleTypesToCategoryName(types: string[]): string
// Maps Google Place types array to our category name string
```

Synced to `web/src/shared/` and `mobile/lib/shared/` after any changes.

---

## Client Implementation

### Web (`web/src/app/page.tsx`)

- On merchant field `onFocus`: call `navigator.geolocation.getCurrentPosition()` (once, cache coords in state)
- Once coords available, call `/api/nearby-store` (once per session, cache result in state)
- Render nearby places in dropdown above text results when field is empty or typed text matches
- Selecting a nearby place sets the merchant query and, if `merchantId` is set, bypasses text search

### Mobile (`mobile/app/index.tsx`)

- Same logic using `expo-location` (`requestForegroundPermissionsAsync` + `getCurrentPositionAsync`)
- New dependency: `expo-location` (install via `npx expo install expo-location`)
- `app.json` additions under `expo.plugins`:
  - `NSLocationWhenInUseUsageDescription`: "Used to find nearby stores and suggest the best card to use."
  - Android: `ACCESS_COARSE_LOCATION` permission

### Dropdown behavior (both platforms)

| State | Dropdown shows |
|---|---|
| Field focused, empty, fetching | Subtle loading indicator in nearby section |
| Field focused, empty, results ready | "📍 Nearby" header + up to 5 places |
| Field focused, empty, no results/error | Nothing (normal empty state) |
| User typing | Nearby places filtered by typed text above text autocomplete results |

---

## Dynamic Merchant Pipeline

### GitHub Actions: `.github/workflows/promote-merchants.yml`

Runs daily at 3 AM UTC. Uses `DATABASE_URL` secret (already configured). Steps:
1. Query `merchant_sightings` for all `place_id` values not present in `merchants` (by name LIKE match or missing from merchants entirely)
2. For each: `INSERT INTO merchants (name, category_id, is_online) VALUES ($name, $categoryId, false) ON CONFLICT DO NOTHING`
3. Log count of promoted merchants

Fully idempotent — safe to re-run. No minimum threshold; all Google-sourced sightings are trusted.

---

## Environment Variables

| Variable | Where | Purpose |
|---|---|---|
| `GOOGLE_PLACES_API_KEY` | Vercel env + `.env.local` + GitHub Actions secret | Server-side Google Places calls only |

Never exposed to the client. Add to `.env.example` as a placeholder.

---

## Error Handling

All failures are silent on the client:
- GPS permission denied → skip nearby section
- GPS timeout → skip
- Rate limited (429) → skip
- Google Places API error → skip
- No nearby results → skip

The merchant field always works normally regardless of location feature status.

---

## Testing

| Test | File |
|---|---|
| `googleTypesToCategoryName()` maps all known types correctly | `shared/src/nearby.test.ts` |
| `googleTypesToCategoryName()` returns General for unknown types | `shared/src/nearby.test.ts` |
| Rate limit: first request succeeds, 101st returns 429 | `web/src/test/nearby-store.test.ts` |
| `POST /api/nearby-store` with mocked Google response returns NearbyPlace[] | `web/src/test/nearby-store.test.ts` |
| Merchant field works normally when GPS permission denied | `mobile/__tests__/location.test.ts` |
| Selecting a nearby place pre-fills merchant query | `web/src/test/nearby-store.test.ts` |
