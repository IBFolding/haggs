import importlib.util
from pathlib import Path
import numpy as np
import pytest

p=Path(__file__).parents[1]/'custom_nodes/ComfyUI-HaggsContestLab/effects.py'
s=importlib.util.spec_from_file_location('effects',p); fx=importlib.util.module_from_spec(s);s.loader.exec_module(fx)

@pytest.fixture
def clips():
 rng=np.random.default_rng(42)
 return rng.random((24,32,48,3),dtype=np.float32),rng.random((24,32,48,3),dtype=np.float32)

@pytest.mark.parametrize('effect',fx.EFFECTS)
def test_every_effect_produces_finite_bounded_frames(clips,effect):
 generated,source=clips
 out=fx.composite(effect,generated,source,fps=24)
 assert out.shape==generated.shape
 assert out.dtype==np.float32
 assert np.isfinite(out).all() and out.min()>=0 and out.max()<=1
 assert not np.array_equal(out,source)

@pytest.mark.parametrize('effect',['world_orchestra','portal_paint','reality_scrubber','motion_becomes_matter'])
def test_foreground_is_preserved(clips,effect):
 generated,source=clips
 mask=np.zeros((24,32,48),np.float32);mask[:,8:24,12:36]=1
 out=fx.composite(effect,generated,source,subject_mask=mask)
 np.testing.assert_array_equal(out[:,8:24,12:36],source[:,8:24,12:36])


def test_silent_audio_does_not_create_fake_band_energy():
 bands,_,_=fx.reactive_bands(np.zeros(24000),24000,24,24,120)
 assert not bands.any()


def test_frequency_mapping_distinguishes_low_and_high():
 sr=22050;t=np.arange(sr)/sr
 low,_,_=fx.reactive_bands(np.sin(2*np.pi*90*t),sr,24,24,120)
 high,_,_=fx.reactive_bands(np.sin(2*np.pi*5000*t),sr,24,24,120)
 assert low[:,0].mean()>.8
 assert high[:,2].mean()>.8
 assert low[:,2].mean()<.1
 assert high[:,0].mean()<.1


def test_explicit_beats_and_offset():
 assert fx.beat_indices(24,24,120,times='0, 0.5, 4')==[0,12]
 assert fx.beat_indices(24,24,120,offset=.25)==[6,18]


def test_invalid_beats_are_rejected():
 with pytest.raises(ValueError):fx.beat_indices(24,24,120,times='oops')
 with pytest.raises(ValueError):fx.beat_indices(24,24,120,times='nan')


def test_no_wrap_translation():
 a=np.ones((4,4,1),np.float32)
 assert not fx.shift(a,2)[:,:2].any()
 assert not fx.shift(a,5).any()


def test_schedule_reaches_original_and_generated(clips):
 generated,source=clips
 out=fx.composite('reality_scrubber',generated,source,amount=1,schedule='0:0,1:1')
 np.testing.assert_array_equal(out[0],source[0])
 np.testing.assert_array_equal(out[-1],generated[-1])


def test_duplicate_schedule_times_rejected(clips):
 with pytest.raises(ValueError):fx.composite('reality_scrubber',*clips,schedule='0:0,0:1')


def test_zero_portal_mask_preserves_source(clips):
 generated,source=clips
 out=fx.composite('portal_paint',generated,source,region_mask=np.zeros((32,48)))
 np.testing.assert_array_equal(out,source)


def test_foley_aligns_marked_impact_to_beats():
 a=np.zeros((24,8,8,3),np.float32);a[6]=1
 out=fx.composite('foley_orchestra',a,a,fps=24,action_time=.25,beat_times='0,.5')
 assert out[0].min()==1 and out[12].min()==1


def test_static_scene_does_not_create_motion_matter():
 a=np.full((24,8,8,3),.2,np.float32);b=np.ones_like(a)
 np.testing.assert_array_equal(fx.composite('motion_becomes_matter',b,a),a)


def test_resample_holds_last_frame():
 a=np.zeros((2,2,2,3),np.float32);a[1]=1
 b=fx.align(a,6,4,4,source_fps=12,target_fps=24)
 assert b[0].max()==0 and b[1].max()==0 and b[-1].min()==1


def test_audit_calls_out_its_limits():
 a=np.zeros((4,8,8,3),np.float32)
 r=fx.audit(a,24)
 assert r['near_static_pair_fraction']==1
 assert 'No semantic' in r['interpretation']
