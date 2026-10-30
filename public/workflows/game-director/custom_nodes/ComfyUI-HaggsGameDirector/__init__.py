import json
import re
import uuid
from pathlib import Path
import numpy as np
import torch
import folder_paths
from aiohttp import web
from server import PromptServer
from comfy_api.latest import Types
from .core import render_poses, edge_guide, restore_hud, telegraph, atlas, safe_slug, branch_html, parse_object, size_check, output_descriptor

WEB_DIRECTORY = './web'


def _output():
    p=Path(folder_paths.get_output_directory())/'haggs-game-director'
    p.mkdir(exist_ok=True,parents=True)
    return p


def _batch_size(frames):
    return max(5,int(frames))+(5-max(5,int(frames))%17)%17


def _array(tensor):
    return tensor.detach().cpu().numpy()


def _resample(images,count,width,height,source_fps=24.):
    a=_array(images);n,h,w,_=a.shape
    size_check(width,height,count)
    if not n:raise ValueError('Source video is empty')
    ti=np.minimum((np.arange(count)*source_fps/24).astype(int),n-1)
    yi=np.minimum((np.arange(height)*h/height).astype(int),h-1)
    xi=np.minimum((np.arange(width)*w/width).astype(int),w-1)
    return a[ti][:,yi][:,:,xi,:3].astype(np.float32)


_DEFAULT_TIMELINE=json.dumps({'actors':[{'name':'hero','path':[[0,.3,.55],[2,.7,.55],[5,.5,.55]],'events':[{'start':0,'end':5,'action':'walk'}]}]},indent=2)


class HaggsActionGuide:
    RETURN_TYPES=('IMAGE','STRING','STRING','INT','INT','INT')
    RETURN_NAMES=('pose_guides','prompt','timeline_metadata','length','width','height')
    FUNCTION='render'
    CATEGORY='Haggs/Game Director'

    @classmethod
    def INPUT_TYPES(cls):
        return {'required':{
            'timeline_json':('STRING',{'default':_DEFAULT_TIMELINE,'multiline':True}),
            'scene':('STRING',{'default':'A full-body fantasy hero in a side-on arena, locked camera, consistent identity and outfit.','multiline':True}),
            'width':('INT',{'default':512,'min':128,'max':1280,'step':32}),
            'height':('INT',{'default':320,'min':128,'max':768,'step':32}),
            'frame_count':('INT',{'default':124,'min':5,'max':583,'step':17}),
        }}

    def render(self,timeline_json,scene,width,height,frame_count):
        count=_batch_size(frame_count)
        images,meta=render_poses(timeline_json,int(width),int(height),count,24.)
        actions=[]
        for a in meta['actors']:
            actions.append(str(a.get('name','actor'))+': '+', '.join(f"{e['action']} at {e['start']:.2f}–{e['end']:.2f}s" for e in a.get('events',[])))
        prompt=scene+'\nFollow the supplied pose sequence and screen direction. '+ '; '.join(actions)+'. One continuous shot, no cuts, no added text.'
        return torch.from_numpy(images),prompt,json.dumps(meta),count,int(width),int(height)


class HaggsGameplayGuide:
    RETURN_TYPES=('IMAGE','IMAGE','STRING','INT','INT','INT')
    RETURN_NAMES=('edge_guides','source_frames','prompt','length','width','height')
    FUNCTION='render'
    CATEGORY='Haggs/Game Director'

    @classmethod
    def INPUT_TYPES(cls):
        return {'required':{'source_video':('VIDEO',),
          'style':('STRING',{'default':'A hand-painted dark fantasy game world. Preserve camera, silhouettes and major architecture.','multiline':True}),
          'width':('INT',{'default':512,'min':128,'max':1280,'step':32}),
          'height':('INT',{'default':320,'min':128,'max':768,'step':32}),
          'frame_count':('INT',{'default':124,'min':5,'max':583,'step':17}),
          'edge_threshold':('FLOAT',{'default':.12,'min':.01,'max':1.,'step':.01})}}

    def render(self,source_video,style,width,height,frame_count,edge_threshold):
        count=_batch_size(frame_count);c=source_video.get_components()
        source=_resample(c.images,count,width,height,float(c.frame_rate))
        return torch.from_numpy(edge_guide(source,edge_threshold)),torch.from_numpy(source),style,count,width,height


class HaggsHUDRestore:
    RETURN_TYPES=('IMAGE',)
    FUNCTION='restore'
    CATEGORY='Haggs/Game Director'

    @classmethod
    def INPUT_TYPES(cls):
        return {'required':{'generated_frames':('IMAGE',),'source_frames':('IMAGE',),
          'top_fraction':('FLOAT',{'default':.14,'min':0.,'max':.5}),
          'bottom_fraction':('FLOAT',{'default':0.,'min':0.,'max':.5})},
          'optional':{'hud_mask':('MASK',)}}

    def restore(self,generated_frames,source_frames,top_fraction,bottom_fraction,hud_mask=None):
        out=restore_hud(_array(generated_frames),_array(source_frames),top_fraction,bottom_fraction,None if hud_mask is None else _array(hud_mask))
        return (torch.from_numpy(out),)


class HaggsTelegraphGuide:
    RETURN_TYPES=('IMAGE','MASK','STRING','INT','INT','INT','STRING')
    RETURN_NAMES=('control_guides','alpha_mask','timeline_metadata','length','width','height','prompt')
    FUNCTION='render'
    CATEGORY='Haggs/Game Director'

    @classmethod
    def INPUT_TYPES(cls):
        return {'required':{'timeline_json':('STRING',{'default':json.dumps({'telegraphs':[{'shape':'circle','start':0,'impact':2,'end':3,'x':.5,'y':.55,'radius':.25}]},indent=2),'multiline':True}),
          'style':('STRING',{'default':'Top-down game VFX: a glowing magical danger zone on a black background, bright charged impact, stable camera, no text.','multiline':True}),
          'width':('INT',{'default':512,'min':128,'max':1280,'step':32}),
          'height':('INT',{'default':320,'min':128,'max':768,'step':32}),
          'frame_count':('INT',{'default':124,'min':5,'max':583,'step':17})}}

    def render(self,timeline_json,style,width,height,frame_count):
        count=_batch_size(frame_count);images,masks,meta=telegraph(timeline_json,width,height,count,24.)
        return torch.from_numpy(images),torch.from_numpy(masks),json.dumps(meta),count,width,height,style


class HaggsAtlasExport:
    RETURN_TYPES=('STRING',)
    RETURN_NAMES=('asset_directory',)
    FUNCTION='save'
    CATEGORY='Haggs/Game Director'
    OUTPUT_NODE=True

    @classmethod
    def INPUT_TYPES(cls):
        return {'required':{'images':('IMAGE',),'timeline_metadata':('STRING',{'forceInput':True}),
          'asset_name':('STRING',{'default':'moveset'}),
          'tile_size':('INT',{'default':128,'min':16,'max':512,'step':16}),
          'columns':('INT',{'default':8,'min':1,'max':32})},'optional':{'alpha_mask':('MASK',)}}

    def save(self,images,timeline_metadata,asset_name,tile_size,columns,alpha_mask=None):
        meta=parse_object(timeline_metadata);data=_array(images);mask=None if alpha_mask is None else _array(alpha_mask)
        directory=_output()/(safe_slug(asset_name)+'-'+uuid.uuid4().hex[:12]);directory.mkdir()
        sheet,rects=atlas(data,mask,tile_size,columns);sheet.save(directory/'atlas.png')
        animations=[];fps=float(meta.get('fps',24))
        for actor in meta.get('actors',[]):
            for e in actor.get('events',[]):
                start=max(0,int(math_floor(e['start']*fps)));end=min(len(data),int(math_ceil(e['end']*fps)))
                if end>start:animations.append({'name':safe_slug(actor.get('name','actor')+'-'+e['action']), 'start_frame':start,'end_frame_exclusive':end,'loop_verified':False})
        report={'image':'atlas.png','fps':fps,'frames':rects,'animations':animations,
                'has_alpha_mask':mask is not None,'timeline':meta,
                'note':'Rendered image assets, not a rig. Action/collision timing is design intent and must be checked against generated frames.'}
        (directory/'atlas.json').write_text(json.dumps(report,indent=2))
        return {'ui':{'text':[str(directory)],'images':[output_descriptor(directory.name,'atlas.png')],'files':[output_descriptor(directory.name,'atlas.json')]},'result':(str(directory),)}


def math_floor(x):
    return np.floor(x)


def math_ceil(x):
    return np.ceil(x)


class HaggsBranchPlayer:
    RETURN_TYPES=('STRING',)
    RETURN_NAMES=('player_directory',)
    FUNCTION='save'
    CATEGORY='Haggs/Game Director'
    OUTPUT_NODE=True

    @classmethod
    def INPUT_TYPES(cls):
        return {'required':{'branch_a':('VIDEO',),'branch_b':('VIDEO',),'branch_c':('VIDEO',),
           'choice_a':('STRING',{'default':'Open the door'}),
           'choice_b':('STRING',{'default':'Inspect the artifact'}),
           'choice_c':('STRING',{'default':'Flee'})}}

    def save(self,branch_a,branch_b,branch_c,choice_a,choice_b,choice_c):
        ident=uuid.uuid4().hex;directory=_output()/ident;directory.mkdir()
        for i,video in enumerate([branch_a,branch_b,branch_c]):
            video.save_to(str(directory/f'branch-{i}.mp4'),format=Types.VideoContainer('mp4'),codec=Types.VideoCodec('auto'))
        labels=[choice_a,choice_b,choice_c]
        (directory/'player.html').write_text(branch_html(labels))
        (directory/'branches.json').write_text(json.dumps({'choices':labels,'prepared_branches':True,'persistent_world_state':False},indent=2))
        return {'ui':{'player_url':['/haggs-game-director/'+ident+'/player.html'],'text':[str(directory)],'gifs':[output_descriptor(ident,f'branch-{i}.mp4') for i in range(3)],'files':[output_descriptor(ident,'branches.json')]},'result':(str(directory),)}


@PromptServer.instance.routes.get('/haggs-game-director/{ident}/{filename}')
async def player_asset(request):
    ident=request.match_info['ident'];name=request.match_info['filename']
    if not re.fullmatch(r'[0-9a-f]{32}',ident) or name not in {'player.html','branch-0.mp4','branch-1.mp4','branch-2.mp4','branches.json'}:
        raise web.HTTPNotFound()
    path=_output()/ident/name
    if not path.is_file():raise web.HTTPNotFound()
    return web.FileResponse(path,headers={'X-Content-Type-Options':'nosniff'})


NODE_CLASS_MAPPINGS={c.__name__:c for c in [HaggsActionGuide,HaggsGameplayGuide,HaggsHUDRestore,HaggsTelegraphGuide,HaggsAtlasExport,HaggsBranchPlayer]}
NODE_DISPLAY_NAME_MAPPINGS={'HaggsActionGuide':'Haggs · Draw Path / Combat Timeline',
 'HaggsGameplayGuide':'Haggs · Gameplay Edge Guide','HaggsHUDRestore':'Haggs · Restore HUD',
 'HaggsTelegraphGuide':'Haggs · Enemy Intent Painter','HaggsAtlasExport':'Haggs · Export Game Atlas',
 'HaggsBranchPlayer':'Haggs · Playable Scene Forge'}
