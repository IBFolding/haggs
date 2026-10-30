"""Guide rendering and asset packing. No model calls or game-engine dependencies."""
import json
import math
import re
import numpy as np
from PIL import Image, ImageDraw

LIMBS = [(1,2),(1,5),(2,3),(3,4),(5,6),(6,7),(1,8),(8,9),(9,10),
         (1,11),(11,12),(12,13),(1,0),(0,14),(14,16),(0,15),(15,17)]
COLORS = [(255,0,0),(255,85,0),(255,170,0),(255,255,0),(170,255,0),
          (85,255,0),(0,255,0),(0,255,85),(0,255,170),(0,255,255),
          (0,170,255),(0,85,255),(0,0,255),(85,0,255),(170,0,255),
          (255,0,255),(255,0,170),(255,0,85)]
ACTIONS = ('idle','walk','attack','dodge','hit','victory')


def parse_object(text):
    try:
        obj = json.loads(text)
    except (TypeError, json.JSONDecodeError) as exc:
        raise ValueError('Timeline must be valid JSON') from exc
    if not isinstance(obj, dict):
        raise ValueError('Timeline must be a JSON object')
    return obj


def size_check(width, height, count):
    if not all(isinstance(v,int) and v>0 for v in (width,height,count)):
        raise ValueError('Dimensions and frame count must be positive integers')
    if width>1920 or height>1080 or count>600 or width*height*count>100_000_000:
        raise ValueError('Guide limit: 600 frames, 1080p and 100 million total pixels; use short previews')


def path_points(points):
    a = np.asarray(points, dtype=float)
    if a.ndim!=2 or a.shape[1]!=3 or not len(a) or not np.isfinite(a).all():
        raise ValueError('Path needs [seconds, normalized_x, normalized_y] points')
    if (a[:,0]<0).any() or (a[:,1:]<0).any() or (a[:,1:]>1).any():
        raise ValueError('Path seconds must be >=0 and coordinates in [0,1]')
    a=a[np.argsort(a[:,0])]
    if len(np.unique(a[:,0]))!=len(a):
        raise ValueError('Path timestamps must be unique')
    return a


def action_at(events,t):
    active=None
    for e in events:
        if e['start']<=t<e['end']:
            active=e
    if active is None:
        return 'idle',0.
    return active['action'], (t-active['start'])/(active['end']-active['start'])


def validate_events(events):
    for e in events:
        if not isinstance(e,dict) or e.get('action') not in ACTIONS:
            raise ValueError('Action must be one of '+', '.join(ACTIONS))
        start,end=e.get('start'),e.get('end')
        if not isinstance(start,(int,float)) or not isinstance(end,(int,float)) or not np.isfinite([start,end]).all() or not 0<=start<end:
            raise ValueError('Each action requires finite 0 <= start < end')


def skeleton(cx,cy,scale,action,phase,t,facing=1):
    # COCO/OpenPose 18-joint layout. Procedural guide, not captured human motion.
    p=np.array([[0,-.32],[0,-.23],[-.09,-.22],[-.15,-.07],[-.16,.07],
                [.09,-.22],[.15,-.07],[.16,.07],[-.065,.02],[-.075,.21],[-.08,.39],
                [.065,.02],[.075,.21],[.08,.39],[-.025,-.34],[.025,-.34],[-.05,-.33],[.05,-.33]],float)
    if action=='walk':
        s=math.sin(t*9)
        p[9:11,0]+=s*.07;p[12:14,0]-=s*.07
        p[3:5,0]-=s*.06;p[6:8,0]+=s*.06
    elif action=='attack':
        swing=math.sin(phase*math.pi)
        p[6]=[.13+.1*swing,-.13-.07*swing]
        p[7]=[.16+.28*swing,-.08-.14*swing]
        p[:,0]+=.05*swing
    elif action=='dodge':
        crouch=math.sin(phase*math.pi)
        p[:8,1]+=.18*crouch;p[9,0]-=.07*crouch;p[12,0]+=.07*crouch
    elif action=='hit':
        p[:8,0]-=.12*math.sin(phase*math.pi)
    elif action=='victory':
        p[3]=[-.14,-.36];p[4]=[-.18,-.48];p[6]=[.14,-.36];p[7]=[.18,-.48]
    else:
        p[:8,1]+=.004*math.sin(t*3)
    p[:,0]*=facing
    p*=scale
    p+=np.array([cx,cy])
    return p


def render_poses(timeline,width=512,height=320,count=124,fps=24.):
    size_check(width,height,count)
    if fps<=0 or not np.isfinite(fps):
        raise ValueError('FPS must be positive')
    obj=parse_object(timeline);actors=obj.get('actors',[])
    if not isinstance(actors,list) or not 1<=len(actors)<=4:
        raise ValueError('Provide one to four actors')
    cooked=[]
    for a in actors:
        path=path_points(a.get('path',[[0,.5,.55]]))
        ev=a.get('events',[]);validate_events(ev)
        scale=float(a.get('scale',.75));facing=int(a.get('facing',1))
        if not np.isfinite(scale) or not .1<=scale<=1.5 or facing not in (-1,1):
            raise ValueError('Actor scale must be .1–1.5 and facing must be -1 or 1')
        cooked.append((path,ev,scale,facing))
    output=np.zeros((count,height,width,3),np.float32)
    for i in range(count):
        t=i/fps;im=Image.new('RGB',(width,height));d=ImageDraw.Draw(im)
        for path,ev,scale,facing in cooked:
            cx=np.interp(t,path[:,0],path[:,1]);cy=np.interp(t,path[:,0],path[:,2])
            action,phase=action_at(ev,t)
            points=skeleton(cx,cy,scale,action,phase,t,facing)*[width,height]
            for k,(a,b) in enumerate(LIMBS):
                d.line([tuple(points[a]),tuple(points[b])],fill=COLORS[k],width=max(2,width//150))
            for k,(x,y) in enumerate(points):
                r=max(2,width//170);d.ellipse((x-r,y-r,x+r,y+r),fill=COLORS[k])
        output[i]=np.asarray(im,dtype=np.float32)/255
    return output, {'schema':'haggs-game-timeline/v1','fps':fps,'frames':count,
                    'width':width,'height':height,'duration':count/fps,
                    'planning_only':True,'actors':actors,
                    'note':'Action markers are intended timing, not detected collisions or verified generated motion.'}


def edge_guide(images,threshold=.12):
    a=np.asarray(images,np.float32)
    if a.ndim!=4 or a.shape[-1]<3 or not np.isfinite(a).all():
        raise ValueError('Expected finite T,H,W,RGB frames')
    g=a[...,:3].mean(-1)
    dx=np.abs(np.diff(g,axis=2,prepend=g[:,:,:1]))
    dy=np.abs(np.diff(g,axis=1,prepend=g[:,:1,:]))
    e=(dx+dy>threshold).astype(np.float32)
    return np.repeat(e[...,None],3,axis=-1)


def restore_hud(generated,source,top_fraction=.14,bottom_fraction=0.,mask=None):
    g=np.asarray(generated,np.float32);s=np.asarray(source,np.float32)
    if g.ndim!=4 or s.ndim!=4 or g.shape[-1]!=3 or s.shape[-1]<3 or not len(s):
        raise ValueError('Expected generated and source frame batches')
    n,h,w,_=g.shape
    yi=np.minimum((np.arange(h)*s.shape[1]/h).astype(int),s.shape[1]-1)
    xi=np.minimum((np.arange(w)*s.shape[2]/w).astype(int),s.shape[2]-1)
    s=s[np.minimum(np.arange(n),len(s)-1)][:,yi][:,:,xi,:3]
    m=np.zeros((n,h,w,1),np.float32)
    if mask is None:
        m[:,:round(h*top_fraction)]=1
        bottom_rows=round(h*bottom_fraction)
        if bottom_rows>0:m[:,-bottom_rows:]=1
    else:
        mask=np.asarray(mask,np.float32)
        if mask.ndim==2:mask=mask[None]
        if mask.ndim!=3 or not len(mask):raise ValueError('HUD mask must be H,W or T,H,W')
        yy=np.minimum((np.arange(h)*mask.shape[1]/h).astype(int),mask.shape[1]-1)
        xx=np.minimum((np.arange(w)*mask.shape[2]/w).astype(int),mask.shape[2]-1)
        m=np.clip(mask[np.minimum(np.arange(n),len(mask)-1)][:,yy][:,:,xx,None],0,1)
    return np.clip(g*(1-m)+s*m,0,1).astype(np.float32)


def telegraph(timeline,width=512,height=320,count=124,fps=24.):
    size_check(width,height,count)
    obj=parse_object(timeline);events=obj.get('telegraphs',[])
    if not isinstance(events,list) or not events:raise ValueError('Provide telegraphs in the timeline')
    output=np.zeros((count,height,width,3),np.float32);masks=np.zeros((count,height,width),np.float32)
    for e in events:
        if e.get('shape') not in ('circle','cone','rectangle'):raise ValueError('Shape must be circle, cone or rectangle')
        nums=[e.get('start',0),e.get('impact',2),e.get('end',3),e.get('x',.5),e.get('y',.55),e.get('radius',.2),e.get('angle',-90),e.get('spread',60)]
        if not np.isfinite(nums).all() or not 0<=nums[0]<nums[1]<nums[2] or not 0<=nums[3]<=1 or not 0<=nums[4]<=1 or not 0<nums[5]<=1:
            raise ValueError('Invalid telegraph geometry or start < impact < end timing')
    for i in range(count):
        t=i/fps
        for e in events:
            start,impact,end=e['start'],e['impact'],e['end']
            if not start<=t<end:continue
            im=Image.new('L',(width,height));d=ImageDraw.Draw(im)
            x=e.get('x',.5)*width;y=e.get('y',.55)*height;r=e.get('radius',.2)*min(width,height)
            if e['shape']=='circle':d.ellipse((x-r,y-r,x+r,y+r),fill=255)
            elif e['shape']=='rectangle':d.rectangle((x-r,y-r/2,x+r,y+r/2),fill=255)
            else:
                a=math.radians(e.get('angle',-90));spread=math.radians(e.get('spread',60))/2
                pts=[(x,y)]+[(x+r*math.cos(v),y+r*math.sin(v)) for v in np.linspace(a-spread,a+spread,30)]
                d.polygon(pts,fill=255)
            area=np.asarray(im,dtype=np.float32)/255
            energy=(.2+.65*(t-start)/(impact-start)) if t<impact else max(0,1-(t-impact)/(end-impact))
            masks[i]=np.maximum(masks[i],area*energy)
            color=np.array([1.,.15,.025]) if t>=impact else np.array([1.,.6,.08])
            output[i]=np.maximum(output[i],area[...,None]*color*energy)
    meta={'schema':'haggs-telegraph/v1','fps':fps,'frames':count,'width':width,'height':height,
          'telegraphs':events,'note':'These planned shapes/times are authoritative design data; generated visual motion does not define collisions.'}
    return output,masks,meta


def atlas(images,mask=None,tile_size=128,columns=8):
    a=np.asarray(images,np.float32)
    if a.ndim!=4 or a.shape[-1]!=3 or not 1<=len(a)<=600:raise ValueError('Atlas needs 1–600 RGB frames')
    if not 16<=tile_size<=512 or not 1<=columns<=32:raise ValueError('Invalid atlas dimensions')
    rows=math.ceil(len(a)/columns)
    if columns*tile_size*rows*tile_size>64_000_000:raise ValueError('Atlas too large; reduce tile size')
    masks=None if mask is None else np.asarray(mask,np.float32)
    if masks is not None and masks.ndim==2:masks=masks[None]
    if masks is not None and (masks.ndim!=3 or not len(masks)):raise ValueError('Alpha mask must be H,W or T,H,W')
    result=Image.new('RGBA',(columns*tile_size,rows*tile_size));rects=[]
    for i,frame in enumerate(a):
        im=Image.fromarray((np.clip(frame,0,1)*255).astype('uint8')).convert('RGBA')
        if masks is not None:
            alpha=Image.fromarray((np.clip(masks[min(i,len(masks)-1)],0,1)*255).astype('uint8')).resize(im.size,Image.Resampling.NEAREST)
            im.putalpha(alpha)
        im.thumbnail((tile_size,tile_size),Image.Resampling.LANCZOS)
        cell=Image.new('RGBA',(tile_size,tile_size));ox=(tile_size-im.width)//2;oy=(tile_size-im.height)//2;cell.paste(im,(ox,oy))
        x=(i%columns)*tile_size;y=(i//columns)*tile_size;result.paste(cell,(x,y))
        rects.append({'frame':i,'x':x,'y':y,'width':tile_size,'height':tile_size})
    return result,rects


def safe_slug(text):
    return re.sub(r'[^a-zA-Z0-9_-]+','-',str(text)).strip('-')[:60] or 'asset'


def branch_html(labels):
    if len(labels)!=3:raise ValueError('Three branch labels are required')
    # Escape < to prevent user labels from closing the script element.
    encoded=json.dumps([str(x)[:120] for x in labels]).replace('<','\\u003c')
    return '''<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>Haggs — Playable Scene Forge</title><style>body{background:#10131b;color:#eef;font:16px system-ui;margin:20px}video{width:100%;max-height:65vh;background:#000}button{padding:12px;margin:6px;border:0;border-radius:8px;cursor:pointer;background:#a9f4dc}#status{color:#abc}</style>
<h2>Playable Scene Forge</h2><video id="v" controls playsinline></video><div id="choices"></div><p id="status">Choose an action. These are prepared video branches.</p><button id="reset">Return to choices</button>
<script>const labels='''+encoded+''';const v=document.getElementById('v'),c=document.getElementById('choices'),s=document.getElementById('status');labels.forEach((label,i)=>{const b=document.createElement('button');b.textContent=label;b.onclick=()=>{v.src='branch-'+i+'.mp4';v.play().catch(()=>{});s.textContent='Choice: '+label;};c.append(b)});document.getElementById('reset').onclick=()=>{v.pause();v.removeAttribute('src');v.load();s.textContent='Choose another prepared branch.'};v.onended=()=>{s.textContent='Outcome reached. Choose another action or return to choices.'};</script>'''


def output_descriptor(directory_name, filename):
    """Comfy history file descriptor for a generated artifact, never an absolute path."""
    if not re.fullmatch(r'[a-zA-Z0-9_-]{1,100}',directory_name): raise ValueError('Invalid output directory')
    if filename not in {'atlas.png','atlas.json','branch-0.mp4','branch-1.mp4','branch-2.mp4','branches.json'}: raise ValueError('Invalid output filename')
    return {'filename':filename,'subfolder':'haggs-game-director/'+directory_name,'type':'output'}
