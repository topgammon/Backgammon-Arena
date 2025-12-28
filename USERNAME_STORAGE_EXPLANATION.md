# 📝 Username Storage Explanation

## Where Username is Stored

Your username is stored in **`public.users.username`**, not in the "display name" field.

### Two Different Tables:

1. **`auth.users`** (Supabase Auth table)
   - This is managed by Supabase Authentication
   - Has fields like: `id`, `email`, `raw_user_meta_data`, etc.
   - The "display name" field you see is here, but we're **not using it**
   - This table is for authentication only

2. **`public.users`** (Your custom table)
   - This is where we store user profile data
   - Has fields like: `id`, `username`, `email`, `elo_rating`, `wins`, `losses`, etc.
   - **This is where the username is stored** ✅

## Why This Design?

- **`auth.users`**: Handles authentication (login, password, etc.)
- **`public.users`**: Handles your app's custom data (username, stats, etc.)

This separation allows you to:
- Keep auth data separate from app data
- Add custom fields without touching Supabase's auth system
- Have more control over your user profiles

## Where to Check Username

To see the username in Supabase:

1. Go to **Table Editor** → **`users`** (the `public.users` table)
2. Look at the **`username`** column
3. That's where it's stored! ✅

The "display name" field in `auth.users` is a Supabase Auth feature we're not using. You can ignore it.

---

## Quick Check Query

Run this in SQL Editor to see both:

```sql
SELECT 
  u.id,
  u.email,
  u.raw_user_meta_data->>'username' as auth_username,
  p.username as profile_username,
  p.elo_rating
FROM auth.users u
LEFT JOIN public.users p ON u.id = p.id
ORDER BY u.created_at DESC;
```

You'll see:
- `auth_username`: From auth metadata (might be null)
- `profile_username`: From `public.users` table (this is what we use) ✅

