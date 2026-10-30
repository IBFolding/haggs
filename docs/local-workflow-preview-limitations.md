# Local workflow preview: production prerequisites

The `/studio-fixture`, `/studio-room-fixture`, and `/game-director-fixture` pages and their fixture endpoints are local development tools, not customer features. They are disabled in production. They use disposable local data and do not authenticate a Haggs user or connect to their Comfy deployment.

Before exposing a reuse-take compositor to customers:

- Bind inputs, outputs and every recovery request to an authenticated user, job and deployment. Store results in owner-scoped storage; do not rely on an unguessable URL as authorization.
- Run untrusted media parsing and FFmpeg in a separately isolated worker with strict CPU, memory, time, filesystem and network limits. The local-only process and signature/ffprobe checks are not a production sandbox.
- Define and enforce supported formats, upload size, durations, dimensions, frame rates and audio synchronization; display them before upload. Test corrupt, oversized, variable-rate and mismatched media. The local fixture accepts MP4 and optional WAV under 2 MB, and composes only the first second at 128×96/24 fps.
- Test durable per-artifact storage, quotas and recovery after interruption using a disposable backend before applying any migrations; never re-submit an uncertain paid job automatically.
- Verify the user's actual Comfy deployment has the correct nodes and models, and clearly show provider billing. A successful key check does not establish capability.
- Verify output decoding and signed URL renewal, retain only trusted owned output locations, and run cross-user and deployment-switch tests against the real integration.

The local proxy room uses the bundled deterministic simulation and stores fixture data in a separate browser IndexedDB database. Its WebM recording is a browser capture, not the Comfy node's five-second recording contract. Eden registration and neural replay are not implemented here and require their own configured backend and verification.

## Room graph and user-owned deployment gaps

The draft `prepareOwnedRoom` maps the existing `HaggsPlayableWorld` node's character, theme, prompt and optional reference image. It does not add geometry controls: the shipped node accepts no editable geometry input. The node returns a worker-local session ID and an interactive `/haggs-studio/session/...` page, not a portable v2 output asset. The five-second recording is submitted back to that same session and workflow 09 reads its worker-local file. A managed job may run on another worker, so neither the session nor that recording is durable or account-isolated by this mapping.

Before enabling the real user-owned path:

1. Establish a secure, user- and deployment-bound interactive session transport and a persistent recording contract that works across workers. Verify its lifecycle and access controls with the actual Comfy deployment.
2. Upload reference media through the owner/deployment-bound journal and validate isolated decoding. Do not trust client-provided asset IDs.
3. Complete per-artifact persistence and recovery against a disposable Supabase and Blob environment, including quota races, partial failures, cross-user isolation and expiring provider URLs.
4. Build authenticated customer controls and explicit provider cost disclosures, then verify actual node and model compatibility. The current H3 and Eden execution gates remain closed.
5. Test the end-to-end deployment with a user-authorized connection and bounded test costs; do not treat the loopback fake or browser proxy room as a Comfy or Eden run.

The draft room-session transport and SQL store are not wired to a route or object store. The prototype assumes the caller supplies a verified owner and deployment, an isolated media validator, and a private shared object store that enforces one-time writes and verifies exact bytes. Its `rooms/...` objects are not integrated with Haggs's storage quota or deletion/account lifecycle. Expiration blocks access but does not itself delete orphaned objects; a safe cleanup process and retention policy are still required. The original Comfy worker session and room widget have not been connected to this prototype. Do not apply its migration or enable it until those gaps, concurrent behavior and privacy are verified in a disposable deployment.

A draft injectable private-object/quota boundary and fail-closed isolated-validator interface now exist for room recordings. They have only fake-service tests: no private Blob implementation, atomic quota ledger, isolation worker, cleanup lease implementation, or production configuration is connected. A quota implementation must make reserve/commit atomic, owner-bound and idempotent; cleanup must hold an exclusive expired-session lease and use conditional deletion. An uncertain deletion must retain its reservation for reconciliation. The native Comfy `create_session` contract has been checked locally without PyAV; its recording endpoint and cross-worker session bridge remain unverified.

The `scripts/local-room` SQLite backend is solely a disposable local integration test. It exercises quota reservations, private recording bytes, lost-response recovery and conditional cleanup through two database connections. A separate restart test persists session metadata and reopens the database through new connections; this is not a multi-process end-to-end test or a production storage implementation. The disposable SQLite backend can reconcile a claimed cleanup before or after deletion in a single database transaction; mismatched bytes remain reserved as uncertain. This atomic local operation does not establish safe cleanup for an external object store or provider. SQLite's Node API is experimental. No Supabase service or real media sandbox is involved.

## Remaining work checklist

**Can be done locally without model weights or production services:**
- Convert each Game Director editor graph to a validated Comfy API prompt, map its actual widget inputs and asset links, and connect all declared outputs to the multi-artifact journal. The current `GAME_DIRECTOR_PREVIEW_OUTPUTS` is an inventory, not a graph converter.
- Connect World/Motion graph inputs and outputs to the same authenticated job and recovery contracts. The room graph mapping alone is not an interactive session bridge.
- Build a production-appropriate isolated media-validation and transcode worker, bounded upload contracts and a shared object-store cleanup/reconciliation implementation. The disposable SQLite backend cannot establish external deletion outcomes.
- Complete customer setup, secure secret lifecycle, consent and per-deployment capability checks, and connect the supported apps to the real routes. Review actual provider API contracts before enabling any mode.

**Needs dependencies or external validation:**
- PyTorch and PyAV, plus a compatible Comfy installation and the node packs, are required to execute the native preview nodes and test the native room recording endpoint. They have not been installed or exercised here.
- Model-dependent H3, LTX, HY-Motion, SAM2 and Eden modes additionally require their correct models/services and verified licenses and resources. Their local fixture previews do not demonstrate inference.
- A disposable Supabase-compatible environment and private storage are needed to validate the SQL migrations, real authentication, quota races, owner isolation and object recovery together; no production migration has been applied.
- A user-owned compatible Comfy deployment and an explicitly bounded test budget are needed to verify deployment capabilities, user billing, actual jobs, all output types and recovery. Keep customer execution disabled until these checks pass.

`prepareOwnedGameAction` maps the bundled Drag to Action and Boss Fight no-model graph nodes and checks basic input bounds and actor count. It is not connected to submission or artifact recovery; timeline details and actual runtime compatibility still require validation. It returns an explicit unverified status and does not enable execution.

The two Action Guide mappings now have a draft service connection to the existing journaled submit/recover interface, tested with in-memory fake dependencies. A local-only browser fixture now mounts this service with polling and a prepared MP4. It remains a synthetic test and does not exercise a real customer route. Mode identity is now bound through a dedicated journal interface and tested with disposable SQLite; a production journal implementation and migration do not yet exist. This service must not be enabled until real storage, provider behavior and customer authentication are validated.

The local-only `/action-job-fixture` screen exercises both action-mode graph mappings, a simulated queued/running/saved status flow, SQLite video persistence, playback, and sessionStorage reload recovery. It now calls the draft mode-bound job service, short status service and artifact saver through disposable SQLite and a loopback fake HTTP provider. It uses a fixed fake identity, fixed sample inputs and a prepared synthetic MP4, not a real provider or real customer authentication. It is disabled in production and cannot demonstrate an actual Comfy render or cross-user isolation.

Draft mappings also exist for Moveset Atlas and three-branch Scene Forge. Scene Forge expects owner/deployment-verified upload references, not client-selected asset IDs. Neither mapping is connected to the customer route or verified against a running Comfy deployment; the existing bundle fixture tests prepared artifacts, not these submitted graphs.

Draft Reskin and Enemy Intent graph mappings now validate their controls; a server-side media preparation helper resolves Reskin and Scene Forge inputs through the owner-, job-, deployment- and expiry-bound upload journal. All four bundle mappings remain unverified on a real Comfy runtime.

A draft `ownedGameBundleExecution` connects the four remaining mappings to a mode-bound job journal and existing bundle recovery, resolving video inputs through the owner/deployment upload journal. Its test uses in-memory fakes and prepared files. It is mounted only in a local fixture route; a real caller must supply durable owner-scoped artifact storage and isolated full media decoding; Reskin currently checks only the MP4 signature, size and unambiguous output descriptor. No real provider execution has been verified.

The four-mode `/game-bundle-fixture` now calls the draft mode-bound submission and recovery service with a loopback fake provider and disposable SQLite/file storage. Browser checks submitted, checked status, recovered, and re-recovered all four modes after reload. Both atlas modes receive the same prepared synthetic sample; video upload records and identity are fixtures, so this does not verify real media uploads, customer authentication, actual model execution, or production storage. Reload requires selecting the mode and pressing Recover outputs.

Draft mappings now cover the VFX placement-mask preview and reuse-existing-take graphs. They resolve required video references from the owner/deployment-bound upload journal and reject unsupported tracking masks. They are not yet wired to submission, browser UI or durable recovery; placement preview needs two independently saved video outputs. Actual Comfy and media compatibility remain unverified.

A draft mode-bound VFX submission/recovery service now selects and verifies each expected MP4 signature before passing both placement-preview outputs or the reuse output to injected storage. The local-only bundle fixture now exercises both modes with disposable SQLite/files and a loopback fake provider. The draft artifact SQL accepts the two VFX video roles and was tested in a disposable local PostgreSQL database; no production migration has been applied. Full media decoding remains required.

Draft graph mappings for saved-motion preview and recorded-room preview are explicitly unavailable. The NPZ node reads a filename from Comfy's local input directory, not a documented `core/ASSET` input; a trusted owner-bound staging service and sandboxed NPZ validation are still needed. The room node reads a native session's worker-local recording; its cross-worker, owner-bound bridge is not implemented. Both require compatible Comfy and dependencies for real execution, and neither mapping is connected to submission or browser recovery.
