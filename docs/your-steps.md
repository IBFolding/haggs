# Your steps, in order

Do these one at a time. Each says where to click and what to expect. Tell Claude when
you finish 1 to 5 and it will redeploy and run a test purchase.

All `vercel env add` commands are run in a terminal in the haggs folder:
`cd "/Volumes/CODEX PROJECTS/HAGGS/haggs"`. Each one asks for the value; paste it and press
Enter. Nothing is shown on screen while you paste.

---

## A. Turn on payments (test mode, no real money)

### 1. Create the Stripe key
1. Open https://dashboard.stripe.com and make sure the top-left says **HaggsField sandbox**.
2. Go to **Developers → API keys → Create restricted key**.
3. Name it `haggs server`.
4. Set these permissions, leave everything else on **None**:
   - Customers: **Write**
   - Checkout Sessions: **Write**
   - Customer portal: **Write**
   - Subscriptions: **Read**
5. Click **Create key**, then copy the key that starts with `rk_test_`.
6. In the terminal:
   ```
   vercel env add STRIPE_API_KEY production
   ```
   Paste the key.

### 2. Switch on the customer portal
Stripe sandbox → **Settings → Billing → Customer portal → Activate test link**. Leave the
defaults. Without this, "Manage subscription" shows an error.

### 3. Add your Comfy key
1. Open https://platform.comfy.org (or your Comfy account page) and copy your API key.
2. In the terminal:
   ```
   vercel env add COMFY_PLATFORM_KEY production
   ```
   Paste the key.

### 4. Choose your cut
`HAGGS_PLATFORM_CUT` is the percentage you keep of every plan and pack. The rest becomes the
customer's credits. Example: `25` means a $39 plan gives the customer $29.25 of generation.
```
vercel env add HAGGS_PLATFORM_CUT production
```
Type a number between 1 and 99.

### 5. Switch on included generation
```
vercel env add HAGGS_PLATFORM_KEYS production
```
Type `1`.

> Before you charge real people: Comfy's terms don't clearly allow running customers on one
> account. Send the email in `docs/comfy-permission-email.md` first.

---

## B. Turn on GitHub sign-in (about five minutes)

1. Open https://github.com/settings/developers → **OAuth Apps → New OAuth App**.
2. Fill in:
   - Application name: `haggs`
   - Homepage URL: `https://haggsfield.studio`
   - Authorization callback URL: `https://pxkfxnvexsekhmcoqjxm.supabase.co/auth/v1/callback`
3. Click **Register application**, then **Generate a new client secret**. Copy the Client ID
   and the secret now; GitHub shows the secret once.
4. Open https://supabase.com/dashboard/project/pxkfxnvexsekhmcoqjxm/auth/providers
5. Click **GitHub**, switch **Enable** on, paste the Client ID and secret, click **Save**.
6. Test: https://haggsfield.studio/signin → **Continue with GitHub**.

---

## C. Check the Gallery with one real picture (about 7 cents)

The Gallery shows what was made in the browser you are using, on the site you are using.
Runs made on localhost never appear on haggsfield.studio, and pictures made before the
latest fix may have expired links.

1. Open https://haggsfield.studio/photos in a normal window.
2. Click **Comfy** in the header, paste your Comfy key, save.
3. Type a short prompt and click **Generate**. The button shows the cost first.
4. Open **Gallery**. The picture should be there with its cost.
5. If it is not, open the browser's developer console (Cmd+Option+J) and send Claude what
   it says, plus which address you were on.

To check account sync, sign in on the same site in a second browser and open **Gallery**.
The picture should appear within about 30 seconds.

---

## D. Send the Comfy email

Open `docs/comfy-permission-email.md`, copy it, and send it to support@comfy.org.

---

## E. Set up the X profile

1. Avatar: `public/brand/x-avatar-800.png`
2. Banner: `public/brand/x-banner-final.png`
3. Name, bio and link: the bio options are earlier in this chat.
