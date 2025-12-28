# 🚀 Auto-Deploy Setup - Push to GitHub, Deploy Automatically

This guide will help you set up automatic deployments so you can push to GitHub and have changes automatically deploy to production.

---

## Current Status

✅ **Backend (Node.js)** - Railway: Already deployed at `backgammon-arena-production.up.railway.app`
✅ **Python AI Service** - Railway: Needs to be configured (we'll fix this)
✅ **Frontend** - Vercel: Needs to be connected

---

## Step 1: Connect Railway to GitHub (Auto-Deploy)

### For Backend Service:
1. Go to [Railway Dashboard](https://railway.app)
2. Click on your **Backend** service
3. Go to **Settings** tab
4. Under **Source**, click **Connect GitHub**
5. Select your repository
6. Enable **Auto-Deploy** (should be on by default)
7. Set **Branch** to `main` (or your default branch)

### For Python AI Service:
1. Go to your **Python AI Service** in Railway
2. Follow the same steps as above
3. Make sure **Root Directory** is set to `backend` (if needed)
4. Make sure **Start Command** is set to: `gunicorn -w 2 -b 0.0.0.0:$PORT python_ai_service:app`

**Note:** If Railway keeps reverting the start command, we may need to create a separate folder structure or use a Procfile.

---

## Step 2: Connect Vercel to GitHub (Auto-Deploy)

### Initial Setup:
1. Go to [Vercel Dashboard](https://vercel.com)
2. Click **Add New Project**
3. Import your GitHub repository
4. Configure:
   - **Framework Preset:** Vite
   - **Root Directory:** `frontend`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Install Command:** `npm install`

### Environment Variables:
Add these in Vercel project settings:
- `VITE_API_URL` = Your Railway backend URL (e.g., `https://backgammon-arena-production.up.railway.app`)
- `VITE_BACKEND_URL` = Same as VITE_API_URL (used for evaluation endpoint)

### Auto-Deploy:
- Vercel automatically deploys on every push to `main` branch
- You can also enable **Preview Deployments** for pull requests (optional)

---

## Step 3: Workflow Going Forward

### Daily Workflow:
1. **Make changes locally**
2. **Test locally** (optional, since you'll test in production)
3. **Commit and push to GitHub:**
   ```bash
   git add .
   git commit -m "Description of changes"
   git push
   ```
4. **Wait 2-5 minutes** for deployments to complete
5. **Test on production site**

### Check Deployment Status:
- **Railway:** Check the **Deployments** tab in each service
- **Vercel:** Check the **Deployments** tab in your project

---

## Step 4: Fix Python Service Auto-Deploy Issue

The Python service on Railway keeps reverting to Node.js. Here are options:

### Option A: Separate Repository Folder (Recommended)
Create a separate folder structure so Railway doesn't detect Node.js:

1. Create `python-service/` folder at root
2. Move Python files there:
   - `python_ai_service.py`
   - `requirements.txt`
   - `gnubg_eval.py`
   - `runtime.txt`
   - `.python-version`
3. Create new Railway service pointing to `python-service/` folder
4. Set Root Directory to `python-service`

### Option B: Use Procfile (Try First)
Create `backend/Procfile` with:
```
web: gunicorn -w 2 -b 0.0.0.0:$PORT python_ai_service:app
```

Then in Railway:
- Set Root Directory to `backend`
- Remove custom Start Command (let Procfile handle it)

### Option C: Use nixpacks-python.toml
We already have `backend/nixpacks-python.toml`. Make sure Railway uses it:
- In Railway service settings, ensure it's detecting Python
- The `.python-version` and `runtime.txt` should help

---

## Step 5: Set Environment Variables

### Vercel (Frontend):
Set these in Vercel project settings → Environment Variables:
- `VITE_API_URL` = `https://your-backend.railway.app`
- `VITE_BACKEND_URL` = `https://your-backend.railway.app` (same as above)

### Railway (Backend Service):
Set these in Railway service settings → Variables:
- `PYTHON_AI_SERVICE_URL` = `https://your-python-service.railway.app`
- `FRONTEND_URL` = `https://your-vercel-app.vercel.app` (or your custom domain)
- `PORT` = (Railway sets this automatically, but you can verify)

### Railway (Python AI Service):
Set these in Railway service settings → Variables:
- `PORT` = (Railway sets this automatically)
- `FLASK_DEBUG` = `False` (for production)
- `GNUBG_EVAL_FILE` = (if needed, path to GNU Backgammon eval file)

---

## Troubleshooting

### Railway Not Auto-Deploying:
- Check GitHub connection in Railway settings
- Verify branch name matches (usually `main`)
- Check Railway logs for errors

### Vercel Not Auto-Deploying:
- Check GitHub connection in Vercel settings
- Verify build settings are correct
- Check Vercel deployment logs

### Python Service Still Using Node.js:
- Try Option A (separate folder) - this is most reliable
- Or ensure `backend/` folder doesn't have `package.json` visible to Railway's Python service

---

## Quick Commands

```bash
# Standard workflow
git add .
git commit -m "Your commit message"
git push

# Check deployment status
# - Railway: Check dashboard
# - Vercel: Check dashboard or use CLI: vercel ls
```

---

## Next Steps

1. ✅ Connect Railway backend to GitHub (auto-deploy)
2. ✅ Connect Railway Python service to GitHub (auto-deploy) - **Fix the Node.js detection issue first**
3. ✅ Connect Vercel frontend to GitHub (auto-deploy)
4. ✅ Set environment variables in all services
5. ✅ Test: Push a small change and verify auto-deploy works
6. ✅ Update domain settings (if you have a custom domain)

---

**Once this is set up, you'll just push to GitHub and everything deploys automatically! 🎉**

