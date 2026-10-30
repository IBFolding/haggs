import base64,json,subprocess,sys
from pathlib import Path
SCRIPT=Path(__file__).with_name('studio-local-reuse.py')
def test_local_composite_is_playable_mp4_and_not_model_generated(tmp_path):
 proc=subprocess.run([sys.executable,str(SCRIPT)],input=b'{"effect":"portal"}',capture_output=True,timeout=40,check=True)
 data=json.loads(proc.stdout);assert data['metadata']['syntheticInputs'] is True and data['metadata']['audio'] is False
 file=tmp_path/'result.mp4';file.write_bytes(base64.b64decode(data['mp4']))
 info=subprocess.run(['ffprobe','-v','error','-show_entries','stream=codec_type','-of','json',str(file)],capture_output=True,timeout=10,check=True)
 assert any(s['codec_type']=='video' for s in json.loads(info.stdout)['streams'])
def test_unknown_effect_fails():
 proc=subprocess.run([sys.executable,str(SCRIPT)],input=b'{"effect":"unknown"}',capture_output=True,timeout=10)
 assert proc.returncode!=0 and not proc.stdout
