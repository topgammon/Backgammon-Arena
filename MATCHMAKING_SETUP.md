# 🎮 Matchmaking Setup Guide

This guide explains how to set up the matchmaking system for Backgammon Arena.

## Environment Variables Required

### Frontend (Vercel)

In your Vercel project settings, add this environment variable:

**`VITE_BACKEND_URL`** - The URL of your backend server (Railway)

**Example:**
```
VITE_BACKEND_URL=https://your-backend-name.railway.app
```

**How to find your Railway backend URL:**
1. Go to your Railway dashboard
2. Click on your backend service
3. Go to the "Settings" tab
4. Find "Public Domain" or "Networking"
5. Copy the URL (should look like `https://your-app-name.railway.app`)

**For local development:**
- If not set, defaults to `http://localhost:3001`
- Create a `frontend/.env` file with:
  ```
  VITE_BACKEND_URL=http://localhost:3001
  ```

## How Matchmaking Works

### Guest Matchmaking (Unranked)
- Simple first-come-first-served queue
- Matches guests with other guests
- No ELO rating involved
- Optimizes for fastest match time

### Ranked Matchmaking (Coming Soon)
- ELO-based matching
- Expanding rating range over time:
  - First 10 seconds: ±10% rating
  - Next 10 seconds: ±20% rating
  - After 20 seconds: ±30% rating

## Testing Locally

1. **Start the backend:**
   ```bash
   cd backend
   npm install
   node server.js
   ```
   Backend should be running on `http://localhost:3001`

2. **Start the frontend:**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   Frontend should be running on `http://localhost:5173`

3. **Test matchmaking:**
   - Open two browser windows/tabs
   - Click "Play as Guest (unranked)" in both
   - You should see matchmaking status messages
   - When two players are in queue, they should be matched

## Troubleshooting

### "Error connecting to server"
- Check that your backend is running
- Verify `VITE_BACKEND_URL` is set correctly in Vercel
- Check browser console for connection errors
- Verify Railway backend is accessible (try opening the URL in browser)

### Build fails with "socket.io-client" error
- Make sure `socket.io-client` is in `frontend/package.json` (it should be now)
- Run `cd frontend && npm install` locally to update dependencies
- Commit and push the updated `package.json`

### Button still says "Coming soon"
- Make sure you've committed and pushed the latest code
- Clear browser cache
- Verify the button code in `frontend/src/components/GameBoard.jsx` has the onClick handler

