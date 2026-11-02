# Multi-worker quotes and stand-in editing

The production action now uses a shared Supabase quote store, with **no in-memory fallback**. It reuses the existing public Supabase configuration and `HAGGS_WEBHOOK_SECRET` pattern already used for storage accounting. No credentials or persistent configuration were changed.

`supabase/migrations/20261102000000_grey_proposal_quotes.sql` is additive and has not been applied to any remote database. It introduces only quote metadata: random quote ID, context/credential/policy hashes, estimate, expiry and claim timestamp. No provider keys, prompt/scene text, images, project rows or takes are stored in this table.

Creation is bounded by expiry and pending-count limits. Reads and atomic claims require the existing server secret. Direct anonymous/authenticated table access is revoked and RLS enabled. Claiming uses a single conditional update that succeeds for exactly one worker, after checking the quote's hashes, amount and expiry. Provider submission occurs only after a confirmed claim. A storage timeout—even one after the claim committed—sends nothing from that request. Consumed quotes remain consumed across worker/database restarts; a provider failure never releases a claim for retry. Users must check provider activity before explicitly requesting a new quote.

The gateway reconstructs the request from the validated client context after matching its hash, so the shared store does not persist that text. The memory store is retained only as an explicit local test seam; the actual server-action wiring always selects the shared adapter.

## Local database proof

`scripts/grey-quote-db-check.mjs` creates its own disposable Postgres cluster under this checkout's `runtime-tmp`, binds only 127.0.0.1:55439, applies the migration to test fixtures, exercises concurrent claims and restart behavior, then stops and deletes the cluster. It never reads remote database configuration. Existing local Postgres tools are used, with no install or real credentials. Results: `database-results.json`.

The first harness run exposed an inherited stdout pipe during restart; the harness was corrected to redirect the restarted server log. This was a harness issue, not a claim failure. No other database or session was stopped.

## Scene editing

The selected-object controls now support renaming figures/props, prop size and rotation, locking, hiding, and removing a selected stand-in. Edits use the existing scene values and save path. Existing animation channels are edited at the current playhead, locked props reject transform edits, and removing a stand-in only removes its scene layer—never source media or references. Existing compositor controls remain available.

## Rollout blockers

The migration still requires authorized deployment to the real Supabase database. Until then, the shared-store path fails closed. Reviewed pricing and budget-approved live provider validation are also still pending, and the rollout gate remains disabled. No push, merge, production change or paid call was performed.
