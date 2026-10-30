"""Local-only procedural VFX mask / synthetic saved-motion guide."""
import base64, importlib.util, io, json, sys
from pathlib import Path
import numpy as np
from PIL import Image
root=Path(__file__).resolve().parents[1]/'public/workflows/world-motion-vfx'
spec=importlib.util.spec_from_file_location('haggs_studio_core',root/'custom_nodes/ComfyUI-HaggsStudio/core.py');core=importlib.util.module_from_spec(spec);spec.loader.exec_module(core)
request=json.load(sys.stdin);mode=request['mode']
if mode=='mask':
 kind=request['effect']
 if kind not in ('portal','burst','trail','beam'):raise ValueError('invalid effect')
 masks,meta=core.timeline_masks(json.dumps({'effects':[{'type':kind,'start':.25,'end':.75,'radius':.2,'path':[[0,.2,.5],[1,.8,.5]]}]}),24,128,96,feather=0)
 image=Image.fromarray((np.clip(masks[12],0,1)*255).astype('uint8'));summary={'kind':'mask','effect':kind,'frames':24,'fps':24,'procedural':True}
elif mode=='motion':
 speed=float(request.get('speed',1))
 if not .5<=speed<=2:raise ValueError('invalid speed')
 points=np.load(root/'input/haggs-studio-synthetic-motion.npz',allow_pickle=False)['keypoints3d']
 frames,_,meta=core.motion_to_guides(points,5,128,96,speed=speed)
 image=Image.fromarray((np.clip(frames[len(frames)//2],0,1)*255).astype('uint8'));summary={'kind':'motion','frames':len(frames),'fps':meta['output_fps'],'speed':speed,'synthetic':True}
else:raise ValueError('invalid mode')
out=io.BytesIO();image.save(out,format='PNG');print(json.dumps({'png':base64.b64encode(out.getvalue()).decode(),'metadata':summary}))
