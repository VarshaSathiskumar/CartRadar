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
