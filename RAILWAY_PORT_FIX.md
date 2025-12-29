# Railway Port Configuration

## Issue
The server is starting on port 3001 (default), but Railway may need it to use the PORT environment variable that Railway provides dynamically.

## Solution

Railway automatically sets the PORT environment variable. Your code already uses `process.env.PORT || 3001`, which is correct. However, Railway should be setting PORT automatically.

## Check These in Railway:

1. **Public Domain Setup:**
   - Go to your Railway service
   - Click on the **"Networking"** or **"Settings"** tab
   - Look for **"Generate Domain"** or **"Public Domain"**
   - Make sure your service has a public domain enabled
   - Your domain `api.topgammon.com` should be configured here

2. **Port Configuration:**
   - Railway should automatically set PORT environment variable
   - Check Environment Variables in Railway Settings
   - PORT should be set automatically (you don't need to set it manually)

3. **Try Railway's Auto-Generated URL:**
   - Railway provides an auto-generated URL like: `your-service.railway.app`
   - Try accessing: `https://your-service.railway.app/api/health`
   - This will help determine if it's a domain configuration issue

4. **Custom Domain (api.topgammon.com):**
   - If using a custom domain, make sure it's properly configured in Railway
   - DNS should point to Railway's servers
   - Railway should show the domain as "Active" or "Verified"

## Next Steps

If the Railway auto-generated URL works but your custom domain doesn't, it's a DNS/domain configuration issue, not a code issue.

