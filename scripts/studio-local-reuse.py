"""Local test on bundled synthetic clips. No model, network, or user media."""
import base64,importlib.util,json,subprocess,sys
from pathlib import Path
import numpy as np
root=Path(__file__).resolve().parents[1]/'public/workflows/world-motion-vfx'
spec=importlib.util.spec_from_file_location('studio_core',root/'custom_nodes/ComfyUI-HaggsStudio/core.py');core=importlib.util.module_from_spec(spec);spec.loader.exec_module(core)
data=json.load(sys.stdin);effect=data['effect']
if effect not in ('portal','burst','trail','beam'):raise ValueError('invalid effect')
def load(name):
 result=subprocess.run(['ffmpeg','-v','error','-i',str(root/'input'/name),'-vf','scale=128:96,fps=24','-frames:v','24','-f','rawvideo','-pix_fmt','rgb24','pipe:1'],stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,timeout=15,check=True)
 if len(result.stdout)!=24*128*96*3:raise ValueError('unexpected fixture dimensions')
 return np.frombuffer(result.stdout,dtype=np.uint8).reshape(24,96,128,3).astype(np.float32)/255
source=load('haggs-studio-source.mp4');take=load('haggs-studio-existing-take.mp4')
masks,_=core.timeline_masks(json.dumps({'effects':[{'type':effect,'start':.25,'end':.75,'radius':.2,'path':[[0,.2,.5],[1,.8,.5]]}]}),24,128,96,feather=0)
out=core.composite_locked(source,take,masks)
encoded=subprocess.run(['ffmpeg','-v','error','-f','rawvideo','-pixel_format','rgb24','-video_size','128x96','-framerate','24','-i','pipe:0','-an','-c:v','libx264','-preset','ultrafast','-pix_fmt','yuv420p','-movflags','frag_keyframe+empty_moov','-f','mp4','pipe:1'],input=(np.clip(out,0,1)*255).astype(np.uint8).tobytes(),stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,timeout=15,check=True)
print(json.dumps({'mp4':base64.b64encode(encoded.stdout).decode(),'metadata':{'kind':'reuse-composite','effect':effect,'frames':24,'fps':24,'syntheticInputs':True,'audio':False}}))
