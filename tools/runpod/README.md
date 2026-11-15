# Haggs RunPod Serverless worker — candidate, not deployed

This original handler implements `haggs.runpod/1` requests and `haggs.runpod-result/1` responses. It is **not** the upstream `runpod-workers/worker-comfyui` handler and does not accept that worker's output contract. No upstream AGPL implementation source or weights are copied here.

The initial endpoint is proposed as queue-based, active workers 0, max workers 1, one GPU, idle timeout 10 seconds, and a 200 GB persistent volume. These settings are not provisioned or verified in a live account. See `endpoint-plan.json`.

## Build inputs still required

- A reviewed CUDA/PyTorch base image **by immutable digest** (Docker build arg `GPU_BASE_IMAGE`).
- A reviewed 40-character ComfyUI commit (`COMFY_COMMIT`).
- Pinned custom-node commits, model files/hashes and their licences, matching the first target workflow.
- A fully resolved Python environment lock for that exact Linux/CUDA/PyTorch image. The requirement ranges here are candidates, not a production lock.
- Private S3-compatible output storage and a persistent `/runpod-volume`.

A Docker engine is not available in the current development environment. Container build, GPU execution, storage integration and provider retry/scale-down behavior have not been tested. Do not deploy this Dockerfile as a qualified image.

Once a Docker engine and the pinned build choices are available:

```sh
docker build --build-arg GPU_BASE_IMAGE='reviewed-image@sha256:reviewed-digest' --build-arg COMFY_COMMIT='reviewed-40-character-commit' -t haggs-runpod:candidate tools/runpod
```

The placeholders are intentional. Choose and verify actual pins; do not substitute a floating `latest` image.

## Worker configuration

Set these **privately** in RunPod secret/environment settings:

- `HAGGS_S3_ENDPOINT` (HTTPS)
- `HAGGS_S3_BUCKET`
- `HAGGS_S3_ACCESS_KEY`
- `HAGGS_S3_SECRET_KEY`
- `HAGGS_S3_REGION` (optional; default `us-east-1`)

Models are read from `/runpod-volume/models`. Custom nodes belong in the built image. Outputs and logical-request receipts use the persistent volume. Completed media is verified with FFprobe, uploaded to the private object store and returned as a time-limited signed URL. Preserve the object store independently of the worker. Model download size does not establish peak inference VRAM.

## Submission/recovery behavior

The Haggs host persists an intent before making `/run`. A network timeout or ambiguous response is held for reconciliation rather than resent. The worker separately claims the logical request ID on persistent storage before queueing ComfyUI. Provider re-entry returns cached artifacts for a completed request and refuses to repeat an unresolved/failed inference. A failed worker therefore may require manual reconciliation rather than automatic recovery. This is an at-most-once inference policy for a given surviving claim, not a guarantee that provider startup/idle time is billed once.

A private output key is never put in a browser request. A RunPod API key is held server-side in an encrypted, account-bound HttpOnly cookie. Workflow JSON and input media do travel to the user's selected endpoint. Review imported workflows and installed custom nodes before executing them.

## Host activation

1. Apply `supabase/migrations/20261112000000_runpod_jobs.sql` in the production Supabase project. This requires deliberate deployment; it has not been applied here.
2. Configure `HAGGS_GPU_CONNECTION_SECRET` server-side.
3. Configure and verify the private worker/storage endpoint with an approved cost budget.
4. Enable `HAGGS_RUNPOD_EXECUTION_ENABLED=1` only for the approved proof. It is off by default.
5. Use `/runpod`, import ComfyUI **API** JSON, attach matching media filenames and select a supported output node.
6. Verify upload → queue → actual generation → storage → download, reconnect/status recovery, cancellation and actual scale-down before general release.

A health check reads `/health`; it does not start a diagnostic job or establish that the worker image, models, min/max settings, or output storage work. The first adapter is a dedicated workflow workspace; existing closed-model image/video buttons do not yet route to RunPod.

## Local contract tests (no RunPod charges)

```sh
node --import tsx --test src/runpod/*.spec.ts src/server/runpod-connection.spec.ts
python3 tools/runpod/test_handler.py
bash -n tools/runpod/start.sh
```

The Python tests simulate ComfyUI and object storage, but use a real video file and real FFprobe for output validation. They do not establish CUDA/model compatibility, live storage operation, exact spending bounds, or scale-to-zero.

Primary references: [queue API](https://docs.runpod.io/serverless/endpoints/send-requests), [worker settings](https://docs.runpod.io/serverless/endpoints/endpoint-configurations), [billing](https://docs.runpod.io/serverless/pricing), [network volumes](https://docs.runpod.io/storage/network-volumes).
