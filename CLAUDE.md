# CLAUDE.md — AI Assistant Rules for This Project

This file contains standing rules for any AI assistant working on this codebase.

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
- Do not duplicate logic between web and mobile directly

### 4. No SQL in Sort/Filter Logic
- Sorting and filtering of results should happen in JS/TS using shared functions
- Do not embed complex regex or sort logic in SQL queries (it breaks silently)

### 5. Run Checks Before Committing
```bash
cd shared && npm test
cd web && npm test && npx tsc --noEmit
cd mobile && npm test
```

## Architecture

```
pickthebestcard/
├── shared/          # Shared types + business logic — single source of truth
│   └── src/
│       ├── types.ts       # Card, Recommendation, Protection, MerchantMatch, etc.
│       ├── format.ts      # formatReward, formatEffectiveValue
│       ├── sort.ts        # sortRecommendations, sortProtections, detectCoverageTier
│       └── *.test.ts      # Tests for all of the above
├── web/             # Next.js app → pickthebestcard.com (Vercel root dir: web/)
│   └── src/shared/  # Synced copy of shared/ for Vercel build
├── mobile/          # Expo React Native iOS app
│   └── lib/shared/  # Synced copy of shared/ for Expo build
└── crawler/         # Weekly benefit crawler (GitHub Actions, Mondays 2 AM PST)
```

## Key Decisions

- **Neon Postgres** is the live DB — never use local SQLite
- **`/api/mobile/cards`** uses Google token auth; **`/api/user/cards`** uses NextAuth sessions — keep them separate
- **`ios/` is gitignored** — run `npx expo prebuild --clean` to regenerate; config lives in `app.json`
- **Amex crawler needs headful browser** — handled via Xvfb in GitHub Actions
- **No npm workspaces** — avoids `lightningcss` native module conflict on Vercel

## Mobile Smoke Test Checklist

Before merging any mobile change, manually verify in the simulator:
- [ ] App launches without crash
- [ ] Google Sign-In works
- [ ] Cards can be added and removed
- [ ] Merchant search returns suggestions
- [ ] "Find Best Card" returns results
- [ ] Protections section shows for car rental / electronics merchants
- [ ] Sign out clears cards, results, and merchant query
