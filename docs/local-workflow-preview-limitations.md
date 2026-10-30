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

The two Action Guide mappings now have a draft service connection to the existing journaled submit/recover interface, tested with in-memory fake dependencies. It is not mounted in a browser route, has no polling implementation of its own, and the test output is a string, not a media artifact. Mode identity is now bound through a dedicated journal interface and tested with disposable SQLite; a production journal implementation and migration do not yet exist. This service must not be enabled until real storage, provider behavior and customer authentication are validated.
