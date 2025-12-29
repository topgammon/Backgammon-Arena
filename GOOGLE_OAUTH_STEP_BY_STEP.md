# 🔐 Google OAuth Setup - Complete Step-by-Step Guide

## ✅ What to Remove: NOTHING!

**Good news!** There's no old Google auth code to remove. We're starting fresh. The code I added is the only Google auth implementation, so you're all set!

---

## 📋 Part 1: Create Google OAuth Client ID

### Step 1: Go to Google Cloud Console

1. Open your browser
2. Go to: **https://console.cloud.google.com/**
3. Sign in with your Google account (the one you want to use for development)

### Step 2: Create or Select a Project

**Option A: Create a New Project (Recommended)**
1. Click the project dropdown at the top (it might say "Select a project" or show a project name)
2. Click **"NEW PROJECT"** button
3. Enter project name: `Backgammon Arena` (or whatever you want)
4. Click **"CREATE"**
5. Wait a few seconds, then select this new project from the dropdown

**Option B: Use Existing Project**
- Just select an existing project from the dropdown at the top

### Step 3: Enable Google+ API (if needed)

1. In the left sidebar, click **"APIs & Services"** → **"Library"**
2. Search for **"Google+ API"** or **"Google Identity"**
3. If you see it, click on it and click **"ENABLE"** (if not already enabled)
4. If you don't see it, that's okay - newer projects might not need this

### Step 4: Configure OAuth Consent Screen

1. In the left sidebar, click **"APIs & Services"** → **"OAuth consent screen"**
2. Choose **"External"** (unless you have a Google Workspace account, then you can choose "Internal")
3. Click **"CREATE"**
4. Fill in the required fields:
   - **App name**: `Backgammon Arena` (or your app name)
   - **User support email**: Your email address
   - **Developer contact information**: Your email address
5. Click **"SAVE AND CONTINUE"**
6. On the "Scopes" page, click **"SAVE AND CONTINUE"** (no changes needed)
7. On the "Test users" page, click **"SAVE AND CONTINUE"** (no changes needed)
8. On the "Summary" page, click **"BACK TO DASHBOARD"**

### Step 5: Create OAuth Client ID

1. In the left sidebar, click **"APIs & Services"** → **"Credentials"**
2. At the top, click **"+ CREATE CREDENTIALS"**
3. Select **"OAuth client ID"** from the dropdown
4. If you see a warning about OAuth consent screen, click **"CONFIGURE CONSENT SCREEN"** and complete Step 4 above first
5. For **Application type**, select **"Web application"**
6. Give it a name: `Backgammon Arena Web Client` (or whatever you want)
7. **IMPORTANT - Add Authorized redirect URIs:**
   - Click **"+ ADD URI"**
   - Add this URI (replace `YOUR_PROJECT_ID` with your actual Supabase project ID):
     ```
     https://YOUR_PROJECT_ID.supabase.co/auth/v1/callback
     ```
   - To find your Supabase project ID:
     - Go to https://app.supabase.com
     - Select your project
     - Look at the URL or go to Settings → API
     - Your project ID is in the URL like: `https://app.supabase.com/project/abcdefghijklmnop`
     - Or it's shown in the API settings page
   - Click **"+ ADD URI"** again and add your local dev URL:
     ```
     http://localhost:5173
     ```
   - If you have a production domain, add that too:
     ```
     https://yourdomain.com
     ```
8. Click **"CREATE"**
9. **IMPORTANT:** A popup will appear with your credentials:
   - **Your Client ID** (looks like: `123456789-abcdefghijklmnop.apps.googleusercontent.com`)
   - **Your Client Secret** (looks like: `GOCSPX-abcdefghijklmnopqrstuvwxyz`)
10. **COPY BOTH OF THESE** - you'll need them in the next step!
    - You can also download the JSON file if you want
    - Click **"OK"** to close the popup

---

## 📋 Part 2: Configure Supabase

### Step 6: Enable Google Provider in Supabase

1. Go to **https://app.supabase.com**
2. Select your project
3. In the left sidebar, click **"Authentication"**
4. Click **"Providers"** (or it might be under "Authentication" → "Providers")
5. Find **"Google"** in the list of providers
6. Click on **"Google"** to open its settings
7. Toggle **"Enable Google provider"** to ON
8. Paste your **Client ID** from Step 5 into the **"Client ID (for OAuth)"** field
9. Paste your **Client Secret** from Step 5 into the **"Client Secret (for OAuth)"** field
10. Click **"SAVE"** at the bottom

---

## 📋 Part 3: Test It!

### Step 7: Test Google Sign-In

1. Make sure your frontend dev server is running:
   ```bash
   cd frontend
   npm run dev
   ```

2. Open your app in the browser (usually http://localhost:5173)

3. Click the **"Login / Signup (Ranked)"** button

4. Click **"Continue with Google"**

5. You should be redirected to Google's sign-in page

6. Sign in with your Google account

7. You should be redirected back to your app and logged in!

---

## 🐛 Troubleshooting

### "redirect_uri_mismatch" Error
- Make sure you added the exact Supabase callback URL in Step 5
- The URL must be: `https://YOUR_PROJECT_ID.supabase.co/auth/v1/callback`
- Check for typos (no trailing slashes, exact match)

### "OAuth consent screen not configured"
- Go back to Step 4 and complete the OAuth consent screen setup

### "Invalid client" Error
- Double-check that you copied the Client ID and Client Secret correctly
- Make sure there are no extra spaces when pasting into Supabase

### User not logging in after Google auth
- Check browser console for errors
- Make sure your Supabase environment variables are set correctly
- Check that the user profile is being created (check Supabase dashboard → Table Editor → users)

---

## 📝 Quick Checklist

- [ ] Created Google Cloud project
- [ ] Configured OAuth consent screen
- [ ] Created OAuth Client ID
- [ ] Added Supabase callback URL to authorized redirect URIs
- [ ] Copied Client ID and Client Secret
- [ ] Enabled Google provider in Supabase
- [ ] Pasted credentials into Supabase
- [ ] Tested sign-in flow

---

## 🎉 You're Done!

Once you complete these steps, Google authentication will work automatically. Users can click "Continue with Google" and sign in with their Google accounts!

