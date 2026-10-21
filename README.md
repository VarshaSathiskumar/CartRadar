# CartRadar 🛒

### Your conversations, your shopping list.

CartRadar is an AI-powered grocery shopping assistant built for the **Amazon Bee wearable** or **Bee’s Apple Watch app**.

It transforms everyday conversations into actionable grocery lists. When you mention something you need to buy, CartRadar retrieves the conversation from Bee, extracts grocery items using OpenAI, and adds them to your shopping list. It also notifies you about pending purchases when you arrive near a grocery store.

## The Problem

We often mention things we need while talking to friends or family:

- "We're out of eggs."
- "I need to pick up milk tomorrow."
- "Don't forget to buy noodles."

But those conversations rarely make it into our shopping lists.

CartRadar bridges that gap by turning conversational information into actionable reminders.

## Features

**Bee-Powered Grocery Extraction**

Retrieves recent conversations captured by Bee and identifies grocery items mentioned naturally.

### 🧠 AI-Powered Understanding
Uses OpenAI to extract grocery items, understand quantities, and identify purchase intent.

### 🛒 Smart Shopping Lists
Automatically deduplicates items, tracks purchased products, and preserves the conversation phrases that generated them.

### 📍 Location-Based Reminders
Uses nearby grocery store locations from OpenStreetMap to configure geofences on supported native devices.

### 📦 Leftover Management
After a shopping trip, unfinished items can remain on the grocery list or move to a separate Cart queue.

### 🛍️ Retailer Hand-Off
Opens prefilled product searches in Amazon Fresh. CartRadar does not automatically add products to retailer carts.

### ☁️ Cloud Synchronization
Uses Supabase to persist shopping lists across sessions.

### 🎬 Demo Mode
Includes scripted conversations for demonstrating the application without a Bee device.

## How It Works

### 1. Capture Conversations

Bee captures everyday conversations through its wearable device.

CartRadar automatically polls for new Bee conversations every 5 minutes through the bee-sync Supabase Edge Function. Users can also trigger synchronization by opening the app, refreshing the shopping list, or selecting Sync now in Settings.

The function connects to Bee's developer API using a token stored in Supabase secrets.

### 2. Extract Grocery Items

New conversation utterances are passed to the `extract-items` Edge Function.

OpenAI identifies grocery items and purchase intent.

For example:

**Conversation:**

"We're out of eggs, and I need to buy milk and bananas."

**Extracted items:**

- Eggs
- Milk
- Bananas

CartRadar also includes a rule-based extraction fallback for signed-out local use.

The fallback recognizes expressions such as "we need to buy," "ran out of," and "add to the list." It also handles quantities, lists, and common negations.

### 3. Build the Shopping List

Extracted items are merged into the existing list.

CartRadar:

- Deduplicates equivalent item names.
- Preserves the triggering conversation phrase.
- Prevents recently purchased items from being re-added for 12 hours.
- Saves the updated list using Supabase cloud synchronization.

### 4. Detect Nearby Grocery Stores

Users can enter a ZIP code or use their current location to find nearby grocery stores.

CartRadar retrieves nearby grocery stores using OpenStreetMap and configures geofences through the native location APIs.

When a user enters a monitored grocery store region, the application can trigger a notification containing pending shopping items.

**Platform requirement:** Background geofencing requires a compatible native development or production build with the necessary location permissions. It is not supported by the Vercel web deployment.

### 5. Manage Unfinished Purchases

When the user leaves a store after at least three minutes, CartRadar can finish the shopping trip.

Purchased items move to history.

Unfinished items follow the user's selected preference:

**Keep on List**

Items remain on the grocery list and are marked as carried over.

**Send to Cart Queue**

Items move to the Cart queue, where users can open product searches in Amazon Fresh.

Users can also manually complete a shopping trip using **Finish trip**.

No items are automatically deleted.

## Technical Architecture

```text
                Bee Wearable
                     |
                     v
             Bee Conversations
                     |
                     v
              Bee Developer API
                     |
                     v
         Supabase Edge Function
                  bee-sync
                     |
                     v
            New Conversation Lines
                     |
                     v
         Supabase Edge Function
                extract-items
                     |
                     v
                 OpenAI API
                     |
                     v
             Grocery Item Parser
                     |
                     v
           Deduplication and Merge
                     |
                     v
             Shopping List
                     |
                     v
              Supabase Storage
                     |
          +----------+----------+
          |                     |
          v                     v
    Native Geofencing       Cart Queue
          |                     |
          v                     v
    Store Reminders       Retailer Search
```

## Tech Stack

| Layer | Technology |
|---|---|
| Mobile application | React Native, Expo |
| Programming language | TypeScript |
| Navigation | Expo Router |
| Conversation source | Amazon Bee Developer API |
| AI extraction | OpenAI API |
| Backend | Supabase Edge Functions |
| Database | Supabase |
| Authentication | Google OAuth |
| Location services | Native geofencing |
| Store discovery | OpenStreetMap |
| Web deployment | Vercel |
| Testing | Unit tests and TypeScript type checking |

## Getting Started

### Prerequisites

- Node.js and npm
- Expo development environment
- Supabase project
- OpenAI API key
- Bee developer access and a valid Bee token
- Google OAuth credentials
- Android or iOS development environment for native features

### 1. Clone the Repository

```bash
git clone <YOUR_REPOSITORY_URL>
cd CartRadar
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Configure the following public application variables:

```env
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=
```

These are client-side configuration values.

Never place Bee authentication tokens, OpenAI API keys, or Supabase service-role credentials in variables prefixed with `EXPO_PUBLIC_`.

### 4. Configure Supabase

Log in and link your Supabase project:

```bash
npx supabase login
npx supabase link --project-ref <PROJECT_REF>
```

Apply the database schema in:

```text
supabase/migrations/0001_init.sql
```

Configure Google authentication in Supabase.

### 5. Configure Server Secrets

Copy the example environment file:

```text
supabase/functions/.env.example
```

Create:

```text
supabase/functions/.env
```

Fill in the required server-side credentials, including the Bee token, OpenAI key, and allowed-user configuration.

Upload the secrets:

```bash
npx supabase secrets set --env-file supabase/functions/.env
```

Never commit this file.

### 6. Deploy Edge Functions

```bash
npx supabase functions deploy bee-sync --no-verify-jwt

npx supabase functions deploy extract-items --no-verify-jwt
```

The functions implement application-level session verification in:

```text
supabase/functions/_shared/auth.ts
```

Disabling gateway JWT verification does not mean the endpoints should be publicly accessible without authentication.

### 7. Run the Application

Install dependencies and run the project checks:

```bash
npm install
npm test
npm run typecheck
```

For Android:

```bash
npx expo run:android
```

For iOS:

```bash
npx expo run:ios
```   

Alternatively, use an Expo development build:

```bash
npx eas-cli build --profile development
```

**Important:** Background location monitoring, geofencing, and background tasks require a compatible native build. Expo Go and the browser-based deployment do not provide the complete native feature set.

## Web Deployment

CartRadar also supports web deployment through Vercel.

The repository includes `vercel.json`, which configures the Expo web build, output directory, and single-page application routing.

### Deploy to Vercel

1. Import the GitHub repository into Vercel.
2. Configure the required public environment variables.
3. Deploy the application.
4. Add the deployed URL to the Google OAuth authorized JavaScript origins.
5. Configure the corresponding Supabase Authentication URL settings.
6. Redeploy if build-time environment variables change.

The web deployment supports the application features compatible with browser APIs.

Native background geofencing is not available in the web version.

## Testing Bee Integration

CartRadar connects to the Bee Developer API:

```text
https://api.developer.bee.amazon.dev
```

The integration uses:

```http
GET /v1/conversations
GET /v1/conversations/:id
```

The first endpoint retrieves recent conversations.

The second retrieves individual conversation details, including transcription data where available.

### Test the Connection

With a valid Bee token configured locally:

```bash
curl \
  -H "Authorization: Bearer $BEE_TOKEN" \
  https://api.developer.bee.amazon.dev/v1/me
```

To test the application:

1. Sign in to CartRadar.
2. Open Settings.
3. Select **Sync now**.
4. Verify the synchronization status.
5. Mention a grocery item in a conversation captured by Bee.
6. Wait for the conversation to become available through Bee.
7. Sync CartRadar again.
8. Verify that the grocery item appears in the shopping list.

This demonstrates the live Bee integration rather than the scripted demo.

## Demo Mode

CartRadar includes a demo mode for testing without a Bee device.

To use it:

1. Open Settings.
2. Enable **Demo mode**.
3. Return to the grocery list.
4. Pull down to refresh.
5. Review the grocery items extracted from the scripted conversation.

Demo mode is separate from the live Bee integration.

For the Bee hackathon track, the demonstration video should show the actual Bee integration processing live Bee conversation data.

## Privacy and Security

CartRadar is designed to minimize the amount of conversational information retained.

- Bee tokens and OpenAI credentials are stored in Supabase secrets.
- Edge Functions validate Supabase sessions and restrict access using `ALLOWED_EMAILS`.
- Conversation utterances are processed for grocery extraction rather than stored as complete server-side transcripts.
- The application retains up to 50 triggering phrases locally in the Heard tab.
- Utterances that do not produce grocery items are discarded after processing.
- Users control their shopping lists and purchased-item history.

Conversation text is sent to OpenAI for extraction.

Users are responsible for obtaining any consent required when recording conversations involving other people.

## Known Limitations

### Bee Authentication

The Bee Developer API requires a Bearer token.

The currently documented API does not provide a clearly described token acquisition and refresh workflow for this integration.

If the token expires, CartRadar requires an updated server-side token.

### Bee API Response Format

The integration uses conversation response fields observed from a live Bee account.

Some response fields are not fully documented and may change.

### Native Geofencing

Background geofencing requires native location permissions and compatible operating-system support.

iOS limits the number of monitored regions. CartRadar monitors up to 15 nearby stores.

Actual delivery timing is controlled by the operating system and is not guaranteed.

### Retailer Integration

The Cart queue opens product searches in external shopping services.

It does not automatically insert items into a user's retailer cart.

### Cross-Device Deduplication

Processed conversation identifiers are tracked per device.

A new device may reprocess older conversations, although shopping-list deduplication prevents many duplicate entries.

## Project Structure

```text
CartRadar/
├── src/
│   ├── app/
│   │   └── Application screens
│   ├── bee/
│   │   └── Bee synchronization pipeline
│   ├── core/
│   │   └── Extraction and shopping logic
│   └── services/
│       └── Storage, location, notifications
│
├── supabase/
│   ├── migrations/
│   │   └── 0001_init.sql
│   └── functions/
│       ├── bee-sync/
│       ├── extract-items/
│       └── _shared/
│
├── package.json
├── vercel.json
├── README.md
└── LICENSE
```

## Future Improvements

- Support a documented Bee authentication refresh flow.
- Improve cross-device synchronization of processed conversations.
- Expand native notification reliability and testing.
- Add smarter grocery categorization.
- Explore direct retailer-cart integrations through supported partner APIs.

## Hackathon Submission

**Track:** Bee

**Demo Video:** [Add YouTube link]

**Live Web Demo:** https://cartradar-five.vercel.app/


## License

This project is released under the MIT License. See the `LICENSE` file for details.
