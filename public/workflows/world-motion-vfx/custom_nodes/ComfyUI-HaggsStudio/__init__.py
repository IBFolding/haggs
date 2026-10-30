import json
import uuid
from fractions import Fraction
from pathlib import Path
from types import SimpleNamespace
import numpy as np
import torch
import torch.nn.functional as F
from PIL import Image
import folder_paths
from server import PromptServer
from comfy_api.latest import InputImpl, Types
from .core import motion_to_guides,timeline_masks,composite_locked,select_effects
from .backend import create_session,session_dir,register_room,run_eden,register_routes

WEB_DIRECTORY='./web'
ROOT=Path(folder_paths.get_output_directory())/'haggs-studio'
ROOT.mkdir(parents=True,exist_ok=True)
register_routes(PromptServer.instance.routes,ROOT)


def array(t):return t.detach().cpu().numpy()


def video(frames,fps=24,audio=None):
    return InputImpl.VideoFromComponents(Types.VideoComponents(images=torch.from_numpy(np.asarray(frames,np.float32)),audio=audio,frame_rate=Fraction(str(fps))))


def audio_length(audio,count,fps):
    if audio is None:return None
    a=dict(audio);n=round(count/fps*a['sample_rate']);w=a['waveform'].detach().cpu()[...,:n]
    if w.shape[-1]<n:w=F.pad(w,(0,n-w.shape[-1]))
    a['waveform']=w;return a


class HaggsPlayableWorld:
    RETURN_TYPES=('STRING',)
    RETURN_NAMES=('session_id',)
    FUNCTION='create'
    CATEGORY='Haggs/World Motion VFX'
    OUTPUT_NODE=True
    @classmethod
    def INPUT_TYPES(cls):return {'required':{
        'character':(['knight','mage','robot'],), 'theme':(['dungeon','temple','spaceship'],),
        'visual_prompt':('STRING',{'default':'A single knight explores the same stone dungeon room and collects three luminous crystals. Preserve the camera and fixed obstacles. No text or HUD.','multiline':True}),
        'eden_service_url':('STRING',{'default':'http://127.0.0.1:8089'})},'optional':{'visual_reference':('IMAGE',)}}
    def create(self,character,theme,visual_prompt,eden_service_url,visual_reference=None):
        ident,p=create_session(ROOT,character,theme,visual_prompt,eden_service_url)
        if visual_reference is not None:
            Image.fromarray((np.clip(array(visual_reference)[0],0,1)*255).astype('uint8')).save(p/'cover.png')
            config=json.loads((p/'config.json').read_text());config['reference_provided']=True;(p/'config.json').write_text(json.dumps(config))
        return {'ui':{'world_url':['/haggs-studio/session/'+ident+'/index.html'],'eden_url':[eden_service_url], 'text':['Proxy room is playable. Eden neural rendering needs a configured GPU backend. Session: '+ident]},'result':(ident,)}


class HaggsRegisterEdenRoom:
    RETURN_TYPES=('STRING',)
    RETURN_NAMES=('registered_game_slug',)
    FUNCTION='register'
    CATEGORY='Haggs/World Motion VFX'
    OUTPUT_NODE=True
    @classmethod
    def INPUT_TYPES(cls):return {'required':{'session_id':('STRING',{'forceInput':True}),'eden_repo':('STRING',{'default':''})}}
    def register(self,session_id,eden_repo):
        slug=register_room(ROOT,session_id,eden_repo)
        return {'ui':{'text':['Registered '+slug+'. Select this game in Eden Live. Native service setup is required.']},'result':(slug,)}


class HaggsEdenReplay:
    RETURN_TYPES=('VIDEO',)
    FUNCTION='render'
    CATEGORY='Haggs/World Motion VFX'
    @classmethod
    def INPUT_TYPES(cls):return {'required':{'session_id':('STRING',{'forceInput':True}),
      'eden_repo':('STRING',{'default':''}),'eden_python':('STRING',{'default':''}),'weights_root':('STRING',{'default':''})}}
    @classmethod
    def IS_CHANGED(cls,session_id,**kwargs):
        try:return (session_dir(ROOT,session_id)/'recording.mp4').stat().st_mtime_ns
        except (ValueError,FileNotFoundError):return 'not-recorded'
    def render(self,session_id,eden_repo,eden_python,weights_root):
        path=run_eden(ROOT,session_id,eden_repo,eden_python,weights_root)
        return (InputImpl.VideoFromFile(str(path)),)


class HaggsRecordedRoom:
    RETURN_TYPES=('VIDEO',)
    FUNCTION='load'
    CATEGORY='Haggs/World Motion VFX'
    @classmethod
    def INPUT_TYPES(cls):return {'required':{'session_id':('STRING',{'forceInput':True})}}
    @classmethod
    def IS_CHANGED(cls,session_id):return HaggsEdenReplay.IS_CHANGED(session_id)
    def load(self,session_id):
        path=session_dir(ROOT,session_id)/'recording.mp4'
        if not path.is_file():raise ValueError('Record five seconds in the Playable World node first, then queue this preview')
        return (InputImpl.VideoFromFile(str(path)),)


class HaggsLoadMotionNPZ:
    RETURN_TYPES=('HYMOTION_DATA',)
    FUNCTION='load'
    CATEGORY='Haggs/World Motion VFX'
    @classmethod
    def INPUT_TYPES(cls):return {'required':{'file':('STRING',{'default':'haggs-studio-synthetic-motion.npz'}),'duration':('FLOAT',{'default':5.,'min':.5,'max':12.})}}
    def load(self,file,duration):
        base=Path(folder_paths.get_input_directory()).resolve();p=(base/file).resolve()
        if not p.is_relative_to(base) or not p.is_file():raise ValueError('Choose an NPZ file inside ComfyUI/input')
        with np.load(p,allow_pickle=False) as data:
            raw={k:np.array(data[k]) for k in ['keypoints3d','rot6d','transl','root_rotations_mat'] if k in data}
        if 'keypoints3d' not in raw:raise ValueError('NPZ has no keypoints3d')
        for k,v in raw.items():
            # HYMotionSaveNPZ writes a single sample; normalize to batch form.
            if k=='keypoints3d' and v.ndim==3:raw[k]=v[None]
        return (SimpleNamespace(output_dict=raw,text='Loaded motion NPZ; verify its actual source',duration=duration,seeds=[]),)


class HaggsMotionToMovie:
    RETURN_TYPES=('IMAGE','STRING','STRING','INT','INT','INT')
    RETURN_NAMES=('pose_guides','prompt','export_directory','length','width','height')
    FUNCTION='convert'
    CATEGORY='Haggs/World Motion VFX'
    @classmethod
    def INPUT_TYPES(cls):return {'required':{'motion_data':('HYMOTION_DATA',),
      'scene':('STRING',{'default':'A full-body knight performs the supplied motion, same identity and outfit, stable camera, no cuts.','multiline':True}),
      'width':('INT',{'default':512,'min':128,'max':1280,'step':32}),'height':('INT',{'default':320,'min':128,'max':768,'step':32}),
      'yaw_degrees':('FLOAT',{'default':0.,'min':-180.,'max':180.}),'speed':('FLOAT',{'default':1.,'min':.25,'max':4.}),
      'sample_index':('INT',{'default':0,'min':0,'max':3})}}
    def convert(self,motion_data,scene,width,height,yaw_degrees,speed,sample_index):
        def numpy(v):return array(v) if hasattr(v,'detach') else np.asarray(v)
        raw={k:numpy(v) for k,v in motion_data.output_dict.items() if k in ['keypoints3d','rot6d','transl','root_rotations_mat'] and v is not None}
        if 'keypoints3d' not in raw or raw['keypoints3d'].ndim!=4 or sample_index>=len(raw['keypoints3d']):raise ValueError('Select a valid generated HY-Motion sample with keypoints3d')
        source=raw['keypoints3d'][sample_index]
        guides,joints,meta=motion_to_guides(source,float(motion_data.duration),width,height,yaw_degrees,speed)
        p=ROOT/('motion-'+uuid.uuid4().hex);p.mkdir()
        np.savez_compressed(p/'original-motion.npz',**raw)
        np.savez_compressed(p/'retimed-joints.npz',keypoints3d=joints,fps=24.)
        meta.update(prompt=str(motion_data.text),selected_sample=sample_index)
        (p/'motion.json').write_text(json.dumps(meta,indent=2))
        prompt=scene+' Follow the supplied body pose sequence and root movement. Motion description: '+str(motion_data.text)
        return torch.from_numpy(guides),prompt,str(p),len(guides),width,height


_FX=json.dumps({'effects':[{'type':'burst','start':1.,'end':2.,'radius':.18,'path':[[1.,.6,.55]],'description':'a bright orange fireball with sparks and smoke'},{'type':'trail','start':2.2,'end':4.5,'radius':.08,'path':[[2.2,.2,.7],[3.2,.5,.4],[4.5,.8,.65]],'description':'a luminous blue magic trail'}]},indent=2)


class HaggsVFXTimeline:
    RETURN_TYPES=('VIDEO','VIDEO','MASK','STRING')
    RETURN_NAMES=('prepared_source','mask_video','effect_mask','effect_prompt')
    FUNCTION='prepare'
    CATEGORY='Haggs/World Motion VFX'
    @classmethod
    def INPUT_TYPES(cls):return {'required':{'source_video':('VIDEO',),'timeline_json':('STRING',{'default':_FX,'multiline':True}),
      'max_side':('INT',{'default':512,'min':256,'max':1024,'step':64}),'seconds':('FLOAT',{'default':5.,'min':1.,'max':10.}),
      'feather_pixels':('FLOAT',{'default':6.,'min':0.,'max':40.}),
      'effect_index':('INT',{'default':0,'min':-1,'max':19})},'optional':{'tracking_masks':('MASK',),'protected_masks':('MASK',)}}
    def prepare(self,source_video,timeline_json,max_side,seconds,feather_pixels,effect_index=0,tracking_masks=None,protected_masks=None):
        c=source_video.get_components();images=c.images.detach().cpu()[...,:3];n,h,w,_=images.shape
        if not n:raise ValueError('Source video has no frames')
        fps=float(c.frame_rate);count=min(round(seconds*24),max(1,round(n/fps*24)));count=max(9,count+(1-count%8)%8)
        scale=min(1,max_side/max(h,w));hh=max(64,round(h*scale/32)*32);ww=max(64,round(w*scale/32)*32)
        ids=torch.minimum((torch.arange(count)*fps/24).long(),torch.tensor(n-1))
        source=F.interpolate(images[ids].permute(0,3,1,2),size=(hh,ww),mode='bilinear',align_corners=False).permute(0,2,3,1).numpy()
        masks,meta=timeline_masks(select_effects(timeline_json,effect_index),count,ww,hh,24.,None if tracking_masks is None else array(tracking_masks),feather_pixels)
        if protected_masks is not None:
            p=protected_masks.detach().cpu()
            if p.ndim==2:p=p[None]
            if p.ndim!=3 or not len(p):raise ValueError('Protected masks must be H,W or T,H,W')
            p=p[torch.minimum(torch.arange(count),torch.tensor(len(p)-1))]
            protected=F.interpolate(p[:,None],size=(hh,ww),mode='nearest')[:,0].clamp(0,1).numpy()
            masks*=1-protected
        descriptions=[e.get('description',e['type']) for e in meta['effects']]
        prompt='Add these visual effects inside the supplied moving masks: '+ '; '.join(descriptions)+'. Preserve the original subject, camera, scene and motion. No cuts or titles.'
        audio=audio_length(c.audio,count,24)
        preview='vfx-reference-'+uuid.uuid4().hex+'.png'
        Image.fromarray((np.clip(source[0],0,1)*255).astype('uint8')).save(ROOT/preview)
        result=(video(source,24,audio),video(np.repeat(masks[...,None],3,-1),24),torch.from_numpy(masks),prompt)
        return {'ui':{'vfx_reference_url':['/view?filename='+preview+'&subfolder=haggs-studio&type=output']},'result':result}


class HaggsVFXLockOutside:
    RETURN_TYPES=('VIDEO',)
    FUNCTION='composite'
    CATEGORY='Haggs/World Motion VFX'
    @classmethod
    def INPUT_TYPES(cls):return {'required':{'source_video':('VIDEO',),'generated_video':('VIDEO',),'effect_mask':('MASK',)}}
    def composite(self,source_video,generated_video,effect_mask):
        a=source_video.get_components();b=generated_video.get_components();source=a.images.detach().cpu();n,h,w,_=source.shape
        ids=torch.minimum((torch.arange(n)*float(b.frame_rate)/float(a.frame_rate)).long(),torch.tensor(len(b.images)-1))
        generated=F.interpolate(b.images.detach().cpu()[ids].permute(0,3,1,2),size=(h,w),mode='bilinear',align_corners=False).permute(0,2,3,1)
        result=composite_locked(source.numpy(),generated.numpy(),array(effect_mask))
        return (video(result,float(a.frame_rate),a.audio),)


NODE_CLASS_MAPPINGS={c.__name__:c for c in [HaggsPlayableWorld,HaggsRegisterEdenRoom,HaggsEdenReplay,HaggsRecordedRoom,HaggsLoadMotionNPZ,HaggsMotionToMovie,HaggsVFXTimeline,HaggsVFXLockOutside]}
NODE_DISPLAY_NAME_MAPPINGS={
 'HaggsPlayableWorld':'Haggs · Playable World / Eden Live', 'HaggsRegisterEdenRoom':'Haggs · Register Room with Eden',
 'HaggsEdenReplay':'Haggs · Eden Neural Replay','HaggsRecordedRoom':'Haggs · Load Room Recording',
 'HaggsLoadMotionNPZ':'Haggs · Load Saved Motion','HaggsMotionToMovie':'Haggs · Motion-to-Movie Bridge',
 'HaggsVFXTimeline':'Haggs · Place & Time LTX Effects','HaggsVFXLockOutside':'Haggs · Preserve Outside Effect Masks'}
