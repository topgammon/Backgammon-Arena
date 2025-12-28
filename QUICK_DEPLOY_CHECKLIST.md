# ✅ Quick Deploy Checklist

Use this checklist to set up auto-deploy. Once done, you'll just push to GitHub and everything deploys automatically!

---

## 🚂 Railway Setup

### Backend Service (Node.js)
- [ ] Go to Railway → Backend service → Settings
- [ ] Connect GitHub repository
- [ ] Enable Auto-Deploy on `main` branch
- [ ] Set environment variables:
  - [ ] `PYTHON_AI_SERVICE_URL` = (Python service URL)
  - [ ] `FRONTEND_URL` = (Vercel frontend URL)
- [ ] Verify Root Directory = `backend`
- [ ] Verify Start Command = `node server.js`

### Python AI Service
- [ ] Go to Railway → Python service → Settings
- [ ] Connect GitHub repository
- [ ] Enable Auto-Deploy on `main` branch
- [ ] Set environment variables:
  - [ ] `FLASK_DEBUG` = `False`
  - [ ] `PORT` = (auto-set by Railway)
- [ ] **IMPORTANT:** Fix the Node.js detection issue:
  - [ ] Option A: Create separate `python-service/` folder (recommended)
  - [ ] Option B: Use Procfile in `backend/` folder
  - [ ] Option C: Ensure `.python-version` and `runtime.txt` are correct
- [ ] Verify Start Command = `gunicorn -w 2 -b 0.0.0.0:$PORT python_ai_service:app`

---

## ▲ Vercel Setup

### Frontend
- [ ] Go to Vercel → Add New Project
- [ ] Import GitHub repository
- [ ] Configure:
  - [ ] Framework: Vite
  - [ ] Root Directory: `frontend`
  - [ ] Build Command: `npm run build`
  - [ ] Output Directory: `dist`
- [ ] Set environment variables:
  - [ ] `VITE_API_URL` = (Railway backend URL)
  - [ ] `VITE_BACKEND_URL` = (Railway backend URL - same as above)
- [ ] Deploy and verify it works
- [ ] Auto-deploy is enabled by default on `main` branch

---

## 🧪 Test Auto-Deploy

- [ ] Make a small change (e.g., update a comment)
- [ ] Commit and push to GitHub:
  ```bash
  git add .
  git commit -m "Test auto-deploy"
  git push
  ```
- [ ] Check Railway deployments (should start automatically)
- [ ] Check Vercel deployments (should start automatically)
- [ ] Wait 2-5 minutes
- [ ] Verify changes are live on production site

---

## 📝 Daily Workflow (After Setup)

1. Make changes locally
2. `git add .`
3. `git commit -m "Your message"`
4. `git push`
5. Wait 2-5 minutes
6. Test on production site

**That's it! No more running 3 terminals! 🎉**

---

## 🔧 Troubleshooting

### Railway not deploying:
- Check GitHub connection in Railway settings
- Verify branch name (usually `main`)
- Check Railway logs for errors

### Vercel not deploying:
- Check GitHub connection in Vercel settings
- Verify build settings
- Check Vercel deployment logs

### Python service still using Node.js:
- Try creating separate `python-service/` folder
- Or ensure `backend/` doesn't have conflicting files

---

## 📞 Quick Reference

**Railway Backend:** `https://backgammon-arena-production.up.railway.app`
**Railway Python:** (Your Python service URL)
**Vercel Frontend:** (Your Vercel URL)

Save these URLs - you'll need them for environment variables!

