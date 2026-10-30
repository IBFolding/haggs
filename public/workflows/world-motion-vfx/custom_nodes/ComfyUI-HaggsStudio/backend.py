"""ComfyUI routes plus Eden's documented file/CLI/standalone-game interfaces."""
import asyncio
import base64
import csv
import io
import json
import os
import re
import shutil
import subprocess
import uuid
from fractions import Fraction
from pathlib import Path
from urllib.parse import urlparse
from aiohttp import web
from PIL import Image

ASSETS=Path(__file__).parent/'web'


def session_dir(root,ident):
    if not re.fullmatch(r'[0-9a-f]{32}',ident):raise ValueError('Invalid session id')
    p=Path(root)/ident
    if not p.is_dir():raise ValueError('Queue Playable World first to create a session')
    return p


def create_session(root,character='knight',theme='dungeon',prompt='',service_url=''):
    if character not in ('knight','mage','robot') or theme not in ('dungeon','temple','spaceship'):raise ValueError('Invalid character or theme')
    if service_url:
        u=urlparse(service_url)
        if u.scheme not in ('http','https') or not u.hostname or u.username or u.password:raise ValueError('Eden service URL must be an HTTP(S) address without embedded credentials')
    ident=uuid.uuid4().hex;p=Path(root)/ident;p.mkdir(parents=True)
    for a,b in [('room.html','index.html'),('room.js','room.js')]:shutil.copyfile(ASSETS/a,p/b)
    config={'session':ident,'character':character,'theme':theme,'prompt':prompt,'service_url':service_url,'reference_provided':False}
    (p/'config.json').write_text(json.dumps(config))
    return ident,p


def save_recording(root,ident,payload):
    import av
    p=session_dir(root,ident);items=payload.get('frames',[])
    if payload.get('fps')!=24 or not isinstance(items,list) or not 2<=len(items)<=120:raise ValueError('Record 2–120 frames at 24 FPS')
    target=p/'recording.tmp.mp4';first=None;container=None
    try:
        container=av.open(str(target),'w');stream=container.add_stream('libx264',rate=24);stream.width=832;stream.height=480;stream.pix_fmt='yuv420p'
        for i,item in enumerate(items):
            if not isinstance(item,str) or not item.startswith('data:image/jpeg;base64,') or len(item)>400_000:raise ValueError('Invalid or oversized recording frame')
            im=Image.open(io.BytesIO(base64.b64decode(item.split(',',1)[1],validate=True)))
            if im.size!=(832,480):raise ValueError('Proxy frames must be 832×480')
            im=im.convert('RGB')
            if first is None:first=im.copy()
            frame=av.VideoFrame.from_image(im);frame.pts=i;frame.time_base=Fraction(1,24)
            for packet in stream.encode(frame):container.mux(packet)
        for packet in stream.encode():container.mux(packet)
        container.close();container=None;os.replace(target,p/'recording.mp4')
    except Exception:
        if container is not None:container.close()
        target.unlink(missing_ok=True);raise
    config=json.loads((p/'config.json').read_text())
    first.save(p/'first-frame.png')
    if not config.get('reference_provided'):first.save(p/'cover.png')
    (p/'prompts.json').write_text(json.dumps({'staticPrompt':config['prompt'],'dynamicPrompts':[]}))
    (p/'events.json').write_text(json.dumps(payload.get('events',[])[:500]))
    with (p/'manifest.csv').open('w',newline='') as f:
        writer=csv.DictWriter(f,fieldnames=['id','proxy_video','first_frame']);writer.writeheader();writer.writerow({'id':'haggs_room','proxy_video':'recording.mp4','first_frame':'cover.png'})
    return {'session_id':ident,'frames':len(items),'fps':24}


def register_room(root,ident,eden_repo):
    import fcntl
    p=session_dir(root,ident);games=Path(eden_repo).expanduser().resolve()/'realtime/games';registry=games/'registry.json'
    if not registry.is_file():raise ValueError('Select the official EdenLive checkout containing realtime/games/registry.json')
    if not (p/'first-frame.png').exists():raise ValueError('Record the room first; registration needs its matching first frame')
    slug='haggs-room-'+ident[:12];dest=games/slug
    with (games/'.haggs-registry.lock').open('a') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX);data=json.loads(registry.read_text())
        existing=next((x for x in data.get('games',[]) if x.get('slug')==slug),None)
        if dest.exists() and (not existing or existing.get('source',{}).get('haggs_session')!=ident):raise ValueError('Registration would overwrite an unrelated game')
        dest.mkdir(exist_ok=True)
        for name in ['index.html','room.js','config.json','first-frame.png','cover.png']:shutil.copyfile(p/name,dest/name)
        config=json.loads((p/'config.json').read_text());config['session']='';(dest/'config.json').write_text(json.dumps(config))
        entry={'slug':slug,'title':'Haggs '+config['theme'].title()+' Room','description':'Collect three crystals. Fixed geometry and keyboard collision rules; Eden renders appearance.',
               'prompt':config['prompt'],'cover':'cover.png','entry':'index.html','host':'standalone','controls':['WASD / arrows: move','Enter: restart'],
               'restart_keys':['enter'],'modules':[],'event_prompts':{'orb.collected':'A crystal is collected and disappears.'},'source':{'haggs_session':ident}}
        data['games']=[x for x in data.get('games',[]) if x.get('slug')!=slug]+[entry]
        backup=games/('registry.haggs-backup-'+uuid.uuid4().hex[:8]+'.json');shutil.copyfile(registry,backup)
        temp=games/('registry.'+uuid.uuid4().hex+'.tmp');temp.write_text(json.dumps(data,indent=2));os.replace(temp,registry)
    return slug


def eden_command(eden_repo,python_executable,weights,session,output):
    repo=Path(eden_repo).expanduser().resolve();py=Path(python_executable).expanduser().resolve();w=Path(weights).expanduser().resolve()
    config=repo/'edenlive/configs/wan22_5b_720p_few_step.yaml'
    if not config.is_file() or not py.is_file():raise ValueError('Set the official Eden checkout and its configured Python executable')
    for part in ['dit-5b','vae-5b','umt5','scheduler-5b','vision-encoder']:
        if not (w/part).is_dir():raise ValueError('Missing Eden model component: '+part)
    if not (Path(session)/'recording.mp4').is_file():raise ValueError('Record the proxy room before rendering')
    values={'model.pretrained_dir':str(w),'data.dataset.params.path':str(Path(session)/'manifest.csv'),
            'data.dataset.params.root':str(session),'data.dataset.params.width':832,'data.dataset.params.height':480,
            'data.num_workers':0,'inference.width':832,'inference.height':480,'inference.output_dir':str(output),'inference.max_batches':1}
    args=[str(py),'-m','edenlive.scripts.infer','--config',str(config)]+[k+'='+json.dumps(v) for k,v in values.items()]
    return args,repo


def run_eden(root,ident,eden_repo,python_executable,weights):
    p=session_dir(root,ident);out=p/('eden-render-'+uuid.uuid4().hex[:12]);out.mkdir()
    command,repo=eden_command(eden_repo,python_executable,weights,p,out)
    env=os.environ.copy();env.update(HF_HUB_OFFLINE='1',TRANSFORMERS_OFFLINE='1')
    receipt={'status':'running','command':command,'output':str(out)};(out/'receipt.json').write_text(json.dumps(receipt,indent=2))
    with (out/'inference.log').open('w') as log:
        try:subprocess.run(command,cwd=repo,env=env,stdout=log,stderr=subprocess.STDOUT,check=True,timeout=3600)
        except (subprocess.SubprocessError,OSError) as exc:
            receipt['status']='failed';(out/'receipt.json').write_text(json.dumps(receipt,indent=2));raise RuntimeError('Eden rendering failed; inspect '+str(out/'inference.log')+'. No automatic retry was started.') from exc
    results=list(out.rglob('haggs_room.mp4'))
    if len(results)!=1:raise RuntimeError('Eden did not return exactly one generated haggs_room.mp4; inspect '+str(out))
    receipt.update(status='complete',video=str(results[0]));(out/'receipt.json').write_text(json.dumps(receipt,indent=2));return results[0]


def register_routes(routes,root):
    @routes.get('/haggs-studio/session/{ident}/{filename}')
    async def asset(request):
        try:
            p=session_dir(root,request.match_info['ident']);name=request.match_info['filename']
            if name not in {'index.html','room.js','config.json','recording.mp4','first-frame.png','cover.png','events.json'}:raise ValueError('Unknown asset')
            path=p/name
            if not path.is_file():raise ValueError('Missing asset')
            return web.FileResponse(path,headers={'X-Content-Type-Options':'nosniff'})
        except ValueError:raise web.HTTPNotFound()

    @routes.post('/haggs-studio/session/{ident}/record')
    async def record(request):
        try:
            body=await request.read()
            if len(body)>24_000_000:raise ValueError('Recording exceeds 24 MB')
            result=await asyncio.to_thread(save_recording,root,request.match_info['ident'],json.loads(body))
            return web.json_response(result)
        except (ValueError,TypeError,KeyError) as exc:return web.json_response({'error':str(exc)},status=400)
