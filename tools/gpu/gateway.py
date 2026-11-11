#!/usr/bin/env python3
"""Bearer-protected ComfyUI gateway. Run on YOUR GPU, not on the Haggs host.
Only proxies the API routes used by Haggs; never installs models or rents GPUs.
Keep ComfyUI bound to 127.0.0.1:8188; expose only this gateway through HTTPS.
"""
import hmac
import http.client
import os
import re
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit

MAX_UPLOAD = 50 * 1024 * 1024
MAX_RESULT = 100 * 1024 * 1024


def allowed(method, target):
    url = urlsplit(target)
    if url.scheme or url.netloc or url.fragment:
        return False
    if method == 'GET':
        return bool(re.fullmatch(r'/(system_stats|object_info|history/[A-Za-z0-9_-]+|view)', url.path)) and (not url.query or url.path == '/view')
    return method == 'POST' and url.path in ('/prompt', '/upload/image') and not url.query


def gateway_handler(token, upstream_port=8188):
    class Handler(BaseHTTPRequestHandler):
        timeout = 120

        def log_message(self, *_args):
            pass  # Never log headers, tokens, prompts or filenames.

        def do_GET(self):
            self.proxy()

        def do_POST(self):
            self.proxy()

        def proxy(self):
            self.close_connection = True
            if not hmac.compare_digest(self.headers.get('Authorization', '').encode(), ('Bearer ' + token).encode()):
                self.send_error(401, 'Bearer authentication required')
                return
            if not allowed(self.command, self.path):
                self.send_error(403, 'Route not allowed')
                return
            try:
                length = int(self.headers.get('Content-Length', '0'))
            except ValueError:
                self.send_error(400)
                return
            if self.headers.get('Transfer-Encoding') or length < 0 or length > MAX_UPLOAD:
                self.send_error(413)
                return
            body = self.rfile.read(length) if length else None
            if body is not None and len(body) != length:
                self.send_error(400)
                return
            connection = http.client.HTTPConnection('127.0.0.1', upstream_port, timeout=120)
            try:
                headers = {}
                if body is not None:
                    headers['Content-Type'] = self.headers.get('Content-Type', 'application/octet-stream')
                # No gateway token, cookies or provider credentials reach ComfyUI.
                connection.request(self.command, self.path, body=body, headers=headers)
                response = connection.getresponse()
                data = response.read(MAX_RESULT + 1)
                if len(data) > MAX_RESULT or 300 <= response.status < 400:
                    self.send_error(502, 'Invalid upstream response')
                    return
                self.send_response(response.status)
                self.send_header('Content-Type', response.getheader('Content-Type', 'application/octet-stream'))
                self.send_header('Content-Length', str(len(data)))
                self.send_header('Cache-Control', 'no-store')
                self.end_headers()
                self.wfile.write(data)
            except (OSError, http.client.HTTPException):
                self.send_error(502, 'ComfyUI unavailable; no retry made')
            finally:
                connection.close()
    return Handler


if __name__ == '__main__':
    secret = os.environ.get('HAGGS_GPU_GATEWAY_TOKEN', '')
    if not 16 <= len(secret) <= 1024 or any(ord(c) < 33 or ord(c) > 126 for c in secret):
        raise SystemExit('Set HAGGS_GPU_GATEWAY_TOKEN to a strong 16–1024 character bearer token locally.')
    port = int(os.environ.get('HAGGS_GPU_GATEWAY_PORT', '8189'))
    server = ThreadingHTTPServer(('0.0.0.0', port), gateway_handler(secret))
    server.daemon_threads = True
    print('Haggs GPU gateway ready. Expose this port through HTTPS; keep ComfyUI private. Stop the rental separately when finished.')
    server.serve_forever()
