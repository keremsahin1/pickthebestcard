# Contributing

## Project Structure

```
pickthebestcard/
├── shared/    # Shared types and business logic (used by web + mobile)
├── web/       # Next.js web app → pickthebestcard.com
├── mobile/    # Expo React Native iOS app
└── crawler/   # Weekly benefit crawler (runs via GitHub Actions)
```

## Development Setup

### Web
```bash
cd web
npm install
cp ../.env.example .env.local  # fill in DATABASE_URL, GOOGLE_CLIENT_ID, etc.
npm run dev
```

### Mobile
```bash
cd mobile
npm install --legacy-peer-deps
npx expo run:ios
```

### Shared
```bash
cd shared
npm install
npm test
```

## Making Changes

### Shared logic (types, formatting, sorting)
- Edit files in `shared/src/`
- Add or update tests in `shared/src/*.test.ts`
- Run `npm test` in `shared/` before committing
- TypeScript will flag mismatches in web and mobile at compile time

### Web changes
- Run `npm test` in `web/` before committing
- Check `npx tsc --noEmit` passes with no errors

### Mobile changes
- Run `npm test` in `mobile/` before committing
- **Always do a simulator smoke test before pushing:**
  1. `npx expo run:ios`
  2. Sign in with Google
  3. Add 2-3 cards
  4. Search a merchant (e.g. "Costco", "Enterprise")
  5. Verify results and protections show correctly
  6. Sign out — confirm cards and results clear

## Tests

| Package  | Framework | Run              |
|----------|-----------|------------------|
| `shared` | Vitest    | `cd shared && npm test` |
| `web`    | Vitest    | `cd web && npm test`    |
| `mobile` | Jest      | `cd mobile && npm test` |

CI runs all three on every push to `main` and every PR. PRs with failing tests should not be merged.

## Crawler

The benefit crawler runs every Monday at 2 AM PST via GitHub Actions.

To run manually:
```bash
cd crawler
node crawl.js               # all issuers (Amex requires display)
node crawl.js chase-cards   # single issuer
```

Amex requires a visible browser. Locally: just run `node crawl.js amex-cards` (a Chrome window will open). In CI, Xvfb provides a virtual display automatically.

## Deployment

- **Web**: push to `main` → Vercel auto-deploys
- **iOS**: archive in Xcode → upload to App Store Connect
  - Run `npx expo prebuild --clean` after any `app.json` changes
  - Set `ENABLE_USER_SCRIPT_SANDBOXING = No` in Xcode Build Settings

## Environment Variables

| Variable               | Where       | Description                        |
|------------------------|-------------|------------------------------------|
| `DATABASE_URL`         | web, crawler | Neon Postgres connection string    |
| `GOOGLE_CLIENT_ID`     | web         | Google OAuth client ID             |
| `GOOGLE_CLIENT_SECRET` | web         | Google OAuth client secret         |
| `NEXTAUTH_SECRET`      | web         | Random secret for session signing  |
| `NEXTAUTH_URL`         | web         | Deployment URL                     |
| `OPENAI_API_KEY`       | crawler     | For LLM-assisted benefit extraction|
