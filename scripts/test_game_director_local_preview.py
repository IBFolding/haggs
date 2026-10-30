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
