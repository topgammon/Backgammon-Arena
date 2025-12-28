# 🌐 Domain Setup Guide - Get Your App Live!

This guide will walk you through connecting your custom domain to your deployed services.

---

## Prerequisites

Before starting, make sure you have:
- ✅ Your domain name ready
- ✅ Access to your domain registrar (where you bought the domain)
- ✅ Railway services deployed and working
- ✅ Vercel frontend deployed and working

---

## Step 1: Get Your Current Service URLs

First, let's get the URLs from your deployed services:

### Railway Services:
1. Go to [Railway Dashboard](https://railway.app)
2. For each service (Backend and Python AI), go to **Settings** → **Networking**
3. Copy the **Public Domain** URL for each service
   - Backend: `https://your-backend.up.railway.app`
   - Python AI: `https://your-python-service.up.railway.app`

### Vercel Frontend:
1. Go to [Vercel Dashboard](https://vercel.com)
2. Click on your project
3. Copy the deployment URL: `https://your-project.vercel.app`

**Write these down - you'll need them!**

---

## Step 2: Set Up Custom Domain on Vercel (Frontend)

### 2.1 Add Domain in Vercel:
1. Go to your Vercel project
2. Click **Settings** → **Domains**
3. Click **Add Domain**
4. Enter your domain (e.g., `backgammonarena.com` or `www.backgammonarena.com`)
5. Click **Add**

### 2.2 Configure DNS Records:
Vercel will show you DNS records to add. You'll need to add these at your domain registrar:

**For Root Domain (backgammonarena.com):**
- **Type:** `A`
- **Name:** `@` (or leave blank)
- **Value:** Vercel's IP address (shown in Vercel dashboard)

**For WWW Subdomain (www.backgammonarena.com):**
- **Type:** `CNAME`
- **Name:** `www`
- **Value:** `cname.vercel-dns.com` (or what Vercel shows)

### 2.3 Add DNS Records at Your Registrar:
1. Log into your domain registrar (GoDaddy, Namecheap, Cloudflare, etc.)
2. Go to **DNS Management** or **DNS Settings**
3. Add the records Vercel provided
4. Save changes

**Note:** DNS changes can take 5 minutes to 48 hours to propagate. Usually it's 5-30 minutes.

---

## Step 3: Set Up Custom Domain on Railway (Backend)

### 3.1 Add Domain in Railway:
1. Go to your **Backend** service in Railway
2. Click **Settings** → **Networking**
3. Scroll to **Custom Domain**
4. Click **Add Custom Domain**
5. Enter your subdomain (e.g., `api.backgammonarena.com`)
6. Click **Add**

### 3.2 Configure DNS for Backend:
Railway will show you a CNAME record to add:

- **Type:** `CNAME`
- **Name:** `api` (or whatever subdomain you chose)
- **Value:** Railway's domain (shown in Railway dashboard, e.g., `your-backend.up.railway.app`)

Add this at your domain registrar.

---

## Step 4: Set Up Custom Domain on Railway (Python AI Service)

### 4.1 Add Domain in Railway:
1. Go to your **Python AI Service** in Railway
2. Click **Settings** → **Networking**
3. Scroll to **Custom Domain**
4. Click **Add Custom Domain**
5. Enter your subdomain (e.g., `ai.backgammonarena.com`)
6. Click **Add**

### 4.2 Configure DNS for Python Service:
Railway will show you a CNAME record:

- **Type:** `CNAME`
- **Name:** `ai` (or whatever subdomain you chose)
- **Value:** Railway's domain for this service

Add this at your domain registrar.

---

## Step 5: Update Environment Variables

Once your domains are set up and DNS has propagated, update environment variables:

### Vercel (Frontend):
Go to **Settings** → **Environment Variables** and update:
- `VITE_API_URL` = `https://api.backgammonarena.com` (your backend domain)
- `VITE_BACKEND_URL` = `https://api.backgammonarena.com` (same as above)

**Important:** After updating, you need to **redeploy** the frontend for changes to take effect.

### Railway (Backend Service):
Go to **Settings** → **Variables** and update:
- `FRONTEND_URL` = `https://backgammonarena.com` (or `https://www.backgammonarena.com` - your frontend domain)
- `PYTHON_AI_SERVICE_URL` = `https://ai.backgammonarena.com` (your Python service domain)

### Railway (Python AI Service):
Go to **Settings** → **Variables** and verify:
- `FLASK_DEBUG` = `False`
- `PORT` = (auto-set by Railway)

---

## Step 6: Verify DNS Propagation

Check if your DNS records have propagated:

1. Go to [whatsmydns.net](https://www.whatsmydns.net)
2. Enter your domain
3. Check if the records match what you configured

Or use command line:
```bash
# Check A record
nslookup backgammonarena.com

# Check CNAME record
nslookup api.backgammonarena.com
```

---

## Step 7: Test Everything

Once DNS has propagated (usually 5-30 minutes):

1. **Test Frontend:**
   - Visit `https://backgammonarena.com`
   - Should load your app

2. **Test Backend:**
   - Visit `https://api.backgammonarena.com/api/health`
   - Should return: `{"status":"ok","message":"Backgammon Arena API is running"}`

3. **Test Python Service:**
   - Visit `https://ai.backgammonarena.com/api/health` (if you added a health endpoint)
   - Or test through the frontend by playing a CPU game

4. **Test Full Flow:**
   - Play a game vs CPU
   - Check browser console for any CORS errors
   - Verify API calls are going to your custom domains

---

## Step 8: Enable HTTPS/SSL

Both Vercel and Railway automatically provide SSL certificates:
- **Vercel:** SSL is automatic once DNS is configured
- **Railway:** SSL is automatic once DNS is configured

You should see a padlock icon in your browser. If not, wait a few minutes for SSL to provision.

---

## Recommended Domain Structure

Here's a recommended setup:

- **Frontend:** `backgammonarena.com` (or `www.backgammonarena.com`)
- **Backend API:** `api.backgammonarena.com`
- **Python AI Service:** `ai.backgammonarena.com` (or you can use a different subdomain)

---

## Troubleshooting

### DNS Not Working:
- Wait 5-30 minutes for DNS propagation
- Double-check DNS records at your registrar
- Verify you're using the correct record types (A for root, CNAME for subdomains)
- Clear your DNS cache: `ipconfig /flushdns` (Windows) or `sudo dscacheutil -flushcache` (Mac)

### SSL Certificate Issues:
- Wait 10-15 minutes after DNS propagation for SSL to provision
- Check Railway/Vercel logs for SSL errors
- Verify DNS records are correct

### CORS Errors:
- Make sure `FRONTEND_URL` in Railway backend matches your actual frontend domain
- Check that the frontend is using the correct `VITE_API_URL`
- Redeploy services after changing environment variables

### Services Not Responding:
- Check Railway/Vercel deployment logs
- Verify services are running (not crashed)
- Check environment variables are set correctly

---

## Quick Checklist

- [ ] Got Railway service URLs
- [ ] Got Vercel deployment URL
- [ ] Added domain to Vercel
- [ ] Added DNS records for frontend at registrar
- [ ] Added domain to Railway Backend
- [ ] Added DNS records for backend at registrar
- [ ] Added domain to Railway Python Service
- [ ] Added DNS records for Python service at registrar
- [ ] Waited for DNS propagation (5-30 minutes)
- [ ] Updated environment variables in Vercel
- [ ] Updated environment variables in Railway
- [ ] Redeployed services (if needed)
- [ ] Tested frontend loads
- [ ] Tested backend health endpoint
- [ ] Tested full game flow
- [ ] Verified HTTPS/SSL is working

---

## Next Steps After Domain Setup

Once your domain is live:
1. ✅ Test all game modes (vs CPU, pass & play)
2. ✅ Verify API calls are working
3. ✅ Check browser console for errors
4. ✅ Test on mobile devices
5. ✅ Set up auto-deploy (if not already done)

---

**You're all set! Your app should now be live on your custom domain! 🎉**

