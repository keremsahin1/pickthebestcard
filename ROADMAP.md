# Roadmap

## Near-term

### Admin Dashboard
Build an admin interface to manage data without direct DB access.
- Fix merchant categories (e.g., miscategorized merchants from auto-save)
- Review and approve/reject merchant_sightings before promotion
- Edit card benefits, add new cards
- View usage stats (location requests, popular merchants)

### Favorite Stores
Let users save a personal list of frequently visited stores for quick access.
- "Star" a merchant after searching — saved to user profile
- Show favorites at the top of the merchant search dropdown (above nearby)
- Sync across web and mobile via existing user_cards-style API
- One-tap "Find Best Card" from favorites list

### Autocomplete Deduplication
Google Places autocomplete returns multiple locations of the same chain (e.g., 5 "Panera Bread"). Deduplicate by name so only one entry appears.

## Medium-term

### Rotating Category Notifications
Push notifications when quarterly rotating categories change (Discover, Chase Freedom Flex, etc.). Alert users which new categories are active and which card to use.

### Spend Cap Tracking
"I spent $X at Y" — track spending against card benefit caps (e.g., "5% up to $1,500/quarter"). Show progress bars and warnings when approaching limits.

### Card Comparison
Side-by-side comparison of two cards across all categories. Help users decide which card to add or drop from their wallet.

### Best Card for a Trip
Multi-merchant scenario: "I'm traveling — need hotel + rental car + dining + gas." Show the best card allocation across all categories for the trip.

## Long-term

### Android App
Port the iOS Expo app to Android. Most code is shared; main work is Google Sign-In config and Play Store setup.

### Browser Extension
Show the best card to use directly on merchant websites. Detect the merchant from the URL/page and display a small overlay with the recommendation.
