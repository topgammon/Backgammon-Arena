# 🔓 Disable Email Verification in Supabase

Follow these steps to disable email verification so users can sign in immediately after creating an account.

---

## Step 1: Go to Supabase Authentication Settings

1. Go to your Supabase Dashboard: https://app.supabase.com
2. Select your project
3. Go to **Authentication** → **Settings** (in the left sidebar)
4. Look for **"Email Auth"** section

---

## Step 2: Disable Email Confirmation

Look for one of these options:

**Option A: "Enable email confirmations"**
- Find the toggle/checkbox for **"Enable email confirmations"**
- **Turn it OFF** (uncheck it)
- Click **Save**

**Option B: "Confirm email"**
- If you see a **"Confirm email"** toggle
- **Turn it OFF**
- Click **Save**

**Option C: If you don't see either option:**
- Go to **Authentication** → **Email Templates**
- Look for settings related to email confirmation
- Or try the SQL method below

---

## Step 3: Update Email Template (Optional)

If you want to customize the email template later:

1. Go to **Authentication** → **Email Templates**
2. You can customize the confirmation email template here (but we're disabling it for now)

---

## Step 4: Test

After disabling email confirmation:

1. Try creating a new account
2. You should be able to log in immediately without verifying email
3. Existing accounts should also work now

---

## Alternative: Disable via SQL (Recommended if UI doesn't work)

If you can't find the toggle in the UI, use this SQL method:

1. Go to **SQL Editor** in Supabase
2. Run this query:

```sql
-- Disable email confirmation requirement
UPDATE auth.config 
SET enable_email_confirmations = false;
```

**If that doesn't work, try this:**

```sql
-- Alternative method - update auth settings
UPDATE auth.config 
SET enable_signup = true,
    enable_email_confirmations = false;
```

**Or try this (for newer Supabase versions):**

```sql
-- Check current settings first
SELECT * FROM auth.config;

-- Then update
UPDATE auth.config 
SET raw_app_meta_data = jsonb_set(
  COALESCE(raw_app_meta_data, '{}'::jsonb),
  '{email_confirm_enabled}',
  'false'::jsonb
);
```

**Note:** After running the SQL, try creating a new account or logging in with your existing account.

---

## Re-enable Later

When you're ready to add email verification back:

1. Go back to **Authentication** → **Providers** → **Email**
2. Turn **"Confirm email"** back ON
3. Users will need to verify their email before logging in

---

**After disabling email verification, try logging in again!**

