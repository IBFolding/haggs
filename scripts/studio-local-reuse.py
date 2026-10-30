"""Local-only one-second compositor. Uses bundled clips or explicitly supplied test media."""
import base64,importlib.util,json,subprocess,sys,tempfile
from pathlib import Path
import numpy as np
root=Path(__file__).resolve().parents[1]/'public/workflows/world-motion-vfx'
spec=importlib.util.spec_from_file_location('studio_core',root/'custom_nodes/ComfyUI-HaggsStudio/core.py');core=importlib.util.module_from_spec(spec);spec.loader.exec_module(core)
data=json.load(sys.stdin);effect=data['effect']
if effect not in ('portal','burst','trail','beam'):raise ValueError('invalid effect')
def decode_file(name,destination):
 payload=base64.b64decode(data[name],validate=True)
 if not 12<=len(payload)<=2_000_000:raise ValueError('invalid input size')
 destination.write_bytes(payload)
def load(path):
 result=subprocess.run(['ffmpeg','-v','error','-protocol_whitelist','file,pipe','-i',str(path),'-vf','scale=128:96,fps=24','-frames:v','24','-f','rawvideo','-pix_fmt','rgb24','pipe:1'],stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,timeout=15,check=True)
 if len(result.stdout)!=24*128*96*3:raise ValueError('both videos must provide at least one second')
 return np.frombuffer(result.stdout,dtype=np.uint8).reshape(24,96,128,3).astype(np.float32)/255
with tempfile.TemporaryDirectory(prefix='haggs-reuse-test-') as folder:
 temp=Path(folder);custom='source' in data or 'take' in data
 if custom:
  source_path=temp/'source.mp4';take_path=temp/'take.mp4';decode_file('source',source_path);decode_file('take',take_path)
 else:source_path=root/'input/haggs-studio-source.mp4';take_path=root/'input/haggs-studio-existing-take.mp4'
 audio=None
 if data.get('audio'):audio=temp/'audio.wav';decode_file('audio',audio)
 source=load(source_path);take=load(take_path)
 masks,_=core.timeline_masks(json.dumps({'effects':[{'type':effect,'start':.25,'end':.75,'radius':.2,'path':[[0,.2,.5],[1,.8,.5]]}]}),24,128,96,feather=0)
 out=core.composite_locked(source,take,masks)
 command=['ffmpeg','-v','error','-f','rawvideo','-pixel_format','rgb24','-video_size','128x96','-framerate','24','-i','pipe:0']
 if audio:command+=['-protocol_whitelist','file,pipe','-i',str(audio),'-map','0:v:0','-map','1:a:0','-t','1','-c:a','aac']
 else:command+=['-an']
 command+=['-c:v','libx264','-preset','ultrafast','-pix_fmt','yuv420p','-movflags','frag_keyframe+empty_moov','-f','mp4','pipe:1']
 encoded=subprocess.run(command,input=(np.clip(out,0,1)*255).astype(np.uint8).tobytes(),stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,timeout=15,check=True)
 print(json.dumps({'mp4':base64.b64encode(encoded.stdout).decode(),'metadata':{'kind':'reuse-composite','effect':effect,'frames':24,'fps':24,'syntheticInputs':not custom,'audio':bool(audio)}}))
