import test from 'node:test';
import assert from 'node:assert/strict';
import { addContestMasks, contestMaskFields } from './contest-masks';
import type { ApiPrompt } from './convert';
const original: ApiPrompt = {'10000':{class_type:'HaggsPortalPaint',inputs:{generated_video:['1',0]}}};
test('optional masks add explicit red-channel nodes and retain the source graph', () => {
  const result = addContestMasks(original, {'haggs_subject_mask/image':'subject.png','haggs_region_mask/image':'region.png','haggs_band_map/image':'bands.png'});
  assert.deepEqual(result['10000']!.inputs.subject_mask,['haggs_subject_mask_red',0]);
  assert.deepEqual(result['10000']!.inputs.region_mask,['haggs_region_mask_red',0]);
  assert.deepEqual(result['10000']!.inputs.band_map,['haggs_band_map',0]);
  assert.equal(result['haggs_subject_mask_red']!.inputs.channel,'red');
  assert.equal(original['10000']!.inputs.subject_mask,undefined);
  assert.equal(contestMaskFields.length,3);
  assert.deepEqual(addContestMasks(original,{}),original);
});
test('masks reject unsafe file names, wrong graph and node collisions', () => {
  assert.throws(()=>addContestMasks(original,{'haggs_region_mask/image':'../../bad.png'}));
  assert.throws(()=>addContestMasks({}, {'haggs_region_mask/image':'mask.png'}));
  assert.throws(()=>addContestMasks({...original,haggs_region_mask:{class_type:'Other',inputs:{}}}, {'haggs_region_mask/image':'mask.png'}));
});
