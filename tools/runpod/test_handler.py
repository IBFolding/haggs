import base64
import json
import shutil
import tempfile
import unittest
import uuid
from pathlib import Path
from handler import execute, handler, validate_input

class Storage:
    def __init__(self): self.uploaded = []
    def upload_file(self, path, bucket, key, ExtraArgs): self.uploaded.append((key, Path(path).read_bytes()))
    def generate_presigned_url(self, operation, Params, ExpiresIn): return 'https://fixture.example.test/' + Params['Key'] + '?signed=fixture'

class WorkerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(); self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name); self.output = self.root / 'output'; self.output.mkdir()
        fixture = Path(__file__).resolve().parents[2] / 'public/samples/clip-city.mp4'
        shutil.copyfile(fixture, self.output / 'take.mp4')
        self.storage = Storage(); self.calls = []
        self.payload = {'schema':'haggs.runpod/1', 'requestId':str(uuid.uuid4()),'workflow':{'1':{'class_type':'FixtureSave','inputs':{'image':'reference.png'}}},'files':[{'name':'reference.png','data':base64.b64encode(b'fixture input').decode()}],'outputNode':'1','executionSeconds':30}
    def request(self, path, body=None):
        self.calls.append(path)
        if path == '/object_info': return {'FixtureSave':{'input':{}}}
        if path == '/prompt':
            self.assertEqual(body['prompt']['1']['inputs']['image'], self.payload['requestId'] + '/reference.png')
            return {'prompt_id':'fixture-prompt'}
        return {'fixture-prompt':{'status':{'completed':True},'outputs':{'1':{'videos':[{'filename':'take.mp4','type':'output'}]}}}}
    def run_job(self, request=None):
        return execute({'id':'fixture-provider-job','input':self.payload},root=self.root/'jobs',input_root=self.root/'input',output_root=self.output,request=request or self.request,s3_factory=lambda:(self.storage,'private-bucket'))
    def test_real_media_is_verified_uploaded_and_retry_does_not_repeat_inference(self):
        result = self.run_job(); self.assertEqual(result['schema'],'haggs.runpod-result/1'); self.assertEqual(result['artifacts'][0]['kind'],'video'); self.assertEqual(len(self.storage.uploaded),1)
        again = self.run_job(); self.assertEqual(again['artifacts'][0]['name'],'take.mp4'); self.assertEqual(self.calls.count('/prompt'),1); self.assertEqual(len(self.storage.uploaded),1)
    def test_ambiguous_prompt_is_not_retried_on_provider_reentry(self):
        def unknown(path, body=None):
            if path == '/prompt': self.calls.append(path); raise TimeoutError('acceptance unknown')
            return self.request(path,body)
        with self.assertRaises(ValueError): self.run_job(unknown)
        with self.assertRaises(ValueError): self.run_job()
        self.assertEqual(self.calls.count('/prompt'),1)
        receipt=json.loads(next((self.root/'jobs').glob('*/receipt.json')).read_text());self.assertEqual(receipt['state'],'SUBMISSION_UNKNOWN')
    def test_empty_and_unreadable_outputs_never_report_success(self):
        (self.output/'take.mp4').write_bytes(b'not a video')
        with self.assertRaises(Exception): self.run_job()
        self.assertEqual(self.storage.uploaded,[])
    def test_changed_input_and_path_escape_are_rejected(self):
        self.run_job(); self.payload['workflow']['1']['inputs']['other']='changed'
        with self.assertRaises(ValueError): self.run_job()
        self.payload['files'][0]['name']='../escape.png'
        with self.assertRaises(ValueError): validate_input(self.payload)
    def test_missing_storage_blocks_before_comfy_and_handler_raises_failure(self):
        with self.assertRaises(ValueError):
            execute({'input':self.payload},root=self.root/'jobs',request=self.request,s3_factory=lambda:(_ for _ in ()).throw(ValueError('missing storage')))
        self.assertEqual(self.calls,[])
        with self.assertRaises(RuntimeError): handler({'input':{}})

if __name__ == '__main__': unittest.main()
