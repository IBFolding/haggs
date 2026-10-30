import test from 'node:test';
import assert from 'node:assert/strict';
import { addContestMasks, contestMaskFields, contestMaskFieldsFor } from './contest-masks';
import type { ApiPrompt } from './convert';
const original: ApiPrompt = {'10000':{class_type:'HaggsPortalPaint',inputs:{generated_video:['1',0]}}};
test('optional masks add explicit red-channel nodes and retain the source graph', () => {
  const result = addContestMasks(original, {'haggs_subject_mask/image':'subject.png','haggs_region_mask/image':'region.png'});
  assert.deepEqual(result['10000']!.inputs.subject_mask,['haggs_subject_mask_red',0]);
  assert.deepEqual(result['10000']!.inputs.region_mask,['haggs_region_mask_red',0]);
  const world = addContestMasks({'10000':{class_type:'HaggsWorldOrchestra',inputs:{}}}, {'haggs_band_map/image':'bands.png'});
  assert.deepEqual(world['10000']!.inputs.band_map,['haggs_band_map',0]);
  assert.equal(result['haggs_subject_mask_red']!.inputs.channel,'red');
  assert.equal(original['10000']!.inputs.subject_mask,undefined);
  assert.equal(contestMaskFields.length,4);
  assert.deepEqual(addContestMasks(original,{}),original);
});
test('only effect-specific image controls are available and unsupported submissions fail closed', () => {
  const expected: Record<string,string[]> = {
    HaggsWorldOrchestra:['haggs_subject_mask','haggs_subject_mask_video','haggs_band_map'],
    HaggsImpossibleDuet:['haggs_subject_mask','haggs_subject_mask_video'], HaggsPortalPaint:['haggs_subject_mask','haggs_subject_mask_video','haggs_region_mask'],
    HaggsRealityScrubber:['haggs_subject_mask','haggs_subject_mask_video'], HaggsFoleyOrchestra:[],
    HaggsFutureEcho:['haggs_subject_mask','haggs_subject_mask_video'], HaggsMotionBecomesMatter:['haggs_subject_mask','haggs_subject_mask_video'],
  };
  for (const [type, allowed] of Object.entries(expected)) {
    assert.deepEqual(contestMaskFieldsFor(type).map(f=>f.node),allowed);
    for (const field of contestMaskFields) {
      const value = {[`${field.node}/${field.input}`]:'mask.png'};
      const prompt: ApiPrompt = {'10000':{class_type:type,inputs:{}}};
      if (allowed.includes(field.node)) assert.doesNotThrow(()=>addContestMasks(prompt,value));
      else assert.throws(()=>addContestMasks(prompt,value),/not supported/);
    }
  }
  assert.deepEqual(contestMaskFieldsFor('unknown'),[]);
});
test('tracked subject video is decoded to a mask and cannot be combined with a still subject mask', () => {
  const result = addContestMasks(original, {'haggs_subject_mask_video/video':'tracked.mp4'});
  assert.deepEqual(result['haggs_subject_mask_video_frames']?.inputs.video,['haggs_subject_mask_video',0]);
  assert.deepEqual(result['haggs_subject_mask_video_red']?.inputs.image,['haggs_subject_mask_video_frames',0]);
  assert.deepEqual(result['10000']?.inputs.subject_mask,['haggs_subject_mask_video_red',0]);
  assert.throws(()=>addContestMasks(original,{'haggs_subject_mask/image':'still.png','haggs_subject_mask_video/video':'tracked.mp4'}),/either/);
});
test('masks reject unsafe file names, wrong graph and node collisions', () => {
  assert.throws(()=>addContestMasks(original,{'haggs_region_mask/image':'../../bad.png'}));
  assert.throws(()=>addContestMasks({}, {'haggs_region_mask/image':'mask.png'}));
  assert.throws(()=>addContestMasks({...original,haggs_region_mask:{class_type:'Other',inputs:{}}}, {'haggs_region_mask/image':'mask.png'}));
});
