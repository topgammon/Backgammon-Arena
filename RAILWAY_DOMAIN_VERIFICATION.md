# Railway Domain Verification Checklist

## Issue
The DNS is correctly configured, but Railway isn't serving traffic for the custom domain.

## What to Check in Railway

1. **Domain Status:**
   - Go to Railway → Your Service → Settings → Networking
   - Look at `api.topgammon.com`
   - Check what status it shows:
     - ✅ "Active" or "Verified" = Good
     - ⚠️ "Pending" = Waiting for verification
     - ❌ "Failed" or "Error" = Issue

2. **Remove and Re-add Domain (if needed):**
   - Sometimes Railway needs you to remove and re-add the domain after DNS is set up
   - In Networking tab, remove `api.topgammon.com`
   - Wait 30 seconds
   - Add it again: `api.topgammon.com`
   - Railway should detect the DNS and verify it

3. **Check Railway Logs:**
   - Look at the latest deployment logs
   - Make sure the server is running (we know it is from earlier)
   - Look for any domain-related errors

## Alternative: Use Railway Auto-Generated Domain

If the custom domain continues to have issues, you can temporarily use:
- `https://backgammon-arena-production.up.railway.app/api/health`

And update your Vercel environment variable:
- `VITE_BACKEND_URL=https://backgammon-arena-production.up.railway.app`

This will work immediately while we troubleshoot the custom domain.

