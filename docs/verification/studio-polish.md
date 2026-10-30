# Studio polish verification

Branch: `studio-polish`. Local preview: http://127.0.0.1:3140/library.

## Release coordination

Keep the merge hold. No push, merge or deployment was performed.

This work follows Ads commit `0b59f92`. Baseline commit `d371793` only snapshots the newer Recreate, Swap and globals already present in the combined integration checkout. **Do not cherry-pick that baseline into integration.** Apply only the subsequent polish commit, after the Ads change as appropriate. The polish diff does not modify globals or provider execution.

## Changes

- Projects: existing work first; name search; actual saved shot/media counts; stage and next-step links across multiple boards; six selectable starting points preserving original creation actions. Honest setup/sample copy.
- Gallery: real collection counts and filter summary, reset filters, native modal media preview with existing actions. Escape restores focus; Save to project closes the preview before opening its picker. Unknown costs remain excluded and explicitly labeled.
- Swap: setup steps, review of prompt/quality/duration, source preview and guidance. Successful output offers original/result comparison using the source captured when that run started. Provider selection and generation calls unchanged.
- Recreate: planned shot count, total target duration and next-step summary on the existing integration review UI. Responsive wording.
- Series: workflow stages, episode anchors and actual per-episode picture/clip/voice counts, failure guidance, clearer Save & open editor action, restart confirmation and disabled reset/save while making.
- Scoped CSS module; no proprietary assets copied or new generated samples added.

## Checks

- 67 targeted tests passed: project progress, project storage/boards, save-run, gallery filters/groups/search/run, handoffs, and all Series specs. Six new tests cover actual media counts, legacy and multiple boards, next action, empty drafts and stale Series result keys.
- TypeScript check passed before production build.
- Production build: final result recorded below. The first build found stale dev-generated types for a temporary QA fixture route after that route was removed; cleared only that generated route and reran.
- `git diff --check` passed.
- Browser: desktop and 390 × 844 mobile; no document horizontal overflow on touched routes. Screenshots in `studio-polish/`.
- Projects: populated and no-match searches, clear search, switching starting points. Saved two-episode Series project correctly shows three shots and zero fabricated media.
- Gallery: real image/video fixture counts, image preview, Escape dismissal with focus restored, preview-to-project-picker transition.
- Swap: expanded submission review, no-input disabled action, honest connect-provider state. Paid output comparison was code-reviewed but not executed against a provider.
- Recreate: Product reveal preset shows four shots / 6.5 seconds; changing first duration to three seconds updates total to eight seconds; Create shot board creates and opens the four-shot board.
- Series: applied a clearly labeled two-episode local bridge fixture, verified 0/2 and 0/1 pictures/clips and 0/1 voice lines per episode; Save & open editor saved both boards. Cut route correctly says nothing to cut without rendered media.

## Scope and limitations

No paid generation, external posting or credentials. Fixtures use existing public sample assets with explicit QA labels; they are not evidence of successful provider output. Temporary `/qa-polish` fixture page removed before build and commit. Isolated preview browser storage retains the labeled fixtures for review.

This is UI polish, not completion of the separately tracked moderation/workflow-series test or reconciliation of the campaign video's uncertain charge. It does not add Series reload persistence or change provider retry/error semantics. Successful paid Swap/Series render and billing remain outside this verification.

Final production build: **passed**, exit 0. Next compiled successfully, completed TypeScript and generated the application routes. Build-only changes to `tsconfig.json` and `next-env.d.ts` were reverted. The generated `.next-polish-build/` directory is untracked and is not part of the release.
