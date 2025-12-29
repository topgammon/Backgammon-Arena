# Fix Google OAuth Redirect to localhost:3000

## The Problem
Google OAuth is redirecting to `localhost:3000` instead of `localhost:5173` (your Vite dev server).

## The Solution

### Option 1: Update Supabase Site URL (Recommended)

1. Go to your **Supabase Dashboard**: https://app.supabase.com
2. Select your project
3. Go to **Settings** → **Authentication** → **URL Configuration**
4. Find **"Site URL"**
5. Change it from `http://localhost:3000` to `http://localhost:5173`
6. **Save**

### Option 2: Add Redirect URL to Supabase

1. In the same **URL Configuration** section
2. Under **"Redirect URLs"**, add:
   - `http://localhost:5173`
   - `http://localhost:5173/**` (wildcard for all paths)
3. **Save**

### Why This Happens

Supabase uses the "Site URL" as the default redirect URL for OAuth. Even though we specify `redirectTo` in the code, Supabase may override it if the Site URL is set to a different port.

After updating the Site URL in Supabase, try Google sign-in again - it should redirect to `localhost:5173` correctly.

