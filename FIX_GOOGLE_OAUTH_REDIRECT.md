# Fix Google OAuth Redirect Issue

## The Problem
Users are being created in Supabase (OAuth works), but they're redirected to `localhost:3000` instead of `localhost:5173`, so they can't complete the login.

## Root Cause
Supabase uses its **Site URL** setting as the default redirect URL, which overrides the `redirectTo` parameter we pass in code.

## Solution: Update Supabase Site URL

### Step 1: Find Supabase Settings
1. Go to **https://app.supabase.com**
2. Select your project
3. Look for one of these:
   - **Settings** (gear icon) → **API** → Look for "Site URL" or "Redirect URLs"
   - **Authentication** → **URL Configuration** or **Settings**
   - **Project Settings** → **API** → Look for redirect URL settings

### Step 2: Update Site URL
Find the field labeled:
- **"Site URL"** OR
- **"Redirect URL"** OR  
- **"Authorized Redirect URLs"**

Change it from:
```
http://localhost:3000
```

To:
```
http://localhost:5173
```

### Step 3: Add Redirect URLs (if available)
If there's a separate "Redirect URLs" or "Additional Redirect URLs" field, add:
```
http://localhost:5173
http://localhost:5173/**
```

### Step 4: Save
Click **"Save"** or **"Update"**

## Alternative: Check Google Cloud Console

If you can't find the Supabase setting, also check:

1. **Google Cloud Console** → **APIs & Services** → **Credentials**
2. Click your OAuth Client ID
3. Under **"Authorized redirect URIs"**, make sure you have:
   - `http://localhost:5173`
   - `https://YOUR_PROJECT_ID.supabase.co/auth/v1/callback`

## What I've Added to the Code

I've added:
1. ✅ OAuth callback handler that detects tokens in URL hash
2. ✅ Better logging to see what's happening
3. ✅ `detectSessionInUrl: true` in Supabase client config
4. ✅ Automatic session retrieval after OAuth callback

## Testing

After updating Supabase settings:
1. Click "Continue with Google"
2. Sign in with Google
3. You should be redirected back to `localhost:5173` (not 3000)
4. Check browser console for logs like:
   - "OAuth callback detected, getting session..."
   - "Session retrieved after OAuth: [email]"

## If Still Not Working

If it still redirects to 3000:
1. Check browser console for errors
2. Check the actual redirect URL in the address bar
3. Try clearing browser cache
4. Make sure you saved the Supabase settings

The code is ready - we just need Supabase to use the correct redirect URL!

