import assert from 'node:assert/strict';
import test from 'node:test';
import { HAGGS_PREVIEWS } from '../comfy/haggs-preview';
import { prepare, validate } from '../comfy/convert';
import { fill } from '../comfy/apps';
import fixture from '../comfy/fixtures/haggs-preview.catalog.json';
import type { Catalog } from '../comfy/convert';
import { isSavedHaggsPreview, openHaggsPreview, openHaggsPreviewForDisplay, previewInputProblem, previewTemplate } from './haggs-preview-workflows';

for (const item of HAGGS_PREVIEWS) test(`${item.title} opens as a no-model video preview`, () => {
  const opened = openHaggsPreview(item.name, fixture as unknown as Catalog);
  const display = openHaggsPreviewForDisplay(item.name);
  const converted = prepare(opened.ui, opened.catalog);
  assert.deepEqual(opened.problems, []);
  assert.deepEqual(validate(converted.prompt, opened.catalog), []);
  assert.equal(opened.app.produces, 'video');
  assert.ok(opened.app.output);
  assert.equal(display.app.output, opened.app.output);
  assert.ok(!Object.values(converted.prompt).some(node => node.class_type === 'HaggsAtlasExport'), 'the form does not create an atlas it cannot return');
  assert.ok(!opened.app.fields.some(field => field.input === 'scene' || field.input === 'style'), 'do not expose prompts that do not affect this preview');
});
test('unknown workflow names cannot select arbitrary files', () => {
  assert.equal(previewTemplate('../outside'), null);
  assert.equal(previewTemplate('toString'), null);
});
test('saved motion guide applies the selected file and motion controls', () => {
  const opened = openHaggsPreview('haggs_preview_saved_motion', fixture as unknown as Catalog);
  const {prompt} = prepare(opened.ui, opened.catalog);
  const edited = fill(prompt, opened.app, {'1/file':'my-motion.npz', '1/duration':3, '900/yaw_degrees':30, '900/speed':2});
  assert.equal(edited['1']?.inputs.file, 'my-motion.npz');
  assert.equal(edited['1']?.inputs.duration, 3);
  assert.equal(edited['900']?.inputs.yaw_degrees, 30);
  assert.equal(edited['900']?.inputs.speed, 2);
});
test('room recording app passes the session identifier to the recorded room node', () => {
  const opened = openHaggsPreview('haggs_preview_room_recording', fixture as unknown as Catalog);
  const {prompt} = prepare(opened.ui, opened.catalog);
  const edited = fill(prompt, opened.app, {'1/value':'0123456789abcdef0123456789abcdef'});
  assert.equal(edited['1']?.inputs.value, '0123456789abcdef0123456789abcdef');
  assert.deepEqual(edited['2']?.inputs.session_id, ['1',0]);
  assert.equal(edited['2']?.class_type, 'HaggsRecordedRoom');
  assert.ok(previewInputProblem('haggs_preview_room_recording', {}));
  assert.ok(previewInputProblem('haggs_preview_room_recording', {'1/value':'../../not-a-session'}));
  assert.equal(previewInputProblem('haggs_preview_room_recording', {'1/value':'0123456789abcdef0123456789abcdef'}), null);
});
test('only the exact saved no-model graphs retain CPU eligibility', () => {
  for (const item of HAGGS_PREVIEWS) {
    const graph = previewTemplate(item.name)!;
    assert.equal(isSavedHaggsPreview(JSON.stringify(graph)), true);
    graph.nodes.push({id:99999,type:'KSampler'});
    assert.equal(isSavedHaggsPreview(JSON.stringify(graph)), false);
  }
  assert.equal(isSavedHaggsPreview('not json'), false);
});
