# Grey Room per-customer cap — local, not release-ready

Branch fix/grey-media-consent starts at current main c173e16. Application changes remain local. The cap database migration was subsequently approved and applied to production on 2026-11-02; no production settings, secrets or paid jobs were changed.

Implemented:
- Independent HAGGS_GREY_STILL_ENABLED / HAGGS_GREY_VIDEO_ENABLED flags; planning retains HAGGS_GREY_AI_ENABLED and vision flag. Planning flag alone cannot enable media after this change.
- Still/video server actions require exact-input, kind, provider-identity and estimate-bound single-use quotes. Video requires first-frame approval. UI obtains quote and explicitly confirms its displayed estimate.
- Customer cap UI and authenticated server actions. Total lifetime cap, initially zero; no automatic monthly reset. Setting cap cannot reduce below charged plus reserved amounts.
- Applied migration 20261103000000_grey_user_spending_caps.sql: two RLS-protected tables and four narrow RPCs. Customer functions use auth.uid; reserve/finish require existing server secret. Direct table access denied. Per-account row locks serialize reservations and settlement. Unknown amounts keep reservations; duplicate finalization rejected; actual overcharges are recorded honestly.
- All three provider call paths wrapped by runWithGreyCap. Missing identity/cap/reservation/provider ceiling fails closed. No paid request until a verified maximum charge is available.

Critical activation blockers:
1. verifiedGreyMaximum deliberately returns undefined for every current provider route. Current Comfy USD0.20 is an estimate, NOT an enforceable maximum. A quote-sum budget cannot guarantee a real provider-spend cap. Need a provider-enforced ceiling or proven maximum for each supported action before enabling it.
2. Limited Claude usage reconciliation is implemented below. Comfy receipts and recovery of uncertain charges remain open; no automatic refund based on success/error guesses is used.
3. Cap migration approval and production application are complete; see verification below.
4. Independent security review, production build, desktop/mobile browser verification and deployed integration still required. Do not merge/deploy this branch as finished.

Validation: 16 focused consent/gateway/cap/rollout tests passed; TypeScript noEmit passed; git diff --check passed. Disposable loopback-only Postgres tests passed 12 concurrent reservations, user isolation, lowered-cap rejection, uncertain retention, settlement/replay, invalid NaN settlement and access denial. No remote DB or paid calls. Test artifacts: output/grey-cap-tests.log, output/grey-cap-types.log, output/grey-cap-db-results.json; local DB harness output/check-grey-cap-db.py. Temporary DB clusters stopped and removed.

The existing production quote ledger and real read-only HTTP verification remain completed from the prior increment. Production AI flags remain off. The customer's per-user cap request is understood, but this branch is NOT a claim that enabled paid Grey Room has a hard cap today.

## Provider research and reconciliation follow-up

Authoritative documentation checked 2026-11-02:
- https://docs.comfy.org/interface/credits : Partner Nodes can report charges after execution and leave a negative balance; price badges vary with parameters. Prepaid balance is not a proven per-run ceiling. The current Grey cloud runner does not consume a documented immutable per-job USD receipt. Do not substitute its estimate for settlement.
- https://platform.claude.com/docs/en/build-with-claude/task-budgets : task_budget is advisory; max_tokens is an enforced output-token ceiling, not a full input+output dollar ledger.
- https://platform.claude.com/docs/en/build-with-claude/token-counting : count_tokens supplies an estimate. Do not call a fresh token count a guaranteed total-dollar maximum.
- https://platform.claude.com/docs/en/api/rate-limits : organization/workspace spend limits exist and reject requests once reached. They affect the customer's whole provider scope and monthly window; they are not automatically equivalent to the Haggs customer's lifetime Grey cap. No provider account settings were changed.
- https://platform.claude.com/docs/en/api/service-tiers : response service tier affects interpretation; US-only inference adds pricing differences. Do not settle unknown billing dimensions as the standard tariff.

Implemented limited actual-usage reconciliation:
- askClaude now supports a server-only billing observer, invoked before output parsing/max_tokens handling. It forwards model and usage only, not content or credentials. Existing writer behavior is unchanged when no observer is supplied.
- Grey converts only complete supported Sonnet 5.5 standard/global/uncached token usage with the reviewed 2/10 USD-per-million tariff. Missing model/tokens/geo/tier, unexpected cache/tool fields or changed tariffs return unknown; no zero is invented.
- Grey proposal transport reports that charge to its reservation. The reservation wrapper settles a known charge even if parsing fails, retains unknown/conflicting/invalid charges, and retains the original reservation if settlement fails. This is token-based API cost, excluding taxes/account invoice adjustments.
- Comfy actual-cost reconciliation, later retry/recovery of uncertain reservation receipts, and maximum-charge verification remain open. No provider ceiling was enabled; verifiedGreyMaximum still returns undefined, so no paid call can escape the guard.

Tests for this follow-up: billing parser/transport + gateway + reservation tests cover known charge, malformed/truncated output, network failure, duplicate report, invalid billing values, and settlement failure. No provider jobs or production changes.

Next Claude action: establish a documented enforceable maximum for each chosen provider path (or explicitly agree a different budget contract), then wire it without replacing estimates with guesses. The cap migration is now applied; complete build, independent review, browser QA and deployed application tests. Do not enable this local branch merely because the accounting unit tests pass.

Follow-up validation completed: 13 focused reconciliation/gateway tests, 4 existing writer transport tests, TypeScript noEmit and diff whitespace checks passed. No full build/browser review performed for this local follow-up.

Potential narrower launch path for Claude to assess: Haggs-credit-funded media already debits a deterministic creditsFor(usd) amount before submission. A cap explicitly denominated in Haggs generation credits could bound the customer's debit even when Haggs's provider cost varies. This is a different contract from a USD cap on the customer's external BYOK account, and credit purchase dollars are not 1:1 with generation credits (see billing.ts packs/customer share). Do not silently relabel the current USD budget or claim it caps external provider spend. No such product change was implemented here.

## Approved production cap migration — completed 2026-11-02

Target: HAGGSFIELD production, Supabase project `pxkfxnvexsekhmcoqjxm`. Preflight confirmed both new tables and all four functions absent and the existing webhook secret present. Exact SQL was verified before execution, with a 5-second lock timeout and 30-second statement timeout. Migration committed successfully. Existing customer projects, media and billing tables were not modified.

Postflight detected Supabase default function grants to anon. Explicitly revoked anon from the two customer functions in a corrective transaction, and incorporated `REVOKE ... FROM public,anon` into the source migration before its intended grants. Final checks passed: both tables have RLS; direct anon/authenticated table privileges are absent; all four SECURITY DEFINER/search_path and RPC grants match the intended policy; unauthenticated status is empty; the existing secret is accepted and an invalid secret rejected. No user budget rows were created by verification.

Read-only production HTTP verification passed through the existing application adapter and configuration: quote read, invalid-secret rejection, direct table denial, anonymous cap-status denial, and a harmless finish lookup for a nonexistent reservation with the existing secret. Zero provider calls and zero HTTP writes. AI and vision rollout flags remain disabled. Evidence: `output/grey-paid-test-packet/production-cap-http-results.json`.

The reproducible local harness is now `scripts/check-grey-cap-db.py`; it simulates Supabase default anon/authenticated EXECUTE grants. All nine checks passed again, including 12 concurrent reservation attempts. Requires local PostgreSQL tools and the external-drive runtime-tmp/output directories; temporary cluster is stopped and removed in finally.

This resolves the database migration blocker only. Application changes are not released; provider maximum-charge guarantees, independent review, full build/browser QA and application rollout remain outstanding. At the time of migration no paid-test dollar cap had been supplied; no paid test ran. See subsequent authorization below.

## Subsequent user authorization — 2026-11-02

User explicitly requested AI activation and authorized a USD 100 total limit for their own spending: “jus turn ai on! cost limit for me is 100$ they can approve to go over if need when prompted.” This resolves the missing numeric owner-test budget. It does not grant automatic overage: stop before exceeding USD 100 and obtain explicit approval for a new higher limit. Each customer must set/raise their own cap; do not set USD 100 globally or identify the owner by a guessed email/user ID.

No paid requests or rollout settings were changed in response yet. Current application guard still deliberately blocks all provider routes without a verified maximum; production cap UI/guards remain unreleased. Enabling the old combined switch would not enforce this newly specified limit. Finish the guarded release and verify supported per-request maximums before spending.

## Guarded planning bound — implemented, release validation in progress

Independent read-only review of the following change found no confirmed blocker. Official Sonnet 5.5 specifications give a 1,000,000-token context and USD 2/10 per million input/output tokens. Grey enforces 2,500 maximum output tokens, so reserving the full input window plus maximum output costs USD 2.025, rounded upward to USD 2.03. This replaces the earlier blanket “no bound available” conclusion for scene planning only. It does not use the estimated input size.

Transport now opts into enforced Sonnet 5.5 / 2500 output, standard_only tier, global inference and standard speed. The fixed body has no tools, caching or retries. Changed configured model/rates fail closed. Quote UI explicitly discloses the USD 2.03 reservation, its release only on confirmed usage, and scope: Grey API token charges, not tax or unrelated account activity. Known zero ancillary usage and included thinking tokens can reconcile; unexpected charge dimensions retain the full reservation.

Still/video remain unavailable because their provider maximum is unknown. The review covered bound math, routing, SQL concurrency/identity protections and media fail-closed behavior; live acceptance remains to be tested. Owner USD 100 approval is recorded above, not yet saved to a guessed account.
