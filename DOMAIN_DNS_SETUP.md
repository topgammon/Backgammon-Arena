# Setting Up Custom Domain (api.topgammon.com) with Railway and Namecheap

## Step 1: Get DNS Information from Railway

1. In Railway, go to your service → **Settings** → **Networking**
2. Click on your custom domain: `api.topgammon.com`
3. Railway should show you:
   - **CNAME target** (usually something like `cname.railway.app` or a subdomain)
   - **OR** an **A record** IP address
   - Make note of what Railway tells you to use

## Step 2: Configure DNS in Namecheap

### Option A: If Railway gives you a CNAME target

1. Log into **Namecheap**
2. Go to **Domain List** → Click **Manage** next to `topgammon.com`
3. Go to **Advanced DNS** tab
4. Add a new record:
   - **Type:** `CNAME Record`
   - **Host:** `api` (for api.topgammon.com)
   - **Value:** (paste the CNAME target from Railway)
   - **TTL:** `Automatic` or `30 min`
5. **Save** the changes

### Option B: If Railway gives you an A record IP

1. Log into **Namecheap**
2. Go to **Domain List** → Click **Manage** next to `topgammon.com`
3. Go to **Advanced DNS** tab
4. Add a new record:
   - **Type:** `A Record`
   - **Host:** `api` (for api.topgammon.com)
   - **Value:** (paste the IP address from Railway)
   - **TTL:** `Automatic` or `30 min`
5. **Save** the changes

## Step 3: Remove Any Conflicting Records

- Make sure there's only **ONE** record for `api` subdomain
- If you have both A and CNAME, remove one (CNAME is usually preferred)

## Step 4: Wait for DNS Propagation

- DNS changes can take 5 minutes to 48 hours
- Usually works within 15-30 minutes
- You can check DNS propagation at: https://www.whatsmydns.net/#CNAME/api.topgammon.com

## Step 5: Verify in Railway

- Railway should automatically detect when DNS is properly configured
- Railway will provision SSL/TLS certificate automatically
- Check Railway's domain status - it should show as "Active" or "Verified"

## Troubleshooting

If Railway shows the domain as "Pending" or "Not Verified":
- Double-check the DNS record in Namecheap matches exactly what Railway shows
- Wait a bit longer for DNS propagation
- Try removing and re-adding the DNS record

