# Production Google Auth Setup

## The Problem
Google OAuth works (users are created), but they're not being redirected back to your production site properly.

## Solution: Update Supabase for Production

### Step 1: Update Supabase Site URL
1. Go to **Supabase Dashboard** → Your Project
2. Go to **Authentication** → **URL Configuration**
3. Find **"Site URL"**
4. Change it from `http://localhost:5173` to your **production domain**:
   ```
   https://yourdomain.com
   ```
   (Replace `yourdomain.com` with your actual domain)

### Step 2: Add Production Redirect URLs
In the same **URL Configuration** section:
1. Under **"Redirect URLs"**, add your production domain:
   ```
   https://yourdomain.com
   https://yourdomain.com/**
   ```
2. **Keep** `http://localhost:5173` for local development
3. **Keep** `https://YOUR_PROJECT_ID.supabase.co/auth/v1/callback` (this is required)

### Step 3: Update Google Cloud Console
1. Go to **Google Cloud Console** → **APIs & Services** → **Credentials**
2. Click your OAuth Client ID
3. Under **"Authorized redirect URIs"**, make sure you have:
   - `https://yourdomain.com` (your production domain)
   - `http://localhost:5173` (for local dev)
   - `https://YOUR_PROJECT_ID.supabase.co/auth/v1/callback` (required)

## How It Works Now

The code automatically uses `window.location.origin`, which means:
- **In development**: Uses `http://localhost:5173`
- **In production**: Uses `https://yourdomain.com`

No code changes needed - just update Supabase and Google Cloud Console settings!

## Test It

After updating:
1. Deploy your code (if you haven't already)
2. Visit your production site
3. Click "Continue with Google"
4. You should be redirected back to your production domain and logged in

## Important Notes

- The **Site URL** in Supabase is what Supabase uses as the default redirect
- The **Redirect URLs** list tells Supabase which URLs are allowed
- Both need to include your production domain
- The code automatically detects which domain you're on and uses it

