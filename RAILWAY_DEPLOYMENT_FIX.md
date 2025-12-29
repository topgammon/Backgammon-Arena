# Railway Deployment Troubleshooting

## Critical: Set Root Directory in Railway

Railway needs to know that your Node.js server is in the `backend` directory.

### Steps to Fix:

1. **Go to Railway Dashboard**
   - Open your Railway project
   - Click on your backend service

2. **Set Root Directory**
   - Go to **Settings** tab
   - Find **"Root Directory"** setting
   - Set it to: `backend`
   - Save the changes

3. **Redeploy**
   - Railway should automatically redeploy, or
   - Go to **Deployments** tab and trigger a new deployment

## Verify Configuration

Your service should have:
- **Root Directory:** `backend`
- **Build Command:** (auto-detected, should be `npm install`)
- **Start Command:** `node server.js` (from railway.toml or package.json)

## Check Logs

After deployment, check the logs to see:
- `🚀 Backend server running on port [PORT]`
- Any error messages

If you see errors, share them and we can fix them.

