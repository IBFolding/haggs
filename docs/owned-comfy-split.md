# Owned Comfy connection: review split

Source inventory: `feat/owned-comfy-connection` at `cb5f3a8f077732168e936f78c26f6a8686ea9e40` (81 commits ahead of the reviewed `main`; 148 changed files and six draft migrations). Do not merge that branch wholesale.

## 1. Read-only connection check (this branch)

Only the exact-origin validator, one read-only Comfy API request, its authenticated setup endpoint, and the disabled-by-default setup page:

- `src/server/comfy-owned-connection.ts` and its tests
- `src/app/api/owned-comfy/check/route.ts` and its tests
- `src/app/workflows/own-comfy/page.tsx` and `setup.tsx`

`HAGGS_OWN_COMFY_SETUP_PREVIEW` must be explicitly set to `1` to expose either the page or endpoint. Production defaults to a 404 page and a 503 endpoint. The check accepts only an HTTPS `<deployment>.run.comfy.app` origin, does not follow redirects, and does not submit a workflow. No credential is intentionally persisted.

This branch deliberately excludes uploads, execution, journals, fixture routes, managed billing, migrations, and customer generation.

## 2. Private input upload

Review `owned-input-upload.ts`, `owned-upload-request.ts`, their tests, and the upload route only after the storage contract is explicit: authentication, ownership, size/type limits, private object paths, retention, deletion, and abuse controls. Local fixture upload routes are not production evidence.

## 3. Durable execution and recovery

Review `owned-comfy-execution.ts`, storage/reuse modules, job/input/artifact journals, status routes, and recovery behavior together. Require idempotent submission, spend and billing boundaries, restart recovery, and real hosted-infrastructure verification before enabling customer runs. The six SQL migrations stay unapplied until separately authorized and reviewed.

## 4. Product mappings

Game Director and Studio mappings depend on the storage and recovery contracts above. Review their workflow validation and output contracts separately from local fixture pages and fake providers. A fixture demonstrating a UI is not evidence of a working customer generation path.

## 5. Managed/H3 execution

PR #65 and the managed runtime remain separate and fail-closed. Do not enable managed or H3 customer generation from this connection-check workstream. Real deployment testing requires an explicit paid-test budget, verified provider limits, and signed-in end-to-end acceptance testing.

## Release gates

Before any customer execution: authorized migrations, hosted Supabase/private Blob verification, secure runtime authentication, upload validation/sandboxing, durable job/output recovery, billing reconciliation, spend limits, and a bounded real-deployment test. Until then, generation remains disabled.
