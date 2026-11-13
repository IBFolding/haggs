# Haggs release tracker

Updated: November 12, 2026 (America/Los_Angeles).

These are the six priorities the owner asked to retain. Keep their IDs stable. Mark a priority complete only when its acceptance evidence is linked here; a green build, preview or sample cover is not end-to-end proof. Do not expand this list with competitor-inspired features without keeping the six release priorities visible.

| ID | Priority | Current state | Completion evidence required | Next action |
|---|---|---|---|---|
| R1 | Hosted accounts, storage and preview test billing | Not verified end to end. Production publicly reports configured plans and public upload storage. Public Supabase/hosted settings now target Preview as well as Production; new builds are needed. Account-scoped sync, explicit enrollment and private-restore guards have local regression evidence. Owner sign-in, private storage and preview checkout remain unverified. | Owner signs in; correct account access/isolation; private media upload/restore; test checkout, signed webhook and cancellation verified without live charges. | Complete owner sign-in and the pending maximum-$1 private-storage approval; then validate private media/account isolation and sandbox billing on the candidate preview. |
| R2 | Real comic and Shorts generation | Local editing/export and hosted pages checked. Optional Claude planning, panel generation/retouch, speech and finished cloud video untested in this candidate. | A budgeted comic plan → draw → retouch → export and a Short → images/voice/video → finished cut, with saved provider job IDs, real results and no duplicate submissions. | Choose a small proof project and explicit spend cap before any billable test. |
| R3 | Account-backed comic saving and publishing | Books/pages currently local to the browser. Project JSON and CBZ exist. Community publishing is not built. | Same book restores in a second authenticated browser/device; permissions, recovery/deletion and publication visibility work; no cross-account access. | Add authenticated book/page persistence and media handling; then publishing controls. |
| R4 | Finished sample projects | Four comic sample briefs and 12 Shorts templates exist. Only explicitly labelled existing sample art/clips are supplied. | Representative completed comics/videos with their actual editable projects, provenance and reproducible settings. No template should be presented as a finished render. | Complete one strong comic and one strong Short through R2; expand the gallery from verified projects. |
| R5 | Deeper winner integrations and quality/repair | Native coverage data, Grey Room panorama/path controls, generic configured-workflow adapters, portable production ZIPs and a shared per-shot continuity compiler exist. Packs and compiler have local test/browser evidence; signed-in hosted media restore remains unverified. Dedicated painting, 4D/splat editors and autonomous quality/repair are unfinished. | Each chosen integration has its actual installed runtime, input/control contract, real output test, take comparison and recovery behavior. Automated judgments must be distinguished from game-reported diagnostics/manual review. | Qualify one actual GPU workflow and verify authenticated hosted pack restore; keep account-backed comic persistence in R3. |
| R6 | Production release | PRs #141, #142, #143 and #144 remain drafts; account-restore safety is another stacked candidate. Creator-studios preview is READY; production was not changed. PR #140 has its own explicit visual/runtime approval hold. | Relevant changes integrated, release gates above assessed, migrations/configuration checked, rollout/rollback plan recorded and production flows verified. | Review the concrete preview and PR dependency order. Never merge #140's separate work implicitly. |

## Current evidence

- Creator changes: https://github.com/IBFolding/haggs/pull/143 (stacked on #142).
- Hosted preview: https://haggs-cmvzx893v-howardtherekts-projects.vercel.app/comics and /shorts.
- Local candidate: 1,516 Node tests passed, 8 skipped; typecheck/build passed. Real browser, CBZ, complete synthetic Blender render and scripted Playable diagnostics described in `docs/upgrades/2026-11-11-creator-studios.md`.
- Preview pages returned HTTP 200 using authenticated Vercel access. These checks do not verify provider credentials or paid inference.
- Upstream audit/reuse: `docs/upgrades/2026-11-11-imagination-comparison.md` and `third_party/imagination-studio/provenance.json`.

- Production-pack/compiler evidence and limits: `docs/upgrades/2026-11-11-production-packs.md`. This improves R5 without completing the six release gates.

- Account restoration hardening and exact live blockers: `docs/upgrades/2026-11-12-account-restore-safety.md`. Fixture cross-device checks do not complete R1/R3.
