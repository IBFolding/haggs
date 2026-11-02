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
