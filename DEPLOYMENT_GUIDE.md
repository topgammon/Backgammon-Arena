# 🚀 Backgammon Arena - Production Deployment Guide

This guide will walk you through deploying your Backgammon Arena application to production so you can test online matchmaking features.

---

## Step 1: Fix Python Service for Production ✅

**Issue:** The Flask development server warning has been addressed. The service now:
- Checks for `FLASK_DEBUG` environment variable
- Uses `PORT` environment variable (defaults to 5000)
- Shows appropriate warnings

**For Production:** You'll need to use a production WSGI server like Gunicorn (recommended).

**Action:** Add Gunicorn to requirements:
```bash
cd backend
pip install gunicorn
echo "gunicorn>=21.2.0" >> requirements.txt
```

---

## Step 2: Choose Your Hosting Platforms

You'll need to deploy:
1. **Frontend** (React/Vite app) - Static hosting
2. **Backend** (Node.js/Express) - Application hosting
3. **Python AI Service** - Application hosting (can be same server as backend)

### Recommended Options:

#### Option A: All-in-One (Easiest for Testing)
- **Railway** or **Render** - Can host both Node.js and Python services
- **Frontend:** Vercel or Netlify (free tier available)

#### Option B: Separate Services (More Control)
- **Frontend:** Vercel or Netlify
- **Backend + Python:** DigitalOcean Droplet, AWS EC2, or Railway

**Recommendation for Quick Start:** Use **Railway** for backend/Python and **Vercel** for frontend (both have free tiers).

---

## Step 3: Prepare Environment Variables

Create production environment variables. You'll need to set these on your hosting platforms.

### Backend (Node.js) - `.env` file:
```env
PORT=3001
FRONTEND_URL=https://yourdomain.com
PYTHON_AI_SERVICE_URL=http://localhost:5000
# Add Supabase credentials if using
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

### Python AI Service - Environment variables:
```env
PORT=5000
FLASK_DEBUG=False
# GNU Backgammon path (if installed on server)
GNUBG_PATH=/usr/bin/gnubg-cli
```

### Frontend - Build-time variables (`.env.production`):
```env
VITE_BACKEND_URL=https://api.yourdomain.com
# Or if backend is on Railway/Render, use their URL
VITE_BACKEND_URL=https://your-backend-service.railway.app
```

---

## Step 4: Deploy Backend + Python Service

### Using Railway (Recommended):

1. **Sign up:** Go to [railway.app](https://railway.app) and sign up with GitHub

2. **Create New Project:**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Connect your repository
   - Select your repo

3. **Add Backend Service (Node.js):**
   - Click "+ New" → "GitHub Repo"
   - Select your repo again (or use "Empty Service")
   - **Root Directory:** Set to `backend`
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Environment Variables:**
     - `PORT=3001`
     - `FRONTEND_URL=https://yourdomain.com`
     - `PYTHON_AI_SERVICE_URL=http://localhost:5000` (if Python is on same service)
     - Or `PYTHON_AI_SERVICE_URL=https://your-python-service.railway.app` (if separate)

4. **Add Python AI Service:**
   - Click "+ New" → "GitHub Repo" or "Empty Service"
   - **Root Directory:** Set to `backend` (same folder)
   - **Python Service:**
     - Railway will auto-detect Python
     - **Build Command:** `pip install -r requirements.txt`
     - **Start Command:** `gunicorn -w 2 -b 0.0.0.0:$PORT python_ai_service:app`
     - **Environment Variables:**
       - `PORT=5000` (Railway auto-sets PORT, but you can override)
       - `FLASK_DEBUG=False`
   
   **Alternative for Python (without Gunicorn initially):**
   - **Start Command:** `python python_ai_service.py`
   - This uses the fixed Flask server (works but not optimal)

5. **Get Your URLs:**
   - Railway will provide URLs like: `https://your-backend.railway.app`
   - Copy these URLs for your frontend configuration

### Using Render:

1. **Sign up:** Go to [render.com](https://render.com) and sign up

2. **Deploy Backend (Node.js):**
   - Click "New" → "Web Service"
   - Connect GitHub repo
   - **Root Directory:** `backend`
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Environment:** Node
   - Add environment variables

3. **Deploy Python Service:**
   - Click "New" → "Web Service"
   - Connect same GitHub repo
   - **Root Directory:** `backend`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `gunicorn -w 2 -b 0.0.0.0:$PORT python_ai_service:app`
   - **Environment:** Python 3
   - Add environment variables

---

## Step 5: Deploy Frontend

### Using Vercel (Recommended):

1. **Sign up:** Go to [vercel.com](https://vercel.com) and sign up with GitHub

2. **Import Project:**
   - Click "Add New" → "Project"
   - Import your GitHub repository
   - **Root Directory:** Set to `frontend`
   - **Framework Preset:** Vite

3. **Configure:**
   - **Build Command:** `npm run build` (auto-detected)
   - **Output Directory:** `dist` (auto-detected)
   - **Install Command:** `npm install`

4. **Environment Variables:**
   - `VITE_BACKEND_URL=https://your-backend.railway.app` (or your backend URL)

5. **Deploy:**
   - Click "Deploy"
   - Vercel will provide a URL like: `https://your-project.vercel.app`

### Using Netlify:

1. **Sign up:** Go to [netlify.com](https://netlify.com) and sign up

2. **New Site from Git:**
   - Connect GitHub repository
   - **Base directory:** `frontend`
   - **Build command:** `npm run build`
   - **Publish directory:** `frontend/dist`

3. **Environment Variables:**
   - Add `VITE_BACKEND_URL` in Site settings → Environment variables

---

## Step 6: Configure Custom Domain

### On Vercel/Netlify:

1. **Add Domain:**
   - Go to your project settings
   - Click "Domains"
   - Add your domain (e.g., `yourdomain.com`)

2. **Configure DNS:**
   - Vercel/Netlify will give you DNS records to add
   - Go to your domain registrar (where you bought the domain)
   - Add the DNS records:
     - **Type:** CNAME or A record (they'll tell you which)
     - **Name:** @ (or www)
     - **Value:** The value they provide

3. **SSL Certificate:**
   - Vercel/Netlify automatically provisions SSL certificates
   - Wait 5-10 minutes for DNS to propagate
   - SSL will be active automatically

### On Railway/Render (for API):

1. **Custom Domain:**
   - In your service settings, add custom domain
   - Add DNS A record pointing to Railway/Render's IP
   - Or use CNAME if they provide it
   - SSL is usually auto-provisioned

---

## Step 7: Update CORS Settings

After deploying, update CORS to only allow your production domain:

### Backend (`backend/server.js`):
```javascript
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || "https://yourdomain.com",
    methods: ["GET", "POST"]
  }
});

app.use(cors({
  origin: process.env.FRONTEND_URL || "https://yourdomain.com"
}));
```

### Python Service (`backend/python_ai_service.py`):
Already configured with `CORS(app)` which allows all origins. For production, you might want to restrict:
```python
from flask_cors import CORS

CORS(app, origins=[os.environ.get('FRONTEND_URL', 'https://yourdomain.com')])
```

---

## Step 8: Update Frontend Environment

1. **Create `.env.production`:**
   ```env
   VITE_BACKEND_URL=https://api.yourdomain.com
   ```

2. **Rebuild and Redeploy:**
   - Commit the `.env.production` file
   - Push to GitHub
   - Vercel/Netlify will auto-redeploy

---

## Step 9: Test Everything

1. **Visit your domain:** `https://yourdomain.com`
2. **Test Pass and Play:** Should work offline
3. **Test CPU Game:** Should work (Python service on backend)
4. **Check Browser Console:** Look for any errors
5. **Test API endpoints:** 
   - Visit `https://api.yourdomain.com/api/health`
   - Should return `{"status": "ok", ...}`

---

## Step 10: GNU Backgammon on Production Server (Optional)

If you want CPU AI to work optimally, GNU Backgammon needs to be installed on the server running Python service.

### On Railway:
- Currently difficult to install system packages
- Python service will fall back to simple AI (works, but not as strong)

### On Render/DigitalOcean:
- SSH into server
- Install GNU Backgammon:
  ```bash
  # Ubuntu/Debian
  sudo apt-get update
  sudo apt-get install gnubg
  
  # Or compile from source
  ```

---

## Quick Reference: Deployment Checklist

- [ ] Python service fixed (debug mode via env var)
- [ ] Gunicorn added to requirements.txt (optional but recommended)
- [ ] Environment variables prepared
- [ ] Backend deployed to Railway/Render
- [ ] Python service deployed to Railway/Render
- [ ] Frontend deployed to Vercel/Netlify
- [ ] Domain configured and DNS set up
- [ ] SSL certificates active
- [ ] CORS updated for production domain
- [ ] Frontend `.env.production` configured
- [ ] All services tested and working

---

## Troubleshooting

**Backend can't reach Python service:**
- If on same Railway service: Use `http://localhost:5000`
- If separate services: Use the Railway/Render URL
- Check environment variable `PYTHON_AI_SERVICE_URL`

**CORS errors:**
- Verify `FRONTEND_URL` matches your actual domain
- Check CORS settings in both backend and Python service
- Make sure protocol is correct (https vs http)

**Python service not starting:**
- Check build logs for missing dependencies
- Verify Python version (3.8+)
- Check if Gunicorn is installed (if using it)

**Domain not working:**
- Wait 24-48 hours for DNS propagation (usually much faster)
- Verify DNS records are correct
- Check SSL certificate status in hosting dashboard

---

## Next Steps After Deployment

1. Set up Supabase for online features (matchmaking, accounts, etc.)
2. Implement authentication
3. Build online matchmaking system
4. Add ELO rating system
5. Create leaderboards

---

## Support

If you run into issues:
1. Check hosting platform logs
2. Check browser console for errors
3. Verify all environment variables are set
4. Test each service individually

Good luck with your deployment! 🎲

