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
