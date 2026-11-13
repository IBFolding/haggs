# Supply a reviewed CUDA/PyTorch image by digest. No floating GPU image is silently selected.
ARG GPU_BASE_IMAGE
FROM ${GPU_BASE_IMAGE}
ARG COMFY_COMMIT
ENV COMFY_COMMIT=${COMFY_COMMIT}
USER root
RUN test -n "$COMFY_COMMIT" && echo "$COMFY_COMMIT" | grep -Eq '^[0-9a-f]{40}$'
RUN apt-get update && apt-get install -y --no-install-recommends git ffmpeg ca-certificates && rm -rf /var/lib/apt/lists/*
RUN git init /comfyui && cd /comfyui && git remote add origin https://github.com/Comfy-Org/ComfyUI.git && git fetch --depth 1 origin "$COMFY_COMMIT" && git checkout --detach FETCH_HEAD
# The supplied GPU image owns torch/CUDA. Resolve and lock this environment during qualification.
RUN python -m pip install --no-cache-dir -r /comfyui/requirements.txt
COPY requirements.txt /opt/haggs/requirements.txt
RUN python -m pip install --no-cache-dir -r /opt/haggs/requirements.txt
COPY handler.py start.sh /opt/haggs/
RUN chmod 755 /opt/haggs/start.sh
# Add custom nodes at pinned commits and their reviewed dependency locks in a derived image.
CMD ["/opt/haggs/start.sh"]
