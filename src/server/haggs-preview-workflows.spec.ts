import assert from 'node:assert/strict';
import test from 'node:test';
import { HAGGS_PREVIEWS } from '../comfy/haggs-preview';
import { prepare, validate } from '../comfy/convert';
import fixture from '../comfy/fixtures/haggs-preview.catalog.json';
import type { Catalog } from '../comfy/convert';
import { isSavedHaggsPreview, openHaggsPreview, openHaggsPreviewForDisplay, previewTemplate } from './haggs-preview-workflows';

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
test('only the exact saved no-model graphs retain CPU eligibility', () => {
  for (const item of HAGGS_PREVIEWS) {
    const graph = previewTemplate(item.name)!;
    assert.equal(isSavedHaggsPreview(JSON.stringify(graph)), true);
    graph.nodes.push({id:99999,type:'KSampler'});
    assert.equal(isSavedHaggsPreview(JSON.stringify(graph)), false);
  }
  assert.equal(isSavedHaggsPreview('not json'), false);
});
