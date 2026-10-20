# CartRadar

A grocery assistant for the Bee wearable. It reads the conversations Bee captures, picks out what you said you need ("we're out of eggs", "we need noodles"), builds a shopping list, and reminds you when you're near a grocery store.

Built with Expo (React Native + TypeScript), so it runs on iOS and Android.

## How it works

1. **Listen.** The app pulls recent Bee transcripts when it opens and periodically in the background.
2. **Extract.** An on-device rule-based extractor (`src/core/extractor.ts`) finds grocery needs: "out of X", "ran out of X", "we need to buy X", "add X to the list", "the milk is gone", and so on. It handles lists ("eggs, milk and bread"), quantities ("two dozen eggs"), and negations ("we don't need rice"), and only accepts phrases containing a grocery word, so "we're out of time" is ignored.
3. **List.** Items are de-duplicated ("egg" and "eggs" are the same) and shown with the phrase that triggered them. A recently checked-off item isn't re-added for 12 hours.
4. **Remind.** Enter the zip code you shop in; CartRadar finds nearby grocery stores (OpenStreetMap) and sets up geofences. Arriving at one sends a notification with what's on your list (at most once every 2 hours per store).
5. **Leftovers.** Leaving a store after at least 3 minutes ends the trip. Checked-off items go to history. Everything else is handled by the Settings toggle **Send leftovers to my cart**:
   - **Off:** leftovers stay on the list for the next trip, marked "Carried over".
   - **On:** leftovers move to the **Cart queue** tab, where each item opens a prefilled search in your shopping app (Amazon Fresh, Instacart or Walmart).

   Nothing is ever deleted automatically. A **Finish trip** button does the same thing manually.

## Privacy

- Transcripts are processed on the phone. Only phrases that added an item are kept (last 50, visible on the **Heard** tab); every other utterance is discarded after processing.
- The Bee token is stored in the OS keychain/keystore (`expo-secure-store`).
- Recording other people has legal consent requirements in many places. That's between you and your Bee device, but worth knowing.

## Run it

```bash
npm install
npm test            # extractor + list/geofence logic
npm run typecheck
npx expo run:android   # or: npx expo run:ios (macOS)
```

This needs a **development build**, not Expo Go: background location, geofencing, and background tasks aren't available in Expo Go. Alternatively use `npx eas-cli build --profile development`.

To try everything without a Bee device, open **Settings → Demo mode**. Pull down on the list to feed in the next lines of a scripted conversation.

## Things you should know

- **Bee API not verified.** `docs.bee.computer` wasn't reachable when this was written, so the endpoints in `src/bee/client.ts` (`/v1/conversations`, bearer token) are assumptions from secondary sources. Everything Bee-specific lives in that one file. Check it against the real docs before relying on it.
- **Getting a Bee token on a phone.** Bee's documented developer flow is a desktop CLI login (`bee login`). I don't know of an in-app OAuth flow, so the app currently asks you to paste an access token. If Bee offers OAuth for third-party apps, that's the right replacement.
- **"Add to cart" is a hand-off, not a silent add.** Amazon, Instacart and Walmart don't expose a public API to add items to a user's cart. The Cart queue opens each item's search in the retailer's app. A real integration would need a retailer partner API (for example Instacart's developer platform) and a small backend.
- **Background timing is up to the OS.** Geofence reminders are reliable once "Always" location is granted. Background Bee syncing runs at the OS's discretion (roughly every 15+ minutes at best), so a very recent remark may not be on your list until you open the app or sync.
- **Extraction is rule-based.** It's private, free and fast, but will miss unusual phrasings. The extractor is a single function (`extractItems`), so an LLM-backed version can replace it later. That would mean sending transcript text to a server, so it should be opt-in.
- **Geofence limits.** iOS allows 20 monitored regions per app; CartRadar uses the 15 nearest stores. Store data comes from OpenStreetMap and may be incomplete in some areas.

## Layout

```
src/core/       pure logic, unit-tested (extractor, list/trip rules, geofence handlers)
src/bee/        Bee API client, demo feed, sync pipeline
src/services/   storage, geofencing, notifications, store search, cart hand-off
src/app/        screens (Expo Router): List, Cart queue, Heard, Settings
```
