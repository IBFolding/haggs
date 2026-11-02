# Imported take scene preservation

Manual AI take proposals and saved workflow results share `applyTakes`. Previously that function assigned `shot.render` directly. A shot with a trimmed source and edited Grey scene therefore kept those old inputs on newly imported footage, while the outgoing take did not remember the latest edits. Switching back could lose the old scene.

Imported takes now go through the editor's existing `chooseTake` transition. That remembers the outgoing scene and trim, selects new footage at time zero with no inherited scene, and preserves the immutable `greySetup` input snapshot. Blockout, approval and other shot metadata keep their existing behavior. `use: false` remains a shelf-only operation; duplicate files remain idempotent. Board and original-project data remain unchanged.

The reproduction tests fail before the fix and pass after it. Coverage includes selected imports, shelf-only imports, multiple imports in one batch, JSON save/reopen, restoring original scene/trim, preserving generated-input snapshots, and saving a workflow result onto an existing shot. No provider or remote store is used.

This is a local follow-up to released main f4390a8. No rollout settings, paid APIs, migrations or UI layout changed. Original enhancement and reconciliation branches remain preserved; Claude's grey-room-on-main branch is still 386f60e and already represented in the released increment. Unrelated changes in the user's original checkout were left untouched.

Verification: 25 focused tests pass (`output/import-focused.log`), TypeScript passes (`output/import-typecheck.log`), and all 1,312 tests pass with concurrency two (`output/import-all-tests.log`). The two reproduction regressions failed before the implementation change (`output/import-before.log`). `git diff --check` passes. A fresh production build and desktop/mobile release verification have not been run for this follow-up; it remains local for review. No claim is made that the previous release's browser checks cover this changed import transition.
