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
5. **Typing:** nearby results are filtered to those matching the typed text and merged above text-search autocomplete results. Known nearby merchants float to the top.
6. User picks a suggestion (nearby or typed) or types a completely different query.
7. All failures (permission denied, rate limited, network error, no results) are silent — the field behaves as if the feature doesn't exist.

---

## Architecture

```
Client (web / mobile)
  → focus on merchant field
    → request GPS (once per session, cached)
      → POST /api/nearby-store { lat, lng }
          → check rate limit (Neon: location_requests)
          → call Google Places Nearby Search API
          → match each place against merchants table
          → log unmatched places to merchant_sightings
          → return [{ name, merchantId?, categoryId?, placeId }]
  → render "📍 Nearby" section in dropdown
  → on typing: filter nearby + merge with text autocomplete
```

---

## Database

### New table: `location_requests` (rate limiting)

```sql
CREATE TABLE location_requests (
  user_id   TEXT,
  ip_hash   TEXT,
  req_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  count     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, req_date)
);
-- Anonymous users tracked via separate rows with user_id = 'anon:<ip_hash>'
```

**Limit:** 100 requests per user per day. Signed-in users identified by `user_id`; anonymous users by SHA-256 hash of IP.

### New table: `merchant_sightings` (dynamic merchant growth)

```sql
CREATE TABLE merchant_sightings (
  place_id      TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  google_types  TEXT[],           -- e.g. ['grocery_or_supermarket', 'food']
  category_id   INTEGER REFERENCES categories(id),
  sighting_count INTEGER NOT NULL DEFAULT 1,
  last_seen     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Promoted to `merchants` table by the daily pipeline on first sighting.

---

## Google Place Types → Category Mapping

| Google type | Our category |
|---|---|
| `grocery_or_supermarket`, `supermarket` | Groceries |
| `restaurant`, `food`, `cafe`, `bakery`, `bar` | Dining & Restaurants |
| `gas_station` | Gas Stations |
| `pharmacy`, `drugstore` | Drugstores & Pharmacy |
| `lodging` | Hotels |
| `home_goods_store`, `hardware_store`, `furniture_store` | Home Improvement |
| `department_store`, `shopping_mall`, `clothing_store` | Online Shopping |
| `electronics_store` | Online Shopping |
| Everything else | General / Everything Else |

---

## API Endpoint

### `POST /api/nearby-store`

**Auth:** Reads NextAuth session (web) or `x-google-token` header (mobile). Falls back to hashed IP for anonymous users — same auth pattern as existing endpoints.

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

- `merchantId`: set if matched in our `merchants` table (exact or fuzzy name match)
- `categoryId`: set from DB match or derived from Google Place types mapping
- Up to 5 results, ordered by distance

**Response (rate limited):**
```json
{ "error": "rate_limited" }
```
HTTP 429 — client silently ignores.

**Google Places call:**
`Nearby Search` with `rankby=distance`, `type=establishment`, radius 150m. Returns closest businesses first.

---

## Shared Types

Add to `shared/src/types.ts`:

```typescript
export interface NearbyPlace {
  name: string;
  merchantId: number | null;
  categoryId: number | null;
  placeId: string;
}
```

Synced to `web/src/shared/` and `mobile/lib/shared/` after changes.

---

## Client Implementation

### Web (`web/src/app/page.tsx`)

- On merchant field `onFocus`: call `navigator.geolocation.getCurrentPosition()` (once, cache coords in state)
- Once coords available, call `/api/nearby-store` (once per session, cache result in state)
- Render nearby places in dropdown above text results when field is empty or matching
- Selecting a nearby place sets the merchant query and — if `merchantId` is set — submits directly

### Mobile (`mobile/app/index.tsx`)

- Same logic using `expo-location` (`requestForegroundPermissionsAsync` + `getCurrentPositionAsync`)
- New dependency: `expo-location`
- `app.json` additions:
  - iOS: `NSLocationWhenInUseUsageDescription`
  - Android: `ACCESS_COARSE_LOCATION` permission

### Dropdown behavior (both platforms)

| State | Dropdown shows |
|---|---|
| Field focused, empty, fetching | Subtle loading indicator in nearby section |
| Field focused, empty, results ready | "📍 Nearby" header + up to 5 places |
| Field focused, empty, no results/error | Nothing (normal empty state) |
| User typing | Nearby places filtered by typed text (if any match) above text autocomplete results |

---

## Dynamic Merchant Pipeline

### GitHub Actions: `promote-merchants.yml`

Runs daily (e.g. 3 AM UTC). Steps:
1. Read all rows from `merchant_sightings` not yet in `merchants` (checked by `place_id` or name fuzzy match)
2. For each: insert into `merchants` with `name` and `category_id` derived from stored `google_types`
3. Log count of promoted merchants

No minimum sighting threshold — all Google-sourced sightings are considered trustworthy.

---

## Environment Variables

| Variable | Where | Purpose |
|---|---|---|
| `GOOGLE_PLACES_API_KEY` | Vercel env + `.env.local` | Server-side Google Places calls |

Never exposed to the client.

---

## Error Handling

All failures are silent on the client:
- GPS permission denied → skip nearby section entirely
- GPS timeout → skip
- Rate limited (429) → skip
- Google Places API error → skip
- No nearby results → skip

The merchant field always works normally regardless of location feature status.

---

## Testing

- Unit test: Google Place types → category mapping function
- Unit test: rate limit check logic (under/at/over limit)
- Integration test: `POST /api/nearby-store` with mocked Google Places response
- Regression test: merchant field works normally when GPS is unavailable
