"""Original Haggs queue handler. No model installs/downloads or provisioning.
Requires ComfyUI on localhost and a persistent /runpod-volume plus private S3 output storage.
RunPod SDK retries re-enter this handler: the logical request claim prevents repeating inference.
"""
import base64
import hashlib
import json
import mimetypes
import os
import re
import subprocess
import time
import urllib.error
import urllib.request
import uuid
from pathlib import Path

EXTENSIONS = {'.png', '.jpg', '.jpeg', '.webp', '.mp4', '.webm', '.mp3', '.wav', '.flac'}
TERMINAL = {'FAILED', 'SUBMISSION_UNKNOWN', 'RENDERING'}


def atomic_json(path, value):
    temp = path.with_name(path.name + '.' + uuid.uuid4().hex + '.tmp')
    with open(temp, 'w', encoding='utf-8') as stream:
        json.dump(value, stream)
        stream.flush()
        os.fsync(stream.fileno())
    os.replace(temp, path)


def validate_input(value):
    if not isinstance(value, dict) or value.get('schema') != 'haggs.runpod/1':
        raise ValueError('Use the Haggs worker request contract.')
    request_id = str(uuid.UUID(value.get('requestId', '')))
    workflow = value.get('workflow')
    if not isinstance(workflow, dict) or not 1 <= len(workflow) <= 300:
        raise ValueError('Use 1–300 workflow nodes.')
    for node in workflow.values():
        if not isinstance(node, dict) or not isinstance(node.get('class_type'), str) or not isinstance(node.get('inputs'), dict):
            raise ValueError('Use a ComfyUI API workflow.')
    output = value.get('outputNode')
    if output not in workflow:
        raise ValueError('Select a valid output node.')
    seconds = value.get('executionSeconds')
    if isinstance(seconds, bool) or not isinstance(seconds, int) or not 30 <= seconds <= 1800:
        raise ValueError('Use an active timeout of 30–1800 seconds.')
    files = value.get('files', [])
    if not isinstance(files, list) or len(files) > 8:
        raise ValueError('Use at most eight media files.')
    names, size = set(), 0
    decoded = []
    for item in files:
        name = item.get('name', '')
        if not re.fullmatch(r'[A-Za-z0-9_.-]{1,150}', name) or name.startswith('.') or Path(name).suffix.lower() not in EXTENSIONS or name in names:
            raise ValueError('Use unique, plain image/video/audio filenames.')
        data = base64.b64decode(item.get('data', ''), validate=True)
        size += len(data)
        if len(data) > 6 * 1024 * 1024 or size > 10 * 1024 * 1024:
            raise ValueError('Input media exceeds the worker limits.')
        names.add(name)
        decoded.append((name, data))
    if len(json.dumps(value)) > 16 * 1024 * 1024:
        raise ValueError('Job exceeds 16 MB.')
    return request_id, workflow, output, seconds, decoded


def comfy(path, body=None):
    payload = json.dumps(body).encode() if body is not None else None
    request = urllib.request.Request('http://127.0.0.1:8188' + path, data=payload, headers={'Content-Type': 'application/json'})
    # No automatic retries: a timed-out POST may already have reached ComfyUI.
    with urllib.request.urlopen(request, timeout=20) as response:
        return json.load(response)


def storage():
    import boto3
    required = ['HAGGS_S3_BUCKET', 'HAGGS_S3_ENDPOINT', 'HAGGS_S3_ACCESS_KEY', 'HAGGS_S3_SECRET_KEY']
    if not all(os.environ.get(name) for name in required):
        raise ValueError('Configure private S3 output storage before running inference.')
    endpoint = os.environ['HAGGS_S3_ENDPOINT']
    if not endpoint.startswith('https://'):
        raise ValueError('Use HTTPS object storage.')
    return boto3.client('s3', endpoint_url=endpoint, region_name=os.environ.get('HAGGS_S3_REGION', 'us-east-1'), aws_access_key_id=os.environ['HAGGS_S3_ACCESS_KEY'], aws_secret_access_key=os.environ['HAGGS_S3_SECRET_KEY']), os.environ['HAGGS_S3_BUCKET']


def signed_result(client, bucket, artifacts):
    expiry = int(time.time() * 1000) + 24 * 3600 * 1000
    return {'schema': 'haggs.runpod-result/1', 'artifacts': [
        {'url': client.generate_presigned_url('get_object', Params={'Bucket': bucket, 'Key': a['key']}, ExpiresIn=86400),
         'kind': a['kind'], 'name': a['name'], 'bytes': a['bytes'], 'expiresAt': expiry}
        for a in artifacts]}


def verify_artifact(path, kind):
    result = subprocess.run([os.environ.get('FFPROBE_BINARY', 'ffprobe'), '-v', 'error', '-show_entries', 'stream=codec_type,width,height', '-of', 'json', str(path)], capture_output=True, timeout=30, check=True)
    streams = json.loads(result.stdout).get('streams', [])
    expected = 'audio' if kind == 'audio' else 'video'
    if not any(s.get('codec_type') == expected and (expected == 'audio' or s.get('width', 0) > 0 and s.get('height', 0) > 0) for s in streams):
        raise ValueError('The generated file has no readable media stream.')


def execute(job, *, root=None, input_root=None, output_root=None, request=comfy, s3_factory=storage, clock=time.monotonic, sleep=time.sleep):
    request_id, workflow, output_node, seconds, files = validate_input(job['input'])
    # Storage configuration is checked before any queue request.
    client, bucket = s3_factory()
    root = Path(root or os.environ.get('HAGGS_JOB_ROOT', '/runpod-volume/haggs/jobs'))
    root.mkdir(parents=True, exist_ok=True)
    directory = root / request_id
    directory.mkdir(exist_ok=True)
    record = directory / 'receipt.json'
    fingerprint = hashlib.sha256(json.dumps(job['input'], sort_keys=True, separators=(',', ':')).encode()).hexdigest()
    claim = directory / 'claimed'
    try:
        descriptor = os.open(claim, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    except FileExistsError:
        if not record.exists():
            raise ValueError('Existing request has an unresolved claim. Inspect it; inference will not repeat.')
        saved = json.loads(record.read_text())
        if saved.get('hash') != fingerprint:
            raise ValueError('Request ID was reused with different inputs.')
        if saved.get('state') == 'COMPLETED':
            return signed_result(client, bucket, saved['artifacts'])
        raise ValueError('Original request is unresolved or failed. No automatic inference retry. Inspect its receipt.')
    else:
        os.write(descriptor, fingerprint.encode())
        os.fsync(descriptor)
        os.close(descriptor)
    receipt = {'hash': fingerprint, 'requestId': request_id, 'state': 'RENDERING', 'providerJob': str(job.get('id', ''))}
    atomic_json(record, receipt)
    try:
        inputs = Path(input_root or os.environ.get('COMFY_INPUT_DIR', '/comfyui/input')) / request_id
        inputs.mkdir(parents=True, exist_ok=True)
        replacements = {}
        for name, data in files:
            (inputs / name).write_bytes(data)
            replacements[name] = request_id + '/' + name
        graph = json.loads(json.dumps(workflow))
        for node in graph.values():
            for field, value in node['inputs'].items():
                if isinstance(value, str) and value in replacements:
                    node['inputs'][field] = replacements[value]
        # Validation runs before /prompt; it doesn't execute a model.
        catalog = request('/object_info')
        for node in graph.values():
            if node['class_type'] not in catalog:
                raise ValueError('A required ComfyUI node is not installed.')
            if catalog[node['class_type']].get('api_node'):
                raise ValueError('Partner API nodes are not permitted on this worker.')
        try:
            queued = request('/prompt', {'prompt': graph, 'client_id': request_id})
        except Exception:
            receipt['state'] = 'SUBMISSION_UNKNOWN'
            atomic_json(record, receipt)
            raise ValueError('ComfyUI may have accepted the prompt. Reconcile its history; do not retry automatically.')
        prompt_id = queued.get('prompt_id')
        if not isinstance(prompt_id, str) or not re.fullmatch(r'[A-Za-z0-9_-]{3,160}', prompt_id):
            raise ValueError('ComfyUI did not return a valid prompt ID.')
        receipt['promptId'] = prompt_id
        atomic_json(record, receipt)
        deadline = clock() + seconds
        while True:
            history = request('/history/' + prompt_id)
            current = history.get(prompt_id, {})
            status = current.get('status', {})
            if status.get('status_str') == 'error':
                raise ValueError('ComfyUI reported an execution error. Inspect its logs.')
            if status.get('completed'):
                break
            if clock() >= deadline:
                raise ValueError('Worker execution deadline reached. Original ComfyUI prompt may still require reconciliation.')
            sleep(2)
        output = Path(output_root or os.environ.get('COMFY_OUTPUT_DIR', '/runpod-volume/haggs/comfy-output')).resolve()
        selected = current.get('outputs', {}).get(output_node, {})
        artifacts = []
        for name in ['images', 'videos', 'video', 'gifs', 'audio']:
            for item in selected.get(name, []):
                if not isinstance(item, dict) or item.get('type') != 'output':
                    continue
                path = (output / item.get('subfolder', '') / item.get('filename', '')).resolve()
                if not path.is_relative_to(output) or path.suffix.lower() not in EXTENSIONS or not path.is_file():
                    raise ValueError('ComfyUI output path is invalid or unavailable.')
                size = path.stat().st_size
                if not 0 < size <= 500 * 1024 * 1024 or len(artifacts) >= 20:
                    raise ValueError('Output is empty or exceeds worker artifact limits.')
                kind = 'video' if path.suffix.lower() in {'.mp4', '.webm'} else 'audio' if path.suffix.lower() in {'.mp3', '.wav', '.flac'} else 'image'
                verify_artifact(path, kind)
                key = 'haggs/' + request_id + '/' + str(len(artifacts)) + '-' + path.name
                client.upload_file(str(path), bucket, key, ExtraArgs={'ContentType': mimetypes.guess_type(path.name)[0] or 'application/octet-stream'})
                artifacts.append({'key': key, 'kind': kind, 'name': path.name, 'bytes': size})
        if not artifacts:
            raise ValueError('The workflow completed without a supported output. No success was recorded.')
        receipt.update(state='COMPLETED', artifacts=artifacts)
        atomic_json(record, receipt)
        return signed_result(client, bucket, artifacts)
    except Exception:
        if receipt['state'] != 'SUBMISSION_UNKNOWN':
            receipt['state'] = 'FAILED'
        atomic_json(record, receipt)
        raise


def handler(job):
    try:
        return execute(job)
    except Exception:
        # Never echo arbitrary node errors, file contents, prompts or storage credentials into API logs.
        raise RuntimeError('Haggs worker did not complete. Inspect the private request receipt and ComfyUI logs. No automatic inference retry.') from None


if __name__ == '__main__':
    import runpod
    runpod.serverless.start({'handler': handler})
