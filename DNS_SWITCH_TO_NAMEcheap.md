# Switching DNS to Namecheap BasicDNS

## Why You Need to Do This

Your DNS is currently managed by cPanel (another service), so you can't edit DNS records in Namecheap. To add the Railway CNAME record, you need to switch to Namecheap BasicDNS.

## Steps to Switch to Namecheap BasicDNS

1. **In Namecheap Advanced DNS Tab:**
   - You should see "HOST RECORDS" section
   - Click the red "Change DNS Type" link

2. **Select Namecheap BasicDNS:**
   - You'll be asked to choose DNS management
   - Select "Namecheap BasicDNS" (or just "BasicDNS")
   - Confirm the change

3. **Wait for DNS Propagation:**
   - The change can take 5-30 minutes
   - You'll see the HOST RECORDS section update

4. **After the Switch:**
   - You'll be able to see and edit DNS records
   - You can add the CNAME record for Railway

## Important Notes

⚠️ **Before switching:** Make sure you note down any existing DNS records (like email MX records, www records, etc.) because they might be managed in cPanel and you'll need to recreate them in Namecheap after switching.

However, if you don't have a website or email set up yet, you can safely switch - you'll just need to add the Railway CNAME record.

## After Switching - Add Railway CNAME

Once DNS is managed by Namecheap, you'll add:
- **Type:** CNAME Record
- **Host:** `api`
- **Value:** (The CNAME target from Railway - we'll get this next)

