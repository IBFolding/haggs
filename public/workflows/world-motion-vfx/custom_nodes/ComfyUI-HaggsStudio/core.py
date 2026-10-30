"""Model-independent timeline masks and real skeletal-motion conversion."""
import json
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

EDGES=[(1,2),(1,5),(2,3),(3,4),(5,6),(6,7),(1,8),(8,9),(9,10),
       (1,11),(11,12),(12,13),(1,0),(0,14),(14,16),(0,15),(15,17)]
COLORS=[(255,0,0),(255,85,0),(255,170,0),(255,255,0),(170,255,0),
        (85,255,0),(0,255,0),(0,255,85),(0,255,170),(0,255,255),
        (0,170,255),(0,85,255),(0,0,255),(85,0,255),(170,0,255),
        (255,0,255),(255,0,170),(255,0,85)]


def object_json(text):
    try:a=json.loads(text)
    except (ValueError,TypeError) as e:raise ValueError('Use valid JSON') from e
    if not isinstance(a,dict):raise ValueError('JSON must contain an object')
    return a


def numeric(v,label):
    if not isinstance(v,(float,int)) or not math.isfinite(v):raise ValueError(label+' must be finite')
    return float(v)


def select_effects(text,index):
    obj=object_json(text);events=obj.get('effects')
    if not isinstance(events,list) or not events:raise ValueError('Provide effect events')
    if index==-1:return text
    if not 0<=index<len(events):raise ValueError('effect_index is outside the timeline; use -1 for all masks')
    return json.dumps({'effects':[events[index]]})


def path_at(path,t):
    a=np.asarray(path,dtype=float)
    if a.ndim!=2 or a.shape[1]!=3 or not len(a) or not np.isfinite(a).all():
        raise ValueError('Paths contain [seconds, x, y] rows')
    a=a[np.argsort(a[:,0])]
    if (a[:,0]<0).any() or (a[:,1:]<0).any() or (a[:,1:]>1).any() or len(np.unique(a[:,0]))!=len(a):
        raise ValueError('Use unique nonnegative times and x/y coordinates in [0,1]')
    return float(np.interp(t,a[:,0],a[:,1])),float(np.interp(t,a[:,0],a[:,2]))


def timeline_masks(text,count,width,height,fps=24.,tracking=None,feather=6.):
    obj=object_json(text);events=obj.get('effects')
    if not isinstance(events,list) or not 1<=len(events)<=20:raise ValueError('Provide 1–20 effects')
    if width*height*count>100_000_000 or min(width,height,count)<=0 or fps<=0:raise ValueError('Use a shorter or smaller shot')
    prepared=[]
    for e in events:
        kind=e.get('type');start=numeric(e.get('start'),'start');end=numeric(e.get('end'),'end')
        radius=numeric(e.get('radius',.15),'radius')
        if kind not in ('burst','portal','trail','beam'):raise ValueError('Effect type must be burst, portal, trail or beam')
        if not 0<=start<end or not .005<=radius<=1:raise ValueError('Use start < end and radius .005–1')
        path=e.get('path',[[0,.5,.5]]);path_at(path,0)
        prepared.append((e,kind,start,end,radius,path))
    masks=np.zeros((count,height,width),np.float32)
    for i in range(count):
        t=i/fps
        for e,kind,start,end,radius,path in prepared:
            if not start<=t<end:continue
            phase=(t-start)/(end-start);x,y=path_at(path,t)
            if e.get('follow_tracking'):
                if tracking is None:raise ValueError('follow_tracking needs a tracking MASK batch')
                m=np.asarray(tracking[min(i,len(tracking)-1)])
                if not np.isfinite(m).all() or m.ndim!=2:raise ValueError('Tracking masks must be finite H,W arrays')
                weight=np.maximum(m,0);total=weight.sum()
                if total<=1e-7:continue
                yy,xx=np.mgrid[0:m.shape[0],0:m.shape[1]]
                x=float((xx*weight).sum()/total/max(m.shape[1]-1,1));y=float((yy*weight).sum()/total/max(m.shape[0]-1,1))
            im=Image.new('L',(width,height));d=ImageDraw.Draw(im);cx=x*width;cy=y*height;r=radius*min(width,height)
            if kind=='burst':
                rr=r*(.2+.8*math.sin(phase*math.pi));d.ellipse((cx-rr,cy-rr,cx+rr,cy+rr),fill=255)
            elif kind=='portal':d.ellipse((cx-r,cy-r*1.3,cx+r,cy+r*1.3),fill=255)
            elif kind=='beam':
                target=e.get('target',[.9,.2])
                if len(target)!=2 or not np.isfinite(target).all() or not all(0<=v<=1 for v in target):raise ValueError('Beam target is normalized [x,y]')
                d.line((cx,cy,target[0]*width,target[1]*height),fill=255,width=max(1,round(r)))
            else:
                tail=numeric(e.get('tail_seconds',.4),'tail_seconds')
                if not 0<=tail<=10:raise ValueError('tail_seconds must be 0–10')
                points=[path_at(path,max(start,tt)) for tt in np.linspace(max(start,t-tail),t,16)]
                d.line([(px*width,py*height) for px,py in points],fill=255,width=max(1,round(r)))
            # Blur inward only: softness never expands the editable region beyond its hard support.
            support=np.asarray(im,np.float32)/255
            soft=np.asarray(im.filter(ImageFilter.GaussianBlur(max(0,feather))),np.float32)/255
            masks[i]=np.maximum(masks[i],support*soft)
    return masks,{'schema':'haggs-vfx-timeline/v1','fps':fps,'frames':count,'width':width,'height':height,'effects':events}


def composite_locked(source,generated,masks):
    s=np.asarray(source,np.float32);g=np.asarray(generated,np.float32);m=np.asarray(masks,np.float32)
    if s.shape!=g.shape or s.ndim!=4 or s.shape[-1]!=3 or m.shape!=s.shape[:3]:raise ValueError('Source, generated frames and masks must have matching shapes')
    if not all(np.isfinite(a).all() for a in (s,g,m)):raise ValueError('Nonfinite image data')
    m=np.clip(m,0,1)[...,None]
    return np.where(m==0,s,s*(1-m)+g*m).astype(np.float32)


def motion_to_guides(points,duration,width=512,height=320,yaw=0.,speed=1.,target_fps=24.):
    a=np.asarray(points,np.float32)
    if a.ndim!=3 or a.shape[1]<22 or a.shape[2]!=3 or len(a)<2 or not np.isfinite(a).all():raise ValueError('Motion must contain finite T,22+,3 joint positions')
    duration=numeric(duration,'duration');speed=numeric(speed,'speed')
    if duration<=0 or not .25<=speed<=4 or np.ptp(a[:,:22,1])<.05:
        raise ValueError('Motion is missing, degenerate, or has invalid timing. HY-Motion needs its body model assets to produce real joints.')
    requested=max(5,int(round(duration/speed*target_fps)))
    count=requested+(5-requested%17)%17
    if count>600 or width*height*count>100_000_000:raise ValueError('Shorten the motion or reduce resolution')
    time=np.minimum(np.arange(count)/target_fps*speed,duration*(len(a)-1)/len(a))
    positions=time/duration*len(a);lo=np.floor(positions).astype(int).clip(0,len(a)-1);hi=np.minimum(lo+1,len(a)-1);mix=(positions-lo)[:,None,None]
    out=a[lo]*(1-mix)+a[hi]*mix
    rad=math.radians(yaw);x=out[...,0]*math.cos(rad)+out[...,2]*math.sin(rad);y=out[...,1]
    # One frame for the whole sequence preserves locomotion; no per-frame recentering.
    span=max(float(np.ptp(x)),float(np.ptp(y))*width/height,.1)*1.25
    cx=(float(x.min())+float(x.max()))/2;cy=(float(y.min())+float(y.max()))/2
    px=(x-cx)/span*width+width/2;py=height/2-(y-cy)/span*width
    output=np.zeros((count,height,width,3),np.float32)
    mapping=[15,12,17,19,21,16,18,20,2,5,8,1,4,7,15,15,15,15]
    for f in range(count):
        p=np.stack((px[f,mapping],py[f,mapping]),axis=-1)
        # Facial guide points are estimated from head position, not generated facial motion.
        p[14:]+=[[-3,-2],[3,-2],[-6,0],[6,0]]
        im=Image.new('RGB',(width,height));d=ImageDraw.Draw(im)
        for k,(i,j) in enumerate(EDGES):d.line((tuple(p[i]),tuple(p[j])),fill=COLORS[k],width=max(2,width//160))
        for k,(xx,yy) in enumerate(p):d.ellipse((xx-2,yy-2,xx+2,yy+2),fill=COLORS[k])
        output[f]=np.asarray(im,np.float32)/255
    meta={'schema':'haggs-motion-bridge/v1','source_joint_count':a.shape[1],'source_frames':len(a),'source_duration':duration,
          'source_fps_inferred':len(a)/duration,'output_frames':count,'output_fps':target_fps,'speed':speed,'yaw':yaw,
          'note':'Raw generated motion is retained separately. Pose projection estimates face points and does not retarget a rig.'}
    return output,out.astype(np.float32),meta
