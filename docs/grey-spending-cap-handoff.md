# Grey Room per-customer cap — local, not release-ready

Branch fix/grey-media-consent starts at current main c173e16. No production settings, secrets, database schema, or paid jobs were changed by this increment.

Implemented:
- Independent HAGGS_GREY_STILL_ENABLED / HAGGS_GREY_VIDEO_ENABLED flags; planning retains HAGGS_GREY_AI_ENABLED and vision flag. Planning flag alone cannot enable media after this change.
- Still/video server actions require exact-input, kind, provider-identity and estimate-bound single-use quotes. Video requires first-frame approval. UI obtains quote and explicitly confirms its displayed estimate.
- Customer cap UI and authenticated server actions. Total lifetime cap, initially zero; no automatic monthly reset. Setting cap cannot reduce below charged plus reserved amounts.
- Separate proposed migration 20261103000000_grey_user_spending_caps.sql: two RLS-protected tables and four narrow RPCs. Customer functions use auth.uid; reserve/finish require existing server secret. Direct table access denied. Per-account row locks serialize reservations and settlement. Unknown amounts keep reservations; duplicate finalization rejected; actual overcharges are recorded honestly.
- All three provider call paths wrapped by runWithGreyCap. Missing identity/cap/reservation/provider ceiling fails closed. No paid request until a verified maximum charge is available.

Critical activation blockers:
1. verifiedGreyMaximum deliberately returns undefined for every current provider route. Current Comfy USD0.20 is an estimate, NOT an enforceable maximum. A quote-sum budget cannot guarantee a real provider-spend cap. Need a provider-enforced ceiling or proven maximum for each supported action before enabling it.
2. Runtime retains every submitted reservation as uncertain. Actual-cost reconciliation is not wired to provider billing yet. SQL supports idempotent settlement, but no automatic refund based on success/error guesses is used.
3. New cap schema needs separate review and explicit production migration approval; prior quote-ledger approval does not cover it.
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

Next Claude action: establish a documented enforceable maximum for each chosen provider path (or explicitly agree a different budget contract), then wire it without replacing estimates with guesses. Review/apply the new cap migration only after separate approval; complete build, browser QA and deployed tests. Do not enable this local branch merely because the accounting unit tests pass.

Follow-up validation completed: 13 focused reconciliation/gateway tests, 4 existing writer transport tests, TypeScript noEmit and diff whitespace checks passed. No full build/browser review performed for this local follow-up.

Potential narrower launch path for Claude to assess: Haggs-credit-funded media already debits a deterministic creditsFor(usd) amount before submission. A cap explicitly denominated in Haggs generation credits could bound the customer's debit even when Haggs's provider cost varies. This is a different contract from a USD cap on the customer's external BYOK account, and credit purchase dollars are not 1:1 with generation credits (see billing.ts packs/customer share). Do not silently relabel the current USD budget or claim it caps external provider spend. No such product change was implemented here.
