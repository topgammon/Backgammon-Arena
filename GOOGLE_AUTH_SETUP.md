# 🔐 Google Authentication Setup Guide

## Step 1: Configure Google OAuth in Supabase Dashboard

1. **Go to your Supabase Dashboard**: https://app.supabase.com
2. **Select your project**
3. **Navigate to**: Authentication → Providers
4. **Find "Google"** in the list and click to enable it
5. **You'll need Google OAuth credentials**:

### Getting Google OAuth Credentials:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Go to **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth client ID**
5. Choose **Web application**
6. Add authorized redirect URIs:
   - For development: `http://localhost:5173` (or your dev URL)
   - For production: `https://yourdomain.com` (your actual domain)
   - **IMPORTANT**: Also add: `https://YOUR_SUPABASE_PROJECT_ID.supabase.co/auth/v1/callback`
7. Copy the **Client ID** and **Client Secret**

### Back in Supabase:

8. **Paste your Google Client ID and Client Secret** into Supabase
9. **Save** the configuration

## Step 2: Update Environment Variables

Make sure your `.env` files are set up (you should already have these):

**Frontend** (`frontend/.env`):
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

**Backend** (`backend/.env`):
```
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## Step 3: Code Implementation

The code has been updated to use `signInWithOAuth` from Supabase. The implementation:
- Opens Google OAuth popup
- Handles the callback automatically
- Creates user profile if needed
- Works seamlessly with existing auth flow

## Step 4: Test It!

1. Start your dev server
2. Click "Continue with Google" button
3. Sign in with your Google account
4. You should be logged in!

## Notes:

- **No code deletion needed** - we're just replacing the TODO with actual implementation
- **Reuses existing Supabase setup** - your `supabase.js` files are already correct
- **Works with existing user profile system** - automatically creates profile entry

