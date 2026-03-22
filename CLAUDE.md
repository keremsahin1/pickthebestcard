# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Non-Negotiable Rules

### 1. Tests Are Required
- Every new feature or bug fix must include tests
- Add shared logic tests in `shared/src/*.test.ts`
- Add web-specific tests in `web/src/test/`
- Add mobile-specific tests in `mobile/__tests__/`
- Run `npm test` in `shared/`, `web/`, and `mobile/` before committing
- **Never commit code that breaks existing tests**

### 2. Web and Mobile Must Stay in Sync
- Every feature added to web must be added to mobile, and vice versa
- Every bug fix on one platform must be checked and applied to the other
- If a feature is intentionally platform-specific, say so explicitly

### 3. Shared Logic Lives in `shared/`
- Types, formatting functions, sorting logic → `shared/src/`
- After modifying shared files, sync copies to:
  - `web/src/shared/` (used by Vercel build)
  - `mobile/lib/shared/` (used by Expo build)
- Both platforms import via path alias `@pickthebestcard/shared` which resolves to their local copy
- Do not duplicate logic between web and mobile directly

### 4. No SQL in Sort/Filter Logic
- Sorting and filtering of results should happen in JS/TS using shared functions
- Do not embed complex regex or sort logic in SQL queries (it breaks silently)

### 5. Run Checks Before Committing
```bash
cd shared && npm test
cd web && npx tsc --noEmit && npm test
cd mobile && npm test
```

## Build & Run Commands

### Shared
```bash
cd shared && npm test                    # Vitest — ~49 tests
```

### Web
```bash
cd web && npm run dev                    # Next.js dev server on localhost:3000
cd web && npx tsc --noEmit              # Type check
cd web && npm test                       # Vitest — ~111 tests
```

### Mobile
```bash
cd mobile && npm test                    # Jest — ~28 tests
cd mobile && npx expo start              # Expo dev server
cd mobile && npx expo run:ios            # Native iOS build (simulator)
cd mobile && npx expo prebuild --clean   # Regenerate ios/ directory
```

### Crawler
```bash
cd crawler && node crawl.js              # All issuers
cd crawler && node crawl.js discover     # Single issuer
```

## Architecture

```
pickthebestcard/
├── shared/          # Shared types + business logic — single source of truth
│   └── src/
│       ├── types.ts       # Card, Recommendation, Protection, MerchantMatch, NearbyPlace
│       ├── format.ts      # formatReward, formatEffectiveValue
│       ├── sort.ts        # sortRecommendations, sortProtections, detectCoverageTier
│       ├── nearby.ts      # googleTypesToCategoryName
│       └── *.test.ts      # Tests for all of the above
├── web/             # Next.js 14 app → pickthebestcard.com (Vercel root dir: web/)
│   └── src/
│       ├── app/api/       # API routes (see API Routes below)
│       ├── db/schema.ts   # Neon Postgres connection + initSchema()
│       ├── db/seed.ts     # 80+ cards, 42 categories, 505+ merchants
│       ├── lib/recommend.ts  # findMerchant(), getRecommendations()
│       ├── lib/nearby.ts     # GPS: fetchGooglePlaces(), fetchPlacesAutocomplete()
│       ├── shared/        # Synced copy of shared/ for Vercel build
│       └── test/          # Web-specific tests
├── mobile/          # Expo React Native iOS app
│   ├── app/index.tsx      # Main UI (single-screen app)
│   ├── lib/api.ts         # HTTP client to web API (BASE_URL → pickthebestcard.com)
│   ├── lib/auth.ts        # Google Sign-In + AsyncStorage
│   └── lib/shared/        # Synced copy of shared/ for Expo build
└── crawler/         # Weekly benefit crawler (GitHub Actions, Mondays 2 AM PST)
    ├── crawl.js           # Main entry — iterates issuer sources
    ├── parse.js           # OpenAI GPT-4o-mini benefit parsing
    └── sources/           # Per-issuer crawlers (discover, chase, amex, etc.)
```

## API Routes

| Route | Method | Auth | Description |
|-------|--------|------|-------------|
| `/api/cards` | GET | None | All credit cards |
| `/api/categories` | GET | None | All spend categories |
| `/api/merchants?q=...` | GET | None | Search merchants by name |
| `/api/recommend` | POST | None | `{cardIds, merchant, categoryId}` → recommendations + protections |
| `/api/nearby-store` | POST | Optional | `{lat, lng}` → nearest store (Google Places, rate-limited) |
| `/api/places-autocomplete?q=...` | GET | None | Google Places autocomplete fallback |
| `/api/user/cards` | GET/POST/DELETE | NextAuth session | Web user's saved cards |
| `/api/mobile/cards` | GET/POST/DELETE | `x-google-token` header | Mobile user's saved cards |

## Key Decisions

- **Neon Postgres** is the live DB — never use local SQLite
- **`/api/mobile/cards`** uses Google token auth; **`/api/user/cards`** uses NextAuth sessions — keep them separate
- **`ios/` is gitignored** — run `npx expo prebuild --clean` to regenerate; config lives in `app.json`
- **Amex crawler needs headful browser** — handled via Xvfb in GitHub Actions
- **No npm workspaces** — avoids `lightningcss` native module conflict on Vercel
- **Merchant autocomplete** — DB search first; Google Places Autocomplete only when DB returns 0 results (chained, not parallel, to avoid race conditions)
- **Auto-save merchants** — Unknown merchants are saved to DB on "Find Best Card" so future searches skip Google API
- **Merchant sightings pipeline** — GPS-discovered places logged to `merchant_sightings`, promoted to `merchants` daily via GitHub Actions

## Database Tables

| Table | Purpose |
|-------|---------|
| `cards` | Credit cards (issuer, name, reward_type, points_value, base_rate) |
| `card_benefits` | Reward rates per card/category/merchant (supports rotating categories via valid_from/valid_until) |
| `card_protections` | Car rental insurance + extended warranty (primary/secondary tier) |
| `categories` | 42 spend categories (Groceries, Gas, Dining, etc.) |
| `merchants` | 505+ known merchants (name, domain, category_id, is_online) |
| `merchant_tags` | Multi-tag system: `car_rental`, `extended_warranty_eligible` |
| `merchant_sightings` | GPS discoveries — promoted to merchants table daily |
| `location_requests` | Rate limiting: 100 req/day per user key |
| `users` / `user_cards` | User accounts and saved card selections |

## Environment Variables

| Variable | Used By | Notes |
|----------|---------|-------|
| `DATABASE_URL` | web, crawler | Neon Postgres connection string |
| `GOOGLE_CLIENT_ID` | web | OAuth (also in mobile/app.json) |
| `GOOGLE_CLIENT_SECRET` | web | NextAuth only |
| `NEXTAUTH_SECRET` | web | Session signing key |
| `NEXTAUTH_URL` | web | `http://localhost:3000` locally |
| `GOOGLE_PLACES_API_KEY` | web | Server-side only — nearby + autocomplete |
| `OPENAI_API_KEY` | crawler | GPT-4o-mini benefit parsing |

## GitHub Actions Workflows

- **test.yml** — Runs on push/PR: tests all three packages, generates coverage badge
- **crawler.yml** — Mondays 2 AM PST: crawls card benefits from issuer websites
- **promote-merchants.yml** — Daily 3 AM UTC: promotes merchant_sightings to merchants table

## Mobile Smoke Test Checklist

Before merging any mobile change, manually verify on device/simulator:
- [ ] App launches without crash
- [ ] Google Sign-In works
- [ ] Cards can be added and removed
- [ ] Merchant search returns suggestions
- [ ] "Find Best Card" returns results
- [ ] Protections section shows for car rental / electronics merchants
- [ ] Nearby stores appear when location is granted
- [ ] Sign out clears cards, results, and merchant query
