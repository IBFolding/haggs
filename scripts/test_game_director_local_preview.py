import json, subprocess, sys
from pathlib import Path
SCRIPT=Path(__file__).with_name('game-director-local-preview.py')
def preview(data):
 return subprocess.run([sys.executable,str(SCRIPT)],input=json.dumps(data).encode(),capture_output=True,timeout=10)
def test_drawn_paths_change_rendered_pose():
 a=preview({'mode':'pose','action':'walk','path':[[0,.2,.3],[1,.3,.3]]})
 b=preview({'mode':'pose','action':'walk','path':[[0,.7,.6],[1,.8,.6]]})
 assert a.returncode==b.returncode==0 and a.stdout.startswith(b'\x89PNG') and a.stdout!=b.stdout
def test_invalid_timing_rejected():
 result=preview({'mode':'telegraph','shape':'cone','impact':2})
 assert result.returncode!=0 and not result.stdout
def test_boss_and_moveset_outputs():
 from PIL import Image
 import io
 boss=preview({'mode':'boss','action':'attack'})
 atlas=preview({'mode':'moveset','action':'walk'})
 assert boss.returncode==atlas.returncode==0
 assert Image.open(io.BytesIO(boss.stdout)).size==(256,160)
 assert Image.open(io.BytesIO(atlas.stdout)).size==(256,192)
def test_reskin_edge_guide_uses_uploaded_frame():
 import base64,io
 from PIL import Image,ImageDraw
 image=Image.new('RGB',(64,64),'black');ImageDraw.Draw(image).rectangle((16,16,48,48),fill='white')
 data=io.BytesIO();image.save(data,format='PNG')
 result=preview({'mode':'reskin','image':base64.b64encode(data.getvalue()).decode()})
 assert result.returncode==0 and Image.open(io.BytesIO(result.stdout)).getbbox() is not None
