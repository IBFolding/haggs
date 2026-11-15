#!/usr/bin/env bash
set -euo pipefail
: "${COMFY_COMMIT:?Set the reviewed, pinned ComfyUI commit at image build time}"
if [[ ! -d /runpod-volume ]]; then
  printf '%s\n' 'A persistent volume is required for model files and duplicate-submission receipts.' >&2
  exit 1
fi
mkdir -p /runpod-volume/haggs/comfy-output /runpod-volume/haggs/jobs /runpod-volume/models
export COMFY_INPUT_DIR=/comfyui/input
export COMFY_OUTPUT_DIR=/runpod-volume/haggs/comfy-output
export HAGGS_JOB_ROOT=/runpod-volume/haggs/jobs
cat >/comfyui/extra_model_paths.yaml <<'YAML'
haggs_volume:
  base_path: /runpod-volume/models
  checkpoints: checkpoints
  diffusion_models: diffusion_models
  text_encoders: text_encoders
  clip: clip
  vae: vae
  loras: loras
YAML
python /comfyui/main.py --listen 127.0.0.1 --port 8188 --disable-auto-launch --output-directory "$COMFY_OUTPUT_DIR" --extra-model-paths-config /comfyui/extra_model_paths.yaml &
COMFY_PROCESS=$!
trap 'kill "$COMFY_PROCESS" 2>/dev/null || true' EXIT TERM INT
python - <<'PY'
import time, urllib.request
for attempt in range(120):
    try:
        with urllib.request.urlopen('http://127.0.0.1:8188/system_stats', timeout=2):
            break
    except Exception:
        time.sleep(2)
else:
    raise SystemExit('ComfyUI did not become ready; no job handler started.')
PY
python /opt/haggs/handler.py
