import importlib.util,json
from pathlib import Path
import numpy as np
import pytest
ROOT=Path(__file__).parents[1]
s=importlib.util.spec_from_file_location('core',ROOT/'custom_nodes/ComfyUI-HaggsStudio/core.py');c=importlib.util.module_from_spec(s);s.loader.exec_module(c)

def fx(kind='portal'):
 return json.dumps({'effects':[{'type':kind,'start':.25,'end':.75,'radius':.2,'path':[[0,.2,.5],[1,.8,.5]]}]})

@pytest.mark.parametrize('kind',['portal','burst','trail','beam'])
def test_effects_are_timed_and_bounded(kind):
 m,meta=c.timeline_masks(fx(kind),24,128,96)
 assert m.shape==(24,96,128) and np.isfinite(m).all()
 assert not m[:6].any() and not m[18:].any()
 assert m[8:16].sum()>0 and 0<=m.min()<=m.max()<=1
 assert meta['effects'][0]['type']==kind


def test_pixel_lock_is_exact_outside_mask():
 rng=np.random.default_rng(1);a=rng.random((3,20,20,3),dtype=np.float32);b=rng.random(a.shape,dtype=np.float32);m=np.zeros((3,20,20),np.float32);m[:,6:12,7:13]=.5
 out=c.composite_locked(a,b,m)
 np.testing.assert_array_equal(out[m==0],a[m==0])
 np.testing.assert_allclose(out[m>0],(a[m>0]+b[m>0])*.5)


def test_follow_tracking_centroid_moves_region():
 plan=json.loads(fx());plan['effects'][0]['follow_tracking']=True
 track=np.zeros((24,96,128));track[:,30:40,90:100]=1
 m,_=c.timeline_masks(json.dumps(plan),24,128,96,tracking=track,feather=0)
 yy,xx=np.where(m[12]>0);assert xx.mean()>85 and yy.mean()<45


def test_follow_tracking_without_mask_fails():
 plan=json.loads(fx());plan['effects'][0]['follow_tracking']=True
 with pytest.raises(ValueError):c.timeline_masks(json.dumps(plan),24,128,96)


@pytest.mark.parametrize('bad',[{'type':'invented','start':0,'end':1},{'type':'portal','start':1,'end':0},{'type':'portal','start':0,'end':1,'path':[[0,4,0]]}])
def test_invalid_events_fail(bad):
 with pytest.raises(ValueError):c.timeline_masks(json.dumps({'effects':[bad]}),24,128,96)


def test_motion_preserves_root_translation_and_full_fps():
 points=np.load(ROOT/'input/haggs-studio-synthetic-motion.npz')['keypoints3d']
 guides,retimed,meta=c.motion_to_guides(points,5,128,96)
 assert (len(guides)-5)%17==0 and meta['output_fps']==24
 assert retimed[-1,0,0]>retimed[0,0,0]+.4
 assert guides.shape[1:]==(96,128,3) and np.isfinite(guides).all()


def test_speed_changes_duration():
 points=np.load(ROOT/'input/haggs-studio-synthetic-motion.npz')['keypoints3d']
 a,_,_=c.motion_to_guides(points,5,128,96,speed=1)
 b,_,_=c.motion_to_guides(points,5,128,96,speed=2)
 assert len(b)<len(a)


def test_degenerate_motion_is_rejected():
 with pytest.raises(ValueError):c.motion_to_guides(np.zeros((30,22,3)),1,128,96)


def test_effect_selection_keeps_prompts_separate():
 plan=json.loads(fx());plan["effects"].append({"type":"burst","start":1,"end":2,"description":"fire"})
 selected=json.loads(c.select_effects(json.dumps(plan),1))
 assert len(selected["effects"])==1 and selected["effects"][0]["description"]=="fire"
 assert len(json.loads(c.select_effects(json.dumps(plan),-1))["effects"])==2
 with pytest.raises(ValueError):c.select_effects(json.dumps(plan),9)
