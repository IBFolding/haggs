import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { changePathPoints, parseTimeline, updateTimeline } from './timeline-data';
import { openHaggsPreviewForDisplay } from '../../../server/haggs-preview-workflows';

const names = ['haggs_preview_drag_to_action','haggs_preview_boss_fight','haggs_preview_moveset','haggs_preview_enemy_intent','haggs_preview_vfx_mask','haggs_preview_vfx_reuse'];
test('bundled visual timelines preserve all other graph values when edited', () => {
  for (const name of names) {
    const field = openHaggsPreviewForDisplay(name).app.fields.find(f => f.kind === 'text' && f.input === 'timeline_json');
    assert.ok(field && field.kind === 'text', name);
    const raw = String(field.value), parsed = parseTimeline(raw);
    assert.ok(parsed, name);
    const item = parsed.items[0];
    assert.ok(item, name);
    const path = Array.isArray(item.path) ? ['path',0,1] : ['start'];
    const original = JSON.parse(raw);
    const updated = updateTimeline(raw, 0, path, 0.42);
    assert.ok(updated, name);
    const expected = structuredClone(original);
    if (path[0] === 'path') expected[parsed.group][0].path[0][1] = 0.42;
    else expected[parsed.group][0].start = 0.42;
    assert.deepEqual(JSON.parse(updated), expected, name);
  }
});
test('adding and removing positions preserves the rest of the workflow',()=>{
 const original={actors:[{name:'hero',path:[[2,.3,.4],[0,.1,.2]],events:[{start:0,end:3,action:'walk'}]}],other:'kept'};
 const added=changePathPoints(JSON.stringify(original),0);
 assert.ok(added);
 const expected=structuredClone(original); expected.actors[0]!.path.push([3,.3,.4]);
 assert.deepEqual(JSON.parse(added),expected);
 const removed=changePathPoints(added,0,1);assert.ok(removed);
 expected.actors[0]!.path.splice(1,1);assert.deepEqual(JSON.parse(removed),expected);
 assert.equal(changePathPoints(JSON.stringify({actors:[{path:[[0,.5,.5]]}]}),0,0),null);
 assert.equal(changePathPoints(JSON.stringify({actors:[{path:[[0,.5,.5],[0,.1,.1]]}]}),0),null);
 assert.equal(changePathPoints(JSON.stringify(original),0,20),null);
});
test('invalid or unsupported timelines and unsafe paths do not get rewritten', () => {
  assert.equal(parseTimeline('{'), null);
  assert.equal(parseTimeline('{"other":[]}'), null);
  assert.equal(updateTimeline('{"actors":[{}]}',0,['__proto__','polluted'],1), null);
  assert.equal(updateTimeline('{"actors":[{"start":0}]}',0,['start'],NaN), null);
  assert.equal(updateTimeline('{"actors":[{"start":0}]}',1,['start'],1), null);
});
