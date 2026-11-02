# Private media candidate — not deployed

The current main branch saves ordinary browser uploads, generated output, local-to-account library copies, rendered films, Grey Room renders and sprite sheets into public Vercel Blob storage. Filenames have random components. Explore inserts a public post containing a media URL only after an explicit share. These are distinct boundaries: removing the post removes discovery through Explore; it does not revoke a public storage URL. This is source-verified. No existing customer's unshared object was fetched, and an unauthenticated synthetic public-object read is still pending a permitted test upload.

This candidate uses a separate private Blob store for new media when `HAGGS_PRIVATE_MEDIA_WRITES=1` and the separately approved `HAGGS_PRIVATE_BLOB_READ_WRITE_TOKEN` is configured. It never changes existing store permissions or deletes/moves originals. The credential alone enables reads; without write activation, current legacy write behavior remains; do not claim private-by-default production until rollout is complete. No token has been created/configured by this task.

Private media is saved as a stable `/api/media/haggs/u-<owner>/...` reference. Each read authenticates the owner or checks an exact current public Explore post whose owner matches the path. The proxy streams media with private/no-store caching, forwards video ranges, and does not expose storage authorization or signed URLs. Removing the post revokes subsequent anonymous reads. Downloaded copies cannot be recalled. New uploads, server-generated results, account listing/deletion, quota snapshots/reconciliation and render input staging use the same reference. Legacy public files remain readable and counted.

The existing Explore share action is the publication consent point; an Unshare control is added, including discovery of previously shared state. `private-media-sharing-migration.sql` is a **draft for review/test only** allowing owner-bound private references in posts. It has not been applied anywhere. The Vercel private backend is not equivalent to the separate Supabase owned-runtime output adapter; do not infer one backend's acceptance from the other's tests.

## Isolated project coordination

- Supabase project: `haggs-safety-test`, ref `bhscymqhodllcmreblgx`.
- Existing test bucket from the workflow task: `haggs-synthetic-private` (private).
- Workflow task's SQL owner-isolation and job-journal experiments were transactionally rolled back. Their synthetic UUIDs were `11111111-1111-4111-8111-111111111111` and `22222222-2222-4222-8222-222222222222`, not authenticated customer sessions.
- Actual synthetic upload is blocked on the browser upload capability; app-adapter testing additionally needs authorized test-user/session setup. No passwords, service keys or tokens are included here.
- This task has applied no migration and has not operated the other task's active dashboard tab. Coordinate any test application of the draft with that task to avoid overlap.

## Required before release

1. Provision/approve a separate private Blob store and its server credential using the normal approved credential flow. Never reclassify the old public store or remove its token: old project references and quota accounting depend on it.
2. Test the draft post-URL constraint in the isolated Supabase project with two synthetic authenticated accounts. Verify an attacker cannot publish another owner's private path; owner can publish and unshare; unauthenticated read changes from denial to success and back.
3. Exercise a real private synthetic upload and raw-storage anonymous denial, browser playback/seeking, render, save/reopen, provider input upload, quotas and account deletion. Local fake-store tests are not this acceptance test.
4. Reconcile old public objects with saved browser-only projects before migrating them. Copying an object without disabling/removing the old public object does not revoke its old URL. Removal cannot be done until all references and preservation/recovery requirements are established and approved.
5. Test shared embeds in Playable and local cross-device use. Relative private media URLs rely on a signed-in same-origin app session; exported stand-alone documents need an explicit download/publication mechanism.

The test suite verifies authorization decisions, range streaming, storage-header stripping, share/revoke behavior, path rejection and synthetic server render staging. It does not establish live store policy, production privacy, a complete historical migration or real model execution.

## Additional unresolved recovery boundary

`keepShots` retains a provider's temporary output URL if durable storage fails, to avoid losing a paid result. That external provider URL may itself be a bearer URL. This candidate has not changed that fallback or claimed it is private. A complete privacy release must preserve recoverable provider job/output metadata while withholding an unprotected result from being presented as privately stored. Do not solve this by discarding a paid output or retrying an uncertain paid job.

Review follow-up: see `private-media-compatibility.md` for reader-first rollout, stable in-flight upload callbacks, verified-copy planning, rollback and remaining consumer gates.
