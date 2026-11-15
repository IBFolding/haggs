# Account restore safety and hosted release checks

## Changes

- Signing in no longer enrolls every device project in cloud sync. Each library card has **Save to this account**. Existing device projects remain intact until deliberately enrolled; projects downloaded from an account are associated with that account automatically.
- Account-scoped sync receipts, pending work, file maps and deletion tracking replace the previous shared `sync/*` bookkeeping. Account A's cached media addresses and project list cannot be reused for Account B. Legacy global caches are not treated as an account's authorization to upload or delete.
- Supabase list/read/delete queries explicitly filter the captured account ID in addition to existing database RLS. Async operations stop after account changes; requests time out after 20 seconds. Conflicting device copies and malformed account snapshots are rejected rather than overwritten. Removing sheets in an account snapshot clears stale local sheets.
- Account and Projects pages show sync progress, failures, oversized-project warnings and **Sync now**. Restored projects refresh the library immediately. The UI distinguishes enrollment from a successful sync receipt.
- Hosted project-bundle restore requires a signed-in user and configured private storage before requesting an upload. A public destination cannot silently receive a supposedly private restore. Device-to-account file copying also requires private storage before new files are copied. Existing ordinary uploads and previously public assets are not retroactively made private.
- An OAuth callback without a code or active session now explains the failure and links back to sign-in instead of silently continuing into the studio.

This does not implement account-backed comic-book persistence, new paid generation, a new billing flow, or production rollout.

## Live observations and configuration

- November 12, 2026: https://haggs.vercel.app/api/blob/upload returned `access: public`. No private Blob write token or private-write flag appeared in environment-name metadata. The public live site is not verified as a private storage deployment.
- Vercel CLI authenticated as the existing owner's account. Metadata showed public Supabase settings only on Production and two older preview branches; the new previews lacked sign-in configuration.
- Extended the existing `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `NEXT_PUBLIC_HOSTED` entries from Production to Production + Preview using metadata-only PATCH requests. Values were neither decrypted nor printed; no API keys were copied into the repository. Old branch-specific overrides were retained. New preview builds can receive those settings; existing deployments are not rebuilt automatically by this change.
- The Vercel plugin's environment-list endpoint was unavailable, so the authenticated CLI/REST path was used. Public environment editing reference: https://vercel.com/docs/rest-api/projects/edit-an-environment-variable.
- No private store was provisioned and no hosted media uploaded. Store creation itself counts as an Advanced Operation; a maximum-$1 storage setup/test approval was requested. Pricing reference: https://vercel.com/docs/vercel-blob/usage-and-pricing. No new spend is assumed authorized by that pending question.

## Verification

- Nine new account-sync regressions cover explicit enrollment, account switching, isolated deletion tracking, isolated file maps, two-device restore, late responses after sign-out, ID collisions, malformed snapshots and sheet removal.
- Browser fixture: two separate browser contexts, real app/IndexedDB and simulated Supabase responses. Enrolled project restored in the second context; changing the first context to another account sent no additional project uploads. Restoring a media ZIP against public storage showed an error and made zero upload POSTs. This is a fixture test, not proof of hosted RLS or owner sign-in.
- Browser fixture: callback without a session/code displayed a clear error and return link.
- Full suite: 1,535 passed, 8 skipped, 0 failed. Typecheck and production build passed. Provider/Stripe requests are not used by these checks.
- The owner's actual sign-in in the opened browser remains pending. No authenticated hosted upload, cross-account denial against real stored media, paid render or live checkout is claimed.

## Remaining release boundary

1. Owner completes sign-in in the test browser. Confirm Google provider and allowed callback URLs in the owning Supabase project if it fails.
2. With the explicit storage budget, create a separate private Blob store; securely bind its token as server-only `HAGGS_PRIVATE_BLOB_READ_WRITE_TOKEN` and set `HAGGS_PRIVATE_MEDIA_WRITES=1` on the candidate preview. Keep the existing public store/token intact. Do not publish credentials or mark public legacy assets private.
3. Import a dedicated sub-1 MB test pack. Verify private upload, own-account read/range playback, signed-out/other-account denial, fresh-project restore in a second signed-in browser and cleanup of test artifacts. Retain nonsecret receipts.
4. Verify sandbox checkout, webhook/credits, cancellation, RLS and recovery. Real GPU/generation proof still needs its own provider, exact workflow and approved spend cap.
5. Review stacked PRs and release gates before a production promotion; #140 retains its separate hold.
