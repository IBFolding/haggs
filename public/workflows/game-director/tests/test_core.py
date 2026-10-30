import importlib.util,json
from pathlib import Path
import numpy as np
import pytest
p=Path(__file__).parents[1]/'custom_nodes/ComfyUI-HaggsGameDirector/core.py'
s=importlib.util.spec_from_file_location('core',p);c=importlib.util.module_from_spec(s);s.loader.exec_module(c)

@pytest.mark.parametrize('action',c.ACTIONS)
def test_each_action_renders_a_nonempty_bounded_guide(action):
    plan={'actors':[{'path':[[0,.3,.5],[1,.7,.5]],'events':[{'start':0,'end':1,'action':action}]}]}
    out,meta=c.render_poses(json.dumps(plan),128,96,24)
    assert out.shape==(24,96,128,3) and out.dtype==np.float32
    assert np.isfinite(out).all() and out.max()<=1 and out.min()>=0
    assert out.sum()>0 and meta['planning_only'] is True


def test_two_actor_combat_renders_more_pixels():
    a={'path':[[0,.25,.55]],'events':[]}
    b={'path':[[0,.75,.55]],'events':[]}
    one,_=c.render_poses(json.dumps({'actors':[a]}),128,96,1)
    two,_=c.render_poses(json.dumps({'actors':[a,b]}),128,96,1)
    assert two.sum()>one.sum()


@pytest.mark.parametrize('path',[[[0,2,.5]],[[0,.5,.5],[0,.6,.5]],[[float('nan'),.5,.5]]])
def test_invalid_paths_fail(path):
    with pytest.raises(ValueError):c.path_points(path)


def test_invalid_action_fails():
    with pytest.raises(ValueError):c.validate_events([{'start':0,'end':1,'action':'invented'}])


@pytest.mark.parametrize('shape',['circle','cone','rectangle'])
def test_telegraph_has_exact_inactive_and_active_intervals(shape):
    plan={'telegraphs':[{'shape':shape,'start':.25,'impact':.5,'end':.75}]}
    out,mask,meta=c.telegraph(json.dumps(plan),128,96,24)
    assert not out[:6].any() and not mask[:6].any()
    assert out[12].sum()>out[6].sum()
    assert not out[18:].any() and not mask[18:].any()
    assert 'authoritative' in meta['note']


def test_edge_guide_constant_scene_is_empty():
    assert not c.edge_guide(np.ones((2,12,16,3),np.float32)).any()


def test_edge_guide_finds_boundary():
    a=np.zeros((2,12,16,3),np.float32);a[:,:,8:]=1
    edges=c.edge_guide(a)
    assert edges[:,:,8].min()==1


def test_hud_restoration_preserves_only_selected_stripe():
    generated=np.zeros((2,20,20,3),np.float32);source=np.ones_like(generated)
    out=c.restore_hud(generated,source,top_fraction=.2)
    assert out[:,:4].min()==1 and not out[:,4:].any()


def test_custom_hud_mask():
    generated=np.zeros((2,20,20,3),np.float32);source=np.ones_like(generated);mask=np.zeros((20,20));mask[5:10,5:10]=1
    out=c.restore_hud(generated,source,mask=mask)
    assert out[:,5:10,5:10].min()==1 and not out[:,:5].any()


def test_subpixel_bottom_stripe_does_not_replace_entire_video():
    g=np.zeros((1,20,20,3),np.float32);s=np.ones_like(g)
    assert not c.restore_hud(g,s,top_fraction=0,bottom_fraction=.001).any()


def test_atlas_cells_preserve_alpha_and_count():
    images=np.ones((3,16,32,3),np.float32);mask=np.zeros((3,16,32));mask[:,:,8:24]=1
    sheet,rects=c.atlas(images,mask,32,2)
    assert sheet.size==(64,64) and len(rects)==3
    alpha=np.asarray(sheet)[...,3]
    assert alpha.max()==255 and alpha.min()==0


def test_branch_player_uses_prepared_local_media_and_escaped_labels():
    html=c.branch_html(['Door','</script><img src=x>','Flee'])
    assert 'branch-' in html and 'https://' not in html
    assert '</script><img' not in html and '\\u003c' in html


def test_output_slug_cannot_escape_directory():
    assert '/' not in c.safe_slug('../../outside')


def test_memory_budget_rejects_huge_guide():
    with pytest.raises(ValueError):c.size_check(1920,1080,600)
