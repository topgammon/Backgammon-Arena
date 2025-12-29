# Fix Google OAuth Redirect to localhost:3000

## The Problem
Google OAuth redirects to `localhost:3000` instead of `localhost:5173`.

## Solution: Update Supabase Redirect URLs

The Supabase UI may have changed. Here's where to find it:

### Method 1: Authentication Settings
1. Go to **Supabase Dashboard**: https://app.supabase.com
2. Select your project
3. Click **"Authentication"** in the left sidebar
4. Look for **"URL Configuration"** or **"Redirect URLs"** section
5. You should see:
   - **Site URL** - Change this to `http://localhost:5173`
   - **Redirect URLs** - Add `http://localhost:5173` and `http://localhost:5173/**`

### Method 2: Project Settings
1. Go to **Settings** (gear icon) in the left sidebar
2. Click **"API"** or **"Authentication"**
3. Look for **"Redirect URLs"** or **"Site URL"**
4. Update to `http://localhost:5173`

### Method 3: Environment Variables (if available)
Some Supabase projects have environment-specific redirect URLs. Check:
- **Settings** → **API** → Look for redirect URL settings

### What to Set:
- **Site URL**: `http://localhost:5173`
- **Redirect URLs**: 
  - `http://localhost:5173`
  - `http://localhost:5173/**`
  - `https://YOUR_PROJECT_ID.supabase.co/auth/v1/callback` (keep this!)

### Alternative: Check Google Cloud Console
If Supabase settings don't work, also check:
1. **Google Cloud Console** → **APIs & Services** → **Credentials**
2. Click your OAuth Client ID
3. Under **"Authorized redirect URIs"**, make sure you have:
   - `http://localhost:5173`
   - `https://YOUR_PROJECT_ID.supabase.co/auth/v1/callback`

After updating, try Google sign-in again!

