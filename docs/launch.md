# Going live: the switches

Everything below is built. Each piece stays off until its switch is set, so the
site keeps working while you turn things on one at a time.

## 1. Database (Supabase → SQL editor, paste and run, in order)

1. `supabase/migrations/20261022000000_community.sql` (the Community shelf)
2. `supabase/migrations/20261023000000_user_projects.sql` (projects follow people across devices)
3. `supabase/migrations/20261023000100_credits.sql` (the credits ledger)

Then, once, in the same editor, set the webhook secret (use any long random string, and use the same one in `HAGGS_WEBHOOK_SECRET`):

```sql
insert into public.app_secrets (key, value) values ('webhook', 'PASTE-A-LONG-RANDOM-STRING')
on conflict (key) do update set value = excluded.value;
```

## 2. Sign-in

Supabase → Authentication → Providers: turn on Google and GitHub with their client ID and secret.
Redirect to register at each provider: `https://<project>.supabase.co/auth/v1/callback`.
Supabase → Authentication → URL Configuration: Site URL `https://haggsfield.studio`; redirect URLs `https://haggsfield.studio/**` and `https://haggs.vercel.app/**`.

## 3. Hosting (Vercel environment variables)

| Variable | Meaning |
| --- | --- |
| `BLOB_READ_WRITE_TOKEN` | the file store (already connected) |
| `NEXT_PUBLIC_HOSTED=1` | browsers upload straight to the store |
| `CRON_SECRET` | lets the daily job remove files older than 60 days |
| `HAGGS_REQUIRE_SIGNIN=1` | saving, uploading and rendering need a signed-in person |
| `NEXT_PUBLIC_ENABLE_FAL=1` | switch fal back on (off for now) |

## 4. Subscriptions and credits

In Stripe create recurring prices for the four plans (Platform $15, Creator $39, Studio $69, Production $99) and one-off prices for the top-up packs ($10, $25, $50), then set:

| Variable | Meaning |
| --- | --- |
| `STRIPE_API_KEY` | secret key |
| `STRIPE_PRICE_BYOK`, `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_MID`, `STRIPE_PRICE_PRO` | the four plan prices |
| `STRIPE_PRICE_TOPUP_10`, `_25`, `_50` | the three packs |
| `STRIPE_WEBHOOK_SECRET` | signing secret of a webhook to `/api/billing/webhook` for `invoice.paid` and `checkout.session.completed` |
| `HAGGS_WEBHOOK_SECRET` | the string you stored in `app_secrets` |
| `COMFY_PLATFORM_KEY` | the platform's own Comfy API key |
| `HAGGS_PLATFORM_KEYS=1` | people on a plan run on that key, paid for in credits |

A credit is one cent of generation at Comfy's list price. Plans include 0 / $15 / $28 / $45 a month (no rollover); packs are sold at 1.5 times cost. Before charging anyone, top up the Comfy account behind `COMFY_PLATFORM_KEY` and watch its balance against the credits sold.
