# CardWise 💳

> Never leave rewards on the table. CardWise tells you exactly which credit card to use at any store.

![CardWise Results](./screenshot-results.png)

🌐 **Live at [card-optimizer-sandy.vercel.app](https://card-optimizer-sandy.vercel.app)**

## The Problem

You have multiple credit cards. Each one earns different rewards at different stores — 5% here, 3x points there, rotating categories that change every quarter. Keeping track of it all is a full-time job.

CardWise solves this with a simple question: **where are you shopping?** It tells you which card in your wallet earns the most.

## Features

- 🔍 **Search any store** — Amazon, Costco, Nike, Starbucks, and 40+ more preloaded
- 💳 **Your cards, your wallet** — add the cards you actually own
- 🏆 **Instant ranked recommendations** — best card at the top, every time
- 🔄 **Rotating category support** — Discover 5%, Chase Freedom Flex, and others tracked with active dates
- ⚠️ **Smart warnings** — activation reminders, spend caps, expiry dates
- 👤 **Google sign-in** — save your wallet so you never re-enter cards again
- 🌙 **Dark mode UI** — easy on the eyes

## How It Works

1. Sign in with Google (optional, but saves your wallet)
2. Add the credit cards you own
3. Type where you're shopping
4. See which card wins and why

CardWise maps merchants to reward categories and cross-references them against each card's current benefit structure — including rotating quarterly bonuses that card issuers change every few months.

## Screenshots

### Empty State
![CardWise Empty](./screenshot-empty.png)

### Recommendations
![CardWise Results](./screenshot-results.png)

## Supported Cards (18 cards, expanding)

| Issuer | Cards |
|--------|-------|
| Chase | Sapphire Preferred, Sapphire Reserve, Freedom Unlimited, Freedom Flex |
| American Express | Gold, Platinum, Blue Cash Preferred, Blue Cash Everyday |
| Citi | Double Cash, Custom Cash |
| Capital One | Venture X, Savor Cash Rewards |
| Discover | Discover it Cash Back |
| Others | Amazon Prime Visa, Apple Card, Wells Fargo Active Cash, Bank of America Travel Rewards, US Bank Cash+ |

## Tech Stack

- **Frontend**: Next.js 16 (App Router) + Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: [Neon](https://neon.tech) (serverless Postgres)
- **Auth**: NextAuth.js v4 with Google OAuth
- **Crawler**: Playwright + stealth mode (scrapes Discover and Chase benefit pages weekly)
- **Hosting**: [Vercel](https://vercel.com)

## Getting Started

### Prerequisites

- Node.js 18+
- A [Neon](https://neon.tech) database (free tier works)
- A Google OAuth app ([create one here](https://console.cloud.google.com))

### Setup

```bash
# Install dependencies
npm install

# Copy env template and fill in your values
cp .env.example .env.local
```

**.env.local:**
```env
DATABASE_URL=postgresql://...        # Neon connection string
GOOGLE_CLIENT_ID=...                 # Google OAuth client ID
GOOGLE_CLIENT_SECRET=...             # Google OAuth client secret
NEXTAUTH_URL=http://localhost:3000   # Your app URL
NEXTAUTH_SECRET=your-random-secret   # Any random string
```

```bash
# Run dev server (seeds DB automatically on first run)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Running the Benefit Crawler

```bash
# Crawl all sources (Discover + Chase Freedom Flex)
node crawler/crawl.js

# Crawl a specific source
node crawler/crawl.js discover
node crawler/crawl.js chase-freedom-flex

# With OpenAI fallback for smarter parsing
OPENAI_API_KEY=sk-... node crawler/crawl.js
```

Set up a weekly cron to keep benefits fresh:
```
0 4 * * 1 cd /path/to/cardwise && node crawler/crawl.js >> crawler.log 2>&1
```

## Architecture

```
src/
├── app/
│   ├── page.tsx                  # Main UI
│   └── api/
│       ├── auth/[...nextauth]/   # Google OAuth (NextAuth)
│       ├── cards/                # GET all cards
│       ├── merchants/            # GET merchant search
│       ├── recommend/            # POST recommendation engine
│       └── user/cards/           # GET/POST/DELETE saved wallet
├── db/
│   ├── schema.ts                 # Neon Postgres schema + init
│   └── seed.ts                   # Card benefits seed data
└── lib/
    ├── auth.ts                   # NextAuth config
    └── recommend.ts              # Core recommendation logic

crawler/
├── crawl.js                      # Main crawler runner
├── db.js                         # DB helpers for crawler
├── parse.js                      # LLM-based benefit parser
└── sources/
    ├── discover.js               # Discover 5% calendar
    └── chase-freedom-flex.js     # Chase Freedom Flex categories
```

### Recommendation Logic

Given a set of card IDs and a merchant query:

1. Fuzzy-match the merchant name/domain to known merchants
2. Map merchant → category (e.g. Whole Foods → Groceries)
3. For each card, find the best matching benefit:
   - Merchant-specific benefit (highest priority)
   - Category benefit
   - Base reward rate (fallback)
4. Sort by effective rate, accounting for points vs. cashback value

### Rotating Categories

Cards like Discover it and Chase Freedom Flex offer 5% on rotating categories that change quarterly. These are modeled with `valid_from` / `valid_until` date ranges and `requires_activation` flags, so CardWise only shows them when they're currently active. The crawler updates these weekly.

## Deploying to Vercel

1. Push to GitHub
2. Import project at [vercel.com/new](https://vercel.com/new)
3. Add environment variables in Vercel dashboard
4. Add your Vercel URL to Google OAuth authorized redirect URIs:
   `https://your-app.vercel.app/api/auth/callback/google`

## Roadmap

- [ ] **More cards** — expand to 50+ cards
- [ ] **More crawler sources** — Amex, Citi, Capital One
- [ ] **Mobile app** — React Native version
- [ ] **Browser extension** — auto-suggest best card when checking out online
- [ ] **Points valuation** — factor in transfer partners and redemption values

## Contributing

Pull requests welcome! The most valuable contributions right now:
- Keeping `src/db/seed.ts` up to date with current card benefits
- Adding new crawler sources in `crawler/sources/`
- Adding more merchants to the database

## License

MIT
