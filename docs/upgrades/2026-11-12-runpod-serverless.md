# RunPod Serverless adapter — review candidate

The `/runpod` workspace adds an independent queue adapter for a user's RunPod account. It imports ComfyUI API JSON, accepts input media and tracks the original request through status, cancellation and manual reconciliation. Existing closed-model generation buttons do not route to it; results are downloadable, not automatically attached as editor takes.

Credentials stay in an encrypted account-bound HttpOnly cookie. Production claims are reserved in account-scoped Supabase storage before a queue submission; an ambiguous acknowledgment never triggers an automatic replacement. The original worker separately records logical request IDs, validates media with FFprobe and uploads outputs to private object storage before returning success.

## Verified locally

- TypeScript check and production Next build.
- Node suite: 1,535 tests; 1,527 passed, eight skipped, zero failed.
- Five Python worker contract tests passed, with fixture ComfyUI/S3 and a real MP4 checked by FFprobe.
- Browser checks: host execution gate remains disabled even after consent; invalid endpoint IDs are rejected; the API key input clears; no invalid connection cookie is saved; the guide loads; no document overflow at 390px.
- No real RunPod API requests or paid work were performed.

## Remaining release gates

- Resolve a reviewed GPU image digest, ComfyUI/custom-node/model pins and a Linux dependency lock for one representative workflow.
- Build and qualify that image. Docker is unavailable on this development host; no GPU/container execution was verified.
- Approve actual account pricing and storage/compute budget before creating any resources. The proposed 0 active / 1 maximum worker, 48GB-or-greater GPU and 200GB volume are a draft, not a deployed configuration or dollar cap.
- Provision private storage and the endpoint, apply the new Supabase migration and configure the encryption key. These have not been done.
- Enable execution only for an approved proof, then verify real generation, storage/download, recovery, cancellation and scale-down. Persistent storage remains billed while compute is idle.

Implementation and deployment contract: [worker README](../../tools/runpod/README.md). Do not merge or deploy as a qualified RunPod integration from unit tests or a green build alone.
