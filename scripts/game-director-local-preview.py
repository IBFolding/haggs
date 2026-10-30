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
if mode=='pose':
 action=request['action']
 if action not in core.ACTIONS: raise ValueError('unsupported action')
 plan={'actors':[{'path':[[0,.3,.5],[1,.7,.5]],'events':[{'start':0,'end':1,'action':action}]}]}
 frames,_=core.render_poses(json.dumps(plan),256,160,12)
elif mode=='telegraph':
 shape=request['shape']
 if shape not in ('circle','cone','rectangle'): raise ValueError('unsupported shape')
 frames,_,_=core.telegraph(json.dumps({'telegraphs':[{'shape':shape,'start':0,'impact':.25,'end':.5}]}),256,160,12)
else: raise ValueError('unsupported mode')
image=Image.fromarray((np.clip(frames[6],0,1)*255).astype(np.uint8))
output=io.BytesIO();image.save(output,format='PNG');sys.stdout.buffer.write(output.getvalue())
