[![Weekly Benefit Crawler](https://github.com/keremsahin1/pickthebestcard/actions/workflows/crawler.yml/badge.svg)](https://github.com/keremsahin1/pickthebestcard/actions/workflows/crawler.yml)

# Pick The Best Card 💳

> Never leave rewards on the table. Pick The Best Card tells you exactly which credit card to use at any store.

🌐 **Live at [pickthebestcard.com](https://pickthebestcard.com)**  
📱 **iOS App** — submitted to the App Store

## The Problem

You have multiple credit cards. Each one earns different rewards at different stores — 5% here, 3x points there, rotating categories that change every quarter. Keeping track of it all is a full-time job.

Pick The Best Card solves this with a simple question: **where are you shopping?** It tells you which card in your wallet earns the most.

## Features

- 🔍 **Search any store** — 500+ merchants preloaded across 27 categories
- 💳 **Your wallet** — add the cards you actually own
- 🏆 **Instant ranked recommendations** — best card at the top, every time
- 🔄 **Rotating category support** — Discover 5%, Chase Freedom Flex, and others tracked with active dates
- 💰 **Points valuation** — converts points to real dollar value (e.g. 3x Chase UR ≈ 6¢)
- 🔗 **Official benefit links** — links to each card's official benefits page
- 🌐 **Online vs. in-store** — distinguishes online-only benefits
- 📱 **iOS app** — full native app with Google Sign-In and card sync

## Monorepo Structure

```
pickthebestcard/
├── web/          # Next.js web app (deployed to Vercel)
└── mobile/       # Expo React Native iOS app
```

## Stack

### Web (`web/`)
- **Framework**: Next.js (App Router)
- **Auth**: NextAuth v4 with Google Sign-In
- **Database**: Neon Postgres (serverless)
- **Styling**: Tailwind CSS
- **Analytics**: Vercel Analytics + Speed Insights
- **Deployment**: Vercel (root directory: `web/`)

### Mobile (`mobile/`)
- **Framework**: Expo + React Native (Expo Router)
- **Auth**: `@react-native-google-signin/google-signin` (native)
- **Card sync**: Custom `/api/mobile/cards` endpoint (Google token auth)
- **Platform**: iOS only

## Cards Supported

80+ cards across all major issuers:
- **Chase** — Sapphire, Freedom, Ink, co-branded
- **American Express** — Platinum, Gold, Delta, Hilton, Marriott
- **Capital One** — Venture X, Savor, Quicksilver
- **Citi** — Double Cash, Strata Premier, Custom Cash, Costco
- **Discover, US Bank, Bank of America, Wells Fargo** — key cards

## Local Development

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

> **Note:** The `ios/` folder is gitignored (Expo managed workflow). Run `npx expo prebuild --clean` to regenerate it. Google Sign-In requires a physical device or simulator with the native build — Expo Go is not supported.

## Environment Variables

### Web (`web/.env.local`)
| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Neon Postgres connection string |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `NEXTAUTH_SECRET` | Random secret for session signing |
| `NEXTAUTH_URL` | Your deployment URL |

## Deployment

- **Web**: Push to `main` → Vercel auto-deploys (root directory: `web/`)
- **iOS**: Archive via Xcode → upload to App Store Connect
  - Set `ENABLE_USER_SCRIPT_SANDBOXING = No` in Xcode Build Settings to fix sandbox errors
  - Run `npx expo prebuild --clean` before archiving after any config changes
