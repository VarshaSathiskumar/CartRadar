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

| Feature | Description |
|---|---|
| 🐝 Bee-Powered Grocery Extraction | Retrieves Bee conversations and identifies grocery items mentioned naturally. |
| 🧠 AI-Powered Understanding | Uses OpenAI to extract grocery items, quantities, and purchase intent. |
| 🛒 Smart Shopping Lists | Deduplicates items, tracks purchases, and preserves original conversation phrases. |
| 📍 Location-Based Reminders | Uses OpenStreetMap to find nearby grocery stores and configure location-based reminders. |
| 📦 Leftover Management | Keeps unfinished items on the grocery list or moves them to a separate Cart queue. |
| 🛍️ Retailer Hand-Off | Opens prefilled Amazon Fresh product searches without automatically adding items to carts. |
| ☁️ Cloud Synchronization | Uses Supabase to persist shopping lists across sessions. |
| 🎬 Demo Mode | Provides scripted conversations to demonstrate the app without a Bee device. |

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


## 🐝 How Live Bee Data Reaches CartRadar

⚡ 1. Automatic Synchronization

CartRadar automatically syncs Bee conversations when users sign in, open the app, or return to it. It also polls every 5 minutes while the app is open and supports manual refresh and OS-scheduled background synchronization.

🔗 2. Secure Bee Integration

The bee-sync Supabase Edge Function securely retrieves live conversations through Bee’s Developer API using GET /v1/conversations and GET /v1/conversations/:id.

The Bee authentication token stays in Supabase secrets and is never exposed to the mobile application.

🧠 3. AI-Powered Extraction

The extract-items Edge Function uses OpenAI to identify grocery items, understand purchase intent, and resolve contextual references such as “buy it.”

A rule-based extractor provides a fallback for users without a cloud account.

🛒 4. Smart Shopping List

Extracted items are automatically added to the shopping list, along with the original conversation phrase. CartRadar prevents duplicates and tracks purchased items.

📍 5. Location-Based Reminders

CartRadar detects nearby grocery stores using native geofencing or foreground location checks on the web.

When users approach a store with pending grocery items, CartRadar can send a reminder.

After a shopping trip, unfinished items can remain on the list or move to the Cart queue for shopping through Amazon Fresh.

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

## 📍 Location-Based Store Reminders

CartRadar reminds users about their shopping list when they are near a saved store. Both mobile and web use the same settings and reminder rules, but detect location differently.

### How It Works

1. Users save stores and set a reminder radius (default: 250 meters).
2. The app checks whether the user enters a store's radius.
3. If the store is enabled and the shopping list has unchecked items, a reminder is triggered.
4. A 2-hour cooldown prevents repeated reminders for the same store.
5. If multiple stores are nearby, they are combined into one notification.

### Mobile vs. Web

| Feature | Mobile App | Web App |
|---|---|---|
| Location detection | OS geofencing | Browser GPS |
| Radius | Customizable (0.1–5 miles) | Same |
| Default radius | 250 meters | 250 meters |
| Distance calculation | Operating system | Application |
| Reminder trigger | Enter store radius | Enter store radius |
| Background tracking | Supported with permissions | Not supported |
| Exit detection | OS-managed | 50 m beyond radius |
| Reminder cooldown | 2 hours | 2 hours |
| Shopping list validation | Yes | Yes |
| Multiple nearby stores | Combined reminder | Combined reminder |
| Settings synchronization | Supabase | Supabase |

### Reminder Settings

- **Custom radius:** Users can choose between 0.1 and 5 miles.
- **Store preferences:** Enable or disable reminders for individual stores.
- **Shopping list:** Reminders trigger only when unchecked items remain.
- **Cooldown:** Prevents duplicate reminders within 2 hours per store.
- **Cloud sync:** Settings are saved in Supabase and shared across devices.
- **Map visualization:** Displays the configured reminder radius.

### Technical Implementation

**Mobile App (iOS/Android)**
- Uses native OS geofencing.
- Requires "Always" location permission and a development build.
- Can detect store entry even when the app is closed.
- Updating the radius re-registers geofences.
- Actual trigger distances may vary due to OS behavior.

**Web App (Mobile Browser)**
- Uses `navigator.geolocation.watchPosition` to track location.
- Calculates distance to enabled stores using the configured radius.
- Applies radius changes automatically on the next location update.
- Uses a 50-meter exit buffer to prevent repeated alerts from GPS fluctuations.
- Checks location again when the page becomes visible, bypassing the normal cooldown for that recheck.
- **Limitation:** Location tracking works only while the browser page is open and visible.

### Demo Deployment

CartRadar is deployed as a mobile-friendly web application.

For the demo, users can open the website on their phones, allow location access, and receive store reminders when entering the configured radius.

**Note:** Browser-based location reminders require the webpage to remain open and visible. Background geofencing requires a native mobile app.


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

**Getting Started with local setup:** https://github.com/VarshaSathiskumar/CartRadar/blob/main/src/README.md

## License

This project is released under the MIT License. See the `LICENSE` file for details.
