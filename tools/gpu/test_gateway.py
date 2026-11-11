import http.client
import json
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from gateway import gateway_handler

TOKEN = 'fixture-only-not-a-real-token'

class GatewayTest(unittest.TestCase):
    def test_protected_transport_and_no_credential_forwarding(self):
        calls = []
        class Comfy(BaseHTTPRequestHandler):
            def log_message(self, *_): pass
            def do_GET(self):
                calls.append((self.path, self.headers.get('Authorization')))
                data = json.dumps({'devices': [{'name': 'Fixture GPU'}]}).encode()
                self.send_response(200); self.end_headers(); self.wfile.write(data)
        upstream = ThreadingHTTPServer(('127.0.0.1', 0), Comfy)
        gateway = ThreadingHTTPServer(('127.0.0.1', 0), gateway_handler(TOKEN, upstream.server_port))
        for server in (upstream, gateway):
            threading.Thread(target=server.serve_forever, daemon=True).start()
            self.addCleanup(server.server_close); self.addCleanup(server.shutdown)
        def get(path, token=None):
            connection = http.client.HTTPConnection('127.0.0.1', gateway.server_port)
            headers = {'Authorization': 'Bearer ' + token} if token else {}
            connection.request('GET', path, headers=headers)
            response = connection.getresponse(); result = response.status, response.read(); connection.close(); return result
        self.assertEqual(get('/system_stats')[0], 401)
        self.assertEqual(get('/system_stats', 'wrong')[0], 401)
        self.assertEqual(calls, [])
        self.assertEqual(get('/system_stats', TOKEN)[0], 200)
        self.assertEqual(calls, [('/system_stats', None)])
        for path in ('/manager/install', '/queue', '//evil.example/system_stats', '/system_stats?secret=anything'):
            self.assertEqual(get(path, TOKEN)[0], 403)
        self.assertEqual(len(calls), 1)

if __name__ == '__main__': unittest.main()
