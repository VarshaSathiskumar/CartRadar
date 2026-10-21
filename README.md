# CartRadar

A grocery assistant for the Bee wearable. It reads the conversations Bee captures, picks out what you said you need ("we're out of eggs", "we need noodles"), builds a shopping list, and reminds you when you're near a grocery store.

Built with Expo (React Native + TypeScript), so it runs on iOS and Android.

## How it works

1. **Listen.** When you open the app, pull down on the list, or press **Sync now** in Settings, the app calls the `bee-sync` Supabase Edge Function, which reads your recent Bee conversations with a token kept in Supabase secrets.
2. **Extract.** The app sends lines it has not read yet to the `extract-items` Edge Function, which asks OpenAI which items the speakers mean to buy (same prompt and schema as the earlier local server). Items are merged into your list and saved to Supabase by the existing cloud sync. If the signed-out app has no cloud account, the rule-based extractor in `src/core/extractor.ts` is the fallback; it finds grocery needs: "out of X", "ran out of X", "we need to buy X", "add X to the list", "the milk is gone", and so on. It handles lists ("eggs, milk and bread"), quantities ("two dozen eggs"), and negations ("we don't need rice"), and only accepts phrases containing a grocery word, so "we're out of time" is ignored.
3. **List.** Items are de-duplicated ("egg" and "eggs" are the same) and shown with the phrase that triggered them. A recently checked-off item isn't re-added for 12 hours.
4. **Remind.** Enter the zip code you shop in; CartRadar finds nearby grocery stores (OpenStreetMap) and sets up geofences. Arriving at one sends a notification with what's on your list (at most once every 2 hours per store).
5. **Leftovers.** Leaving a store after at least 3 minutes ends the trip. Checked-off items go to history. Everything else is handled by the Settings toggle **Send leftovers to my cart**:
   - **Off:** leftovers stay on the list for the next trip, marked "Carried over".
   - **On:** leftovers move to the **Cart queue** tab, where each item opens a prefilled search in your shopping app (Amazon Fresh, Instacart or Walmart).

   Nothing is ever deleted automatically. A **Finish trip** button does the same thing manually.

## Privacy

- Transcript lines pass through your Supabase Edge Functions and are sent to OpenAI for extraction. They are not stored on the server. Only phrases that added an item are kept on the device (last 50, visible on the **Heard** tab); every other utterance is discarded after processing.
- The Bee token and OpenAI key live only in Supabase secrets. Both functions check the caller's Supabase session and only accept emails listed in `ALLOWED_EMAILS`.
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

## Deploy (Vercel + Supabase)

Needs the [Supabase CLI](https://supabase.com/docs/guides/cli) (`npx supabase` works) and a Supabase project with `supabase/migrations/0001_init.sql` applied and Google sign-in enabled.

```bash
npx supabase login
npx supabase link --project-ref <ref>

# Secrets: copy supabase/functions/.env.example to supabase/functions/.env, fill it in, then
npx supabase secrets set --env-file supabase/functions/.env

npx supabase functions deploy bee-sync --no-verify-jwt
npx supabase functions deploy extract-items --no-verify-jwt
```

`--no-verify-jwt` turns off only the gateway check; the functions verify the session themselves (`supabase/functions/_shared/auth.ts`), which also works with Supabase's newer asymmetric JWT keys.

Then on Vercel (`vercel.json` sets the Expo web build, the `dist` output folder and the single page rewrite), import the repo and set these environment variables for Production and Preview. They are baked in at build time, so redeploy after changing them:

```
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_ANON_KEY
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
```

Add the Vercel URL to the Google OAuth client's authorized JavaScript origins and to Supabase's Authentication, URL Configuration, Site URL.

Check the server side without the app (both should print JSON, not an auth error):

```bash
curl -H "Authorization: Bearer $BEE_TOKEN" https://api.developer.bee.amazon.dev/v1/me
npx supabase functions logs bee-sync    # or read the logs in the Supabase dashboard
```

**Test on iPhone:** open the Vercel URL in Safari, sign in with Google, and open Settings. Press **Sync now**: the status line shows `Syncing...` then what was added, or the error. Say something groceries-related near your Bee, wait for it to appear in Bee's app, then pull down on the list. Optional: Share, Add to Home Screen.

## Things you should know

- **Bee API facts and gaps** (checked against docs.bee.computer/docs/api and a live account). Base URL is `https://api.developer.bee.amazon.dev` with `Authorization: Bearer <token>`; the earlier `api.bee.computer` host in this repo does not exist. Used: `GET /v1/conversations` (newest first, has `next_cursor`, summaries only) and `GET /v1/conversations/:id` (has `transcriptions[].utterances[]` with `id`, `text`, `speaker`, `spoken_at`). The docs list these endpoints but **not their response fields**, so the field names in `supabase/functions/bee-sync/bee.ts` come from a live response and could change without notice. There is no dedicated transcript endpoint in the API docs (the CLI has `bee conversations transcript`, but it is not documented as an API route).
- **Getting `BEE_TOKEN` is not documented.** The docs say to send a Bearer token but never say how to obtain one outside the CLI. Developer Mode in the Bee iOS app (tap Version 5 times) is required for the CLI. `bee login --token` shows the CLI accepts a token, and `bee status` shows a truncated JWT, but no documented command prints the full token, and its lifetime is unknown. If it expires, `bee-sync` returns "Bee rejected the server token" and the app shows that in the sync status; set `BEE_TOKEN` again. A token that expires quickly makes this design unreliable, and the fix would be a refresh flow from Bee, which the docs do not describe.
- **Duplicate protection.** Each line has a stable id (`<conversation>:<utterance>`); lines already read are skipped, concurrent syncs share one run, and the list ignores items it already has (or bought in the last 12 hours). The list of read lines is kept per device, so a second device that has never synced may re-read recent conversations; the list-level check still prevents repeats of unbought items.
- **"Add to cart" is a hand-off, not a silent add.** Amazon, Instacart and Walmart don't expose a public API to add items to a user's cart. The Cart queue opens each item's search in the retailer's app. A real integration would need a retailer partner API (for example Instacart's developer platform) and a small backend.
- **Background timing is up to the OS.** Geofence reminders are reliable once "Always" location is granted. Background Bee syncing runs at the OS's discretion (roughly every 15+ minutes at best), so a very recent remark may not be on your list until you open the app or sync.
- **Geofence limits.** iOS allows 20 monitored regions per app; CartRadar uses the 15 nearest stores. Store data comes from OpenStreetMap and may be incomplete in some areas.

## Layout

```
src/core/       pure logic, unit-tested (extractor, list/trip rules, geofence handlers)
src/bee/        sync pipeline, sync status, calls to the Edge Functions
src/services/   storage, geofencing, notifications, store search, cart hand-off, Edge Function caller
supabase/       database migration and the bee-sync and extract-items Edge Functions
src/app/        screens (Expo Router): List, Cart queue, Heard, Settings
```
