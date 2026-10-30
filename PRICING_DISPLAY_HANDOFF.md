# Pricing display correction — integration handoff

Target integration task: `01a18968-5cb9-762b-834b-9aeff501202b`.
Branch: `fix/explicit-provider-pricing`.
Base: `d6c8cdb9f849eb178ccd3392e04096993976c051`.
**Hold merge and deployment. No paid test run is required or authorized by this patch.**

The campaign's 78-credit display used a six-second default and Haggs' 100-credit/USD unit. The provider actually ran four seconds at 768P and charged 108.62 Comfy credits, matching $0.1287 × 4 × 211. This is a display correction, not a billing adjustment.

## Result

- Studio's current selection drives the estimate immediately: duration, resolution, first-frame mode and bank-only references. No asynchronous default estimate can overwrite the selected configuration.
- H3 displays both explicitly named units with their billing routes explained: at four seconds, `Est. 108.62 Comfy / 52 Haggs credits`. It does not guess whether the user will supply a key or use a plan.
- USD precision is retained until final Comfy conversion. Existing plan USD rounding and Haggs credit rounding remain unchanged.
- Unknown configurations show `Estimate unavailable`. Other model-table prices are labeled unverified USD estimates. The picker no longer presents a default model price as a current quote.
- Source links and verification date are visible. Every displayed amount is an estimate, not an enforceable spending cap.

## Verification

- 15 focused tests: campaign receipt regression, all H3 durations/resolutions, reference surcharges, first-frame mode, unknown settings, provider workflow submission shape and Studio request routing.
- 43 existing billing, credit-formatting, animate-all and cloud-model tests pass.
- `npm run typecheck` and `git diff --check` pass.
- Provider mocks only: no paid job, network generation or financial-record mutation.

Verified sources (2026-10-30):
- https://docs.comfy.org/tutorials/partner-nodes/pricing
- https://support.comfy.org/articles/5846341390-how-credits-work-in-comfy
- https://github.com/Comfy-Org/ComfyUI/blob/master/comfy_api_nodes/nodes_minimax.py

## Integration boundaries

The isolated checkout borrows Git objects and installed dependencies from the integration checkout; only the local branch's files were edited. No shared uncommitted work was copied or modified. Changes touch `src/app/studio.tsx`, `src/providers/cloud-price.ts` and new `src/story/studio-price*` modules, plus this handoff. The integration owner should review conflicts with any composer work and run its combined-release checks before the existing approval gate.

Balances, stored charges, financial settings, generation behavior, provider requests and existing `cloudEstimate()` numerical behavior are unchanged. Gallery, board and other workflow price labels remain outside this Studio-focused patch and still need the separate unit-display audit described in the investigation report. No production/browser end-to-end rendering was performed. The static verified rate is explicitly dated and may change; this patch does not claim a live provider quote or implement a hard cap.
