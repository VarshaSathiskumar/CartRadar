# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Project instructions for CartRadar.

## Rules

1. Never make Claude a contributor or coauthor. No `Co-Authored-By` trailers, no "Generated with Claude Code" lines, in commits, pull requests or anywhere else.
2. Keep commit messages short and concise, stating what was updated.
3. Never use the em dash character anywhere: code, comments, docs, commit messages, pull requests or chat replies. Use a comma, colon, parentheses or a plain hyphen instead.
4. Always ask questions when the instructions are not clear. Do not guess.

## Commands

```bash
npm test                                   # vitest run (all unit tests, including the Edge Function helpers)
npx vitest run src/core/listLogic.test.ts  # one test file
npx vitest run -t "name fragment"          # one test by name
npm run typecheck                          # tsc --noEmit
npx expo lint                              # lint
npm run web                                # Expo web (what Vercel builds)
npx expo run:ios | run:android             # needs a development build, Expo Go lacks background location and geofencing
npm run check-sample -- data/<file>.txt    # run a saved Bee transcript through the real extraction prompt (needs OPENAI_API_KEY in .env.local)
npm run check-demo                         # same check against the scripted demo conversations
```

`AGENTS.md` holds Expo guidance: Expo SDK APIs change between releases, so check the versioned docs for the `expo` major in `package.json` before touching Expo or React Native APIs, and add packages with `npx expo install`.

## Architecture

Expo Router app (`src/app/`: List, Cart queue, Heard, Settings, Login) on Supabase. Local storage is the source of truth and `src/services/cloudSync.ts` mirrors it to Supabase (`supabase/migrations/0001_init.sql`). Pure logic lives in `src/core/` and is unit-tested; platform code (geofencing, notifications, storage) lives in `src/services/`. Many modules have a `.web.tsx` or web fallback because the same code ships as an iOS/Android build and a Vercel web build.

### Live Bee data flow (how real conversations become a user-facing result)

1. **Trigger** (`src/app/_layout.tsx`, `src/app/index.tsx`, `src/app/settings.tsx`, `src/services/background.ts`): `syncFromBee()` runs on sign-in, on app foreground, on a timer while the app is open, on pull-to-refresh, on "Sync now" and as an OS background task.
2. **Fetch** (`src/bee/client.ts`, `supabase/functions/bee-sync/`): the app calls the `bee-sync` Edge Function as the signed-in user. The function holds `BEE_TOKEN` as a Supabase secret and calls Bee's `GET /v1/conversations` then `GET /v1/conversations/:id`, returning flattened utterances with stable ids (`<conversation>:<utterance>`). The token never reaches the app.
3. **Extract** (`src/bee/llmExtractor.ts`, `supabase/functions/extract-items/`): unseen utterances go to `extract-items` (OpenAI structured output) in batches of 50. If there is no cloud account, `src/core/extractor.ts` (rule-based) is the fallback.
4. **List** (`src/bee/sync.ts`, `src/core/listLogic.ts`): `mergeExtracted(..., 'bee', ...)` adds items with `source: 'bee'` and the phrase that triggered them. Only utterances that produced items are stored (Heard tab); everything else is just marked seen.
5. **Remind** (`src/services/geofence.ts`, `src/services/webReminders.ts`, `src/core/proximity.ts`): entering a store geofence (native) or a position fix near a store (web) sends a notification if the list has open items. Leaving ends the trip and prompts to move leftovers to the cart queue.

Demo mode (`src/services/demo.ts`, `src/core/demoConversations.ts`) feeds scripted conversations through the same extraction path, tags items with `source: 'bee'` and ids starting with `demo:`, and makes `syncFromBee` return early so mock data never mixes with real transcripts. When asked to prove live Bee behavior, look past demo mode: the live path is steps 1 to 5 with `settings.demoMode` false.

Evidence that the live path is real: `data/` (git-ignored) holds a saved Bee transcript from 2026-10-20 in which the speaker says "we need to buy some milk", mentions ramen and "the eggs will go well with that"; `npm run check-sample` runs it through the production extraction code. Response field names in `supabase/functions/bee-sync/bee.ts` came from a live Bee account because Bee's docs do not list them.

### Known gaps worth knowing before changing this flow

- Getting a long-lived `BEE_TOKEN` is not documented by Bee. An expired token surfaces as "Bee rejected the server token" in the sync status.
- Both Edge Functions only accept emails listed in `ALLOWED_EMAILS` and verify the Supabase session themselves (`supabase/functions/_shared/auth.ts`), so they are deployed with `--no-verify-jwt`. The Edge Function code is Deno, but its pure helpers (`bee.ts`, `extract.ts`) are import-free so vitest and the `server/` scripts can reuse them.
- Duplicate protection depends on `seenUtteranceIds` (per device) plus list-level de-duplication and a 12 hour re-add block after an item is bought.
