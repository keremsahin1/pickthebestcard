[![Weekly Benefit Crawler](https://github.com/keremsahin1/pickthebestcard/actions/workflows/crawler.yml/badge.svg)](https://github.com/keremsahin1/pickthebestcard/actions/workflows/crawler.yml)
[![Tests](https://github.com/keremsahin1/pickthebestcard/actions/workflows/test.yml/badge.svg)](https://github.com/keremsahin1/pickthebestcard/actions/workflows/test.yml)
![Coverage](https://raw.githubusercontent.com/keremsahin1/pickthebestcard/main/coverage-badge.svg)

# Pick The Best Card 💳

> Never leave rewards on the table. Pick The Best Card tells you exactly which credit card to use at any store.

🌐 **Live at [pickthebestcard.com](https://pickthebestcard.com)**  
📱 **[Download on the App Store](https://apps.apple.com/us/app/pick-the-best-card/id6760002381)**

## The Problem

You have multiple credit cards. Each one earns different rewards at different stores — 5% here, 3x points there, rotating categories that change every quarter. Keeping track of it all is a full-time job.

Pick The Best Card solves this: **type where you're shopping**, and it tells you which card in your wallet earns the most.

## Features

- 🔍 **Search any store** — 500+ merchants across 42 categories with smart fallback for unknown merchants
- 📍 **Location-aware suggestions** — GPS-based nearby store detection; tap to instantly get the best card for where you are
- 🔎 **Google Places autocomplete** — when a merchant isn't in the database, Google Places fills in with automatic category mapping; merchants are auto-saved to the DB on first lookup
- 💳 **Your wallet** — add the cards you actually own; synced across web and iOS
- 🏆 **Instant ranked recommendations** — best card first, with effective % value for points cards
- 🔄 **Rotating category support** — Discover 5%, Chase Freedom Flex, and others tracked with active dates
- 💰 **Points valuation** — converts points to real dollar value (e.g. 3x Chase UR ≈ 6% value)
- 🛡️ **Card protection benefits** — shows car rental insurance and extended warranty coverage ranked by primary/secondary tier and coverage amount
- 🏨 **Loyalty card accuracy** — hotel/airline cards (Hyatt, IHG, Marriott, Hilton, Delta, United) earn bonus points only at their own brand, not competitors
- ⛽ **Merchant-specific rates** — e.g. Costco Anywhere Visa earns 5% at Costco Gas, 4% at other gas stations
- 🌐 **Online vs. in-store** — distinguishes online-only card benefits
- 🔗 **Official benefit links** — direct links to each card's benefits page

## Monorepo Structure

```
pickthebestcard/
├── web/              # Next.js web app → pickthebestcard.com
├── mobile/           # Expo React Native iOS app
├── shared/           # Shared types + business logic (single source of truth)
└── crawler/          # Weekly benefit crawler (GitHub Actions)
```

### Shared Package
`shared/` contains all types and pure functions used by both web and mobile:
- **Types**: `Card`, `Recommendation`, `Protection`, `MerchantMatch`, `MerchantTag`, `NearbyPlace`
- **Functions**: `formatReward`, `formatEffectiveValue`, `sortRecommendations`, `sortProtections`, `detectCoverageTier`, `googleTypesToCategoryName`

Because Vercel only builds `web/` and Expo only builds `mobile/`, the shared source is copied into `web/src/shared/` and `mobile/lib/shared/` at dev time. Both use a TypeScript path alias `@pickthebestcard/shared` that resolves to their local copy.

## Stack

### Web (`web/`)
- **Framework**: Next.js 14 (App Router)
- **Auth**: NextAuth v4 with Google Sign-In
- **Database**: Neon Postgres (serverless)
- **Styling**: Tailwind CSS
- **Analytics**: Vercel Analytics + Speed Insights
- **Tests**: Vitest (111 tests)
- **Deployment**: Vercel (root directory: `web/`)

### Mobile (`mobile/`)
- **Framework**: Expo + React Native (Expo Router)
- **Auth**: `@react-native-google-signin/google-signin` (native SDK)
- **Card sync**: `/api/mobile/cards` endpoint (Google token auth)
- **Tests**: Jest (28 tests)
- **Platform**: iOS only

### Crawler (`crawler/`)
- Puppeteer-based; runs on GitHub Actions every Monday 10:00 UTC
- Parses benefit pages via OpenAI GPT-4o-mini
- Covers: Chase, Amex (headful via Xvfb), Capital One, Citi, US Bank, BofA, Discover
- LLM extracts: fixed rewards, rotating rewards, car rental insurance, extended warranty
- Merchant-specific rates returned by LLM (e.g. "5% at Costco Gas, 4% elsewhere" → two entries)

## Database Schema

| Table | Rows | Description |
|-------|------|-------------|
| `cards` | 80 | Credit cards with issuer, reward type, points value |
| `card_benefits` | 315 | Fixed + rotating reward rates; supports merchant-specific and category-level rates |
| `card_protections` | 21 | Car rental insurance + extended warranty with primary/secondary tier |
| `categories` | 42 | Spend categories (Groceries, Hotels, Gas Stations, etc.) |
| `merchants` | 505 | Known merchants with category and domain |
| `merchant_tags` | 33 | Multi-tag system: `car_rental`, `extended_warranty_eligible` |
| `merchant_sightings` | dynamic | GPS-discovered places, promoted to merchants daily |
| `location_requests` | dynamic | Rate limiting for GPS feature (100/day per user) |
| `users` | — | Signed-up users |
| `user_cards` | — | Cards saved per user |

## Cards Supported

80+ cards across all major issuers:
- **Chase** — Sapphire, Freedom, Ink, United, Marriott, Hyatt, IHG, Southwest, World of Hyatt
- **American Express** — Platinum, Gold, Green, Delta, Hilton, Marriott Bonvoy
- **Capital One** — Venture X, Venture, Savor, Quicksilver
- **Citi** — Double Cash, Strata Premier, Custom Cash, Costco Anywhere Visa
- **Discover, US Bank, Bank of America, Wells Fargo** — key rewards cards

## Local Development

### Prerequisites
- Node.js 18+
- A Neon Postgres database (free tier works)
- Google OAuth credentials

### Web
```bash
git clone https://github.com/keremsahin1/pickthebestcard.git
cd pickthebestcard/web
npm install
cp .env.example .env.local
# Fill in: DATABASE_URL, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, NEXTAUTH_SECRET, NEXTAUTH_URL
npm run dev
```

### Mobile
```bash
cd pickthebestcard/mobile
npm install
npx expo run:ios
```

> **Note:** `ios/` is gitignored (Expo managed workflow). Run `npx expo prebuild --clean` to regenerate it. Google Sign-In requires a native build — Expo Go is not supported.

### Running Tests
```bash
cd shared && npm test          # 49 shared logic tests
cd web && npx tsc --noEmit && npm test   # 111 web tests
cd mobile && npm test          # 28 mobile tests
```

## Environment Variables

| Variable | Where | Description |
|----------|-------|-------------|
| `DATABASE_URL` | web, crawler | Neon Postgres connection string |
| `GOOGLE_CLIENT_ID` | web | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | web | Google OAuth client secret |
| `NEXTAUTH_SECRET` | web | Random secret for session signing |
| `NEXTAUTH_URL` | web | Your deployment URL |
| `GOOGLE_PLACES_API_KEY` | web | Google Places API (nearby + autocomplete) |
| `OPENAI_API_KEY` | crawler | GPT-4o-mini for benefit parsing |

## Deployment

- **Web**: Push to `main` → Vercel auto-deploys (root directory: `web/`)
- **iOS**: Archive via Xcode → upload to App Store Connect
  - Set `ENABLE_USER_SCRIPT_SANDBOXING = No` in Xcode Build Settings
  - Run `npx expo prebuild --clean` before archiving after config changes
- **Crawler**: Runs automatically on GitHub Actions every Monday; can be triggered manually via workflow dispatch
- **Merchant promotion**: Daily GitHub Action promotes GPS-discovered merchants from `merchant_sightings` to `merchants` table

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions, test commands, and the mobile smoke test checklist.
