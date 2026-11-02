# Automatic in-app proposal transport

The in-app proposal action now reuses Haggs' existing authenticated Claude writer architecture: `keyIn`, `claudeWorkspaceIn`, request cookies, and `askClaude`. Production reads only the existing browser provider key; development retains the existing environment fallback. This work does not create or change credentials.

## Request flow

1. Describe the scene, then choose **Get AI proposal quote**. Quoting never invokes the model.
2. The server validates bounded text/layout context and returns a five-minute estimate. Media URLs, source footage, masks, project/take records and image bytes are excluded from this transport. Reference names are context only; image analysis is not claimed.
3. The user explicitly checks the cost-consent box, then chooses **Request AI proposal**.
4. The server confirms the quote still matches the scene, provider credentials/workspace and pricing policy, then atomically consumes it before sending one authenticated request. There are no automatic retries.
5. A schema-validated response enters the existing review panel. Nothing is applied until **Apply reviewed proposal**. The manual request/reply path remains available.

Input changes invalidate the displayed quote. A response arriving after the scene changes is discarded with an explanation; it cannot silently apply stale edits. Duplicate submissions cannot reuse a quote. Provider failure and uncertain charge status use static messages that do not expose provider bodies or credentials.

## Rollout remains disabled

No persistent configuration values were changed. The local QA server explicitly used a disabled gate. The default is fail closed. The server requires all of these operator-reviewed settings before quoting:

- `HAGGS_GREY_AI_ENABLED=1`
- `HAGGS_GREY_AI_PRICING_MODEL` exactly matches the existing `WRITER_MODEL`
- Positive, finite `HAGGS_GREY_AI_INPUT_USD_PER_MILLION`
- Positive, finite `HAGGS_GREY_AI_OUTPUT_USD_PER_MILLION`

The estimate uses the bounded request/schema byte count plus a protocol allowance and the 2,500-token output limit. It is an estimate, not a hard billing cap; actual provider billing may differ. Real pricing and a paid validation request still need explicit approval before any rollout configuration is enabled.

Quotes now use a shared Supabase metadata store with an atomic claim, so separate workers and restarts cannot replay a consumed quote. The additive migration is tested in a disposable local Postgres cluster but remains unapplied remotely. Production wiring has no in-memory fallback. See MULTIWORKER.md for concurrency proof and rollout requirements.

## Verification

Mocked tests cover disabled/missing-price gates, missing credentials, input limits, quoting without spend, consent, context/key/workspace/policy binding, expiry/restart, concurrent submissions, one-time consumption, malformed output and static error handling. A test exercises the actual `askClaude` HTTP transport with fake fetch, verifying existing key/workspace headers and schema without any real network request. Browser QA checks the default-disabled action and preservation of the manual flow. See QA.md for final results.

No paid call, key configuration, production change, push, merge or deployment was performed.
