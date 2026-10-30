import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { test } from 'node:test';
import { LTX_WORKFLOWS } from '../comfy/ltx';
import { fill } from '../comfy/apps';
import { prepare, type Catalog } from '../comfy/convert';
import { ltxEntries, ltxTemplate, openLtx } from './ltx-workflows';

// A deliberately incomplete catalog checks bindings and fail-closed behavior;
// it is NOT a claim that the full LTX graph is installed or executable.
const catalog: Catalog = {
  ...JSON.parse(readFileSync(new URL('../comfy/fixtures/catalog.json', import.meta.url), 'utf8')),
  PrimitiveStringMultiline: { input: { required: { value: ['STRING', { multiline: true, default: '' }] } }, output: ['STRING'] },
  LoadAudio: { input: { required: { audio: ['STRING'] } }, output: ['AUDIO'] },
};

for (const w of LTX_WORKFLOWS) {
  test(`${w.title}: bundled graph has resolved subgraphs and no API encoding branches`, () => {
    const ui = ltxTemplate(w.name)!;
    assert.ok(ui);
    const definitions = new Set(ui.definitions?.subgraphs?.map(s => s.id));
    for (const graph of [ui, ...(ui.definitions?.subgraphs ?? [])]) {
      const ids = new Set(graph.nodes.map(n => String(n.id)));
      for (const n of graph.nodes) {
        assert.notEqual(n.type, 'GemmaAPITextEncode');
        if (/^[0-9a-f]{8}-/.test(n.type)) assert.ok(definitions.has(n.type));
      }
      for (const l of graph.links) {
        const from = String(Array.isArray(l) ? l[1] : l.origin_id);
        const to = String(Array.isArray(l) ? l[3] : l.target_id);
        assert.ok(ids.has(from) || from === '-10', `missing source ${from}`);
        assert.ok(ids.has(to) || to === '-20', `missing target ${to}`);
      }
    }
    assert.ok(existsSync(new URL('../../public'+w.image, import.meta.url)));
    assert.match(w.sample, /Example:/);
  });
  test(`${w.title}: explicit prompt/media/output bindings and missing-node refusal`, () => {
    const opened = openLtx(w.name, catalog);
    assert.ok(opened.problems.length, 'incomplete catalog must not be reported as runnable');
    const prompt = prepare(opened.ui, catalog).prompt;
    const field = opened.app.fields.find(f => f.kind === 'text')!;
    assert.equal(field.node, w.promptNode);
    const changed = fill(prompt, opened.app, { [`${field.node}/${field.input}`]: 'A deliberate test prompt' });
    assert.equal(changed[field.node]!.inputs.value, 'A deliberate test prompt');
    assert.equal(prompt[field.node]!.class_type, 'PrimitiveStringMultiline');
    assert.equal(prompt[opened.app.output!]!.class_type, 'SaveVideo');
    assert.equal(opened.app.produces, 'video');
    assert.equal(opened.app.fields.filter(f => f.kind === 'media').length, w.name === 'haggs_ltx_repair_cut' || w.name === 'haggs_ltx_action_on_beat' ? 2 : 1);
    if (w.durationNode) {
      assert.ok(opened.app.fields.some(f => f.node === w.durationNode && f.kind === 'number'));
      assert.throws(() => fill(prompt, opened.app, { [`${w.durationNode}/value`]: 1000 }), /out of range/);
    }
    if (w.name === 'haggs_ltx_action_on_beat') assert.ok(opened.app.fields.some(f => f.node === '5601' && f.kind === 'number'));
    const missing = openLtx(w.name, {});
    assert.equal(missing.app.output, null);
    assert.ok(missing.problems.some(p => p.includes('control')));
  });
}
test('bundled lookup is exact, cloned, and keeps distinct frame labels', () => {
  assert.equal(ltxTemplate('../01-repair-this-cut'), null);
  const graph = ltxTemplate(LTX_WORKFLOWS[0].name)!;
  graph.nodes.length = 0;
  const fresh = ltxTemplate(LTX_WORKFLOWS[0].name)!;
  assert.equal(fresh.nodes.find(n => n.id === 31)?.title, 'Last frame of clip A');
  assert.equal(fresh.nodes.find(n => n.id === 39)?.title, 'First frame of clip B');
  assert.equal(ltxEntries().length, 4);
});


test('curated LTX apps refuse unavailable named weights instead of replacing them', () => {
  const mismatch = structuredClone(catalog);
  mismatch.UNETLoader = { input: { required: { unet_name: [['ltx-2.5-a-different-model.safetensors']], weight_dtype: [['default']] } }, output: ['MODEL'] };
  const opened = openLtx('haggs_ltx_repair_cut', mismatch);
  assert.ok(opened.problems.some(p => p.includes('unet_name') && p.includes("isn't one of its choices")));
});
