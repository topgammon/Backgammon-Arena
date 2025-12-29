# Checking DNS Configuration in Namecheap

## Steps to Check Current DNS Records

1. **Log into Namecheap**
   - Go to https://www.namecheap.com
   - Sign in to your account

2. **Navigate to Domain Management**
   - Click **"Domain List"** in the left sidebar
   - Find **"topgammon.com"** in your domain list
   - Click **"Manage"** button next to it

3. **Check Advanced DNS**
   - Go to the **"Advanced DNS"** tab
   - Look for any records with:
     - **Host:** `api` or `@` or `api.topgammon.com`
     - **Type:** `CNAME Record` or `A Record`

4. **What to Look For:**
   - If you see a CNAME record for `api`, check what the **Value/Target** is
   - Common Railway CNAME targets look like: `xxxxx.railway.app` or `cname.railway.app`
   - Write down what you see

5. **Screenshot or Note:**
   - Take a screenshot or note down:
     - The Host name
     - The Type (CNAME or A Record)
     - The Value/Target
     - The TTL

## What We're Checking For

We need to verify:
- ✅ Is there a CNAME record for `api` pointing to Railway?
- ✅ Is the target correct?
- ✅ Are there conflicting records (like both A and CNAME)?

Once you check Namecheap, let me know what DNS records you see for the `api` subdomain, and we'll fix it from there!

