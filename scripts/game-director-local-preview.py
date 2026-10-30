"""Local-only deterministic pose preview; no model or provider calls."""
import importlib.util, io, json, sys
from pathlib import Path
import numpy as np
from PIL import Image
core_path=Path(__file__).resolve().parents[1]/'public/workflows/game-director/custom_nodes/ComfyUI-HaggsGameDirector/core.py'
spec=importlib.util.spec_from_file_location('haggs_game_core',core_path)
core=importlib.util.module_from_spec(spec)
spec.loader.exec_module(core)
request=json.load(sys.stdin)
mode=request['mode']
if mode in ('pose','boss','moveset'):
 action=request['action']
 if action not in core.ACTIONS: raise ValueError('unsupported action')
 path=request.get('path') or [[0,.3,.5],[1,.7,.5]]
 core.path_points(path)
 actors=[{'path':path,'events':[{'start':0,'end':1,'action':action}]}]
 if mode=='boss': actors.append({'path':[[0,.75,.55],[1,.4,.55]],'events':[{'start':0,'end':1,'action':'dodge'}]})
 plan={'actors':actors}
 frames,_=core.render_poses(json.dumps(plan),256,160,12)
elif mode=='telegraph':
 shape=request['shape']
 if shape not in ('circle','cone','rectangle'): raise ValueError('unsupported shape')
 impact=float(request.get('impact',.25))
 if not .05<=impact<=.45: raise ValueError('invalid timing')
 frames,_,_=core.telegraph(json.dumps({'telegraphs':[{'shape':shape,'start':0,'impact':impact,'end':.5}]}),256,160,12)
else: raise ValueError('unsupported mode')
image,_=core.atlas(frames,tile_size=64,columns=4) if mode=='moveset' else (Image.fromarray((np.clip(frames[6],0,1)*255).astype(np.uint8)),None)
output=io.BytesIO();image.save(output,format='PNG');sys.stdout.buffer.write(output.getvalue())
