# Ads non-spending verification follow-up

2026-10-30. No credentials changed or disclosed. No generation, credit spend, merge, push or deployment.

## Exact cause

`Ads.make` calls `makeStill` (`src/app/series-actions.ts:40`). Without a personal Comfy key it calls `comfyAccess`, which evaluates `liveDeps()` before `decide()`.

`src/server/platform.ts:78` constructs `createClient(url, anon, ...)` unconditionally. The URL defaults to an empty string when `NEXT_PUBLIC_SUPABASE_URL` is absent. The SDK then throws `supabaseUrl is required.` synchronously. `comfyAccess` catches and returns that message. This occurs before `credits_spend`, before provider submission and before storage reservation.

Offline reproduction using the installed SDK and empty strings produced the identical error without a network request. The no-key decision would otherwise return the intended `Add a Comfy key to make pictures.` message, but the early constructor prevents reaching it.

## Combined release configuration check

Read-only inspection of `task/haggs-integration` found the identical `platform.ts` and `series-actions.ts`, so the cause is present there too. Both it and the isolated Ads checkout contain only `.env.example`, with no actual local `.env`, `.env.local` or mode-specific configuration files. Neither required Supabase variable is declared in that example. The current execution shell has no nonempty `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `COMFY_PLATFORM_KEY`, `HAGGS_PLATFORM_KEYS` or `BLOB_READ_WRITE_TOKEN`.

These are presence-only checks; no values were printed. They establish that the checked-out combined release does not supply the needed local configuration. They do not establish the environment of an independently launched server or a hosted deployment. Deployment configuration and migrations remain unverified.

## Non-spending handoffs

A temporary local QA page appended one clearly labeled fixture to the existing Ads draft, using the bundled `/samples/ad-kettle.jpg`, with a backup of the original Ads draft. It did not call a provider or record a generated run.

- Clicked the real Ads `Animate in Video` button. `/video` showed the starting image and exactly the preservation/animation prompt from `prepareAdHandoff`; generation remained a separate priced button.
- Clicked the real Ads `Edit` button. `/edit` showed the reference image and the original labeled fixture campaign prompt; generation remained a separate priced button.
- Restored the original Ads draft via the QA page and removed that temporary source route. No fixture result remains in Ads. Screenshots are in `ads-handoffs/`.
- The helper and Studio's receiving contract are also present in the combined release. Browser verification used isolated preview port 3138, not the combined deployment.
- 12/12 handoff and billing-decision unit tests passed in the Ads checkout. Combined checkout test result follows below.

## Safe next step

Make Supabase client creation lazy inside the credit operations, or guard missing configuration with a clear unavailable message, preserving all existing auth/credit gates. This allows unconfigured local previews to reach the honest missing-key decision without a generic SDK exception. Test this with all credentials absent and ensure zero network/provider calls. No credentials need to be copied or rotated for that fix.

A successful paid render is still unverified. It should only be attempted in an authorized configured environment after explicit bounded spending authorization. The separately tracked campaign-video charge is not resolved by this error diagnosis.

Combined checkout: **12/12 tests passed** with `node --import tsx --test src/brand/ad-handoff.spec.ts src/server/platform.spec.ts`. Combined source was not modified. The temporary Video/Edit fixture image and prompt were cleared through their UI after screenshot capture. `git diff --check` passed. This follow-up changes documentation/evidence only, so no production rebuild was needed.
