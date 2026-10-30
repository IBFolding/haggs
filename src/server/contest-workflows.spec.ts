import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {test} from 'node:test';
import {CONTEST_EFFECTS, contestName, contestVariant} from '../comfy/contest-lab';
import {contestEntries,contestTemplate,openContest,openContestForDisplay} from './contest-workflows';
import {fill} from '../comfy/apps';
import {toApiPrompt,type Catalog} from '../comfy/convert';
const read=(path:string)=>JSON.parse(readFileSync(new URL(path,import.meta.url),'utf8'));
// Custom schemas extracted literally from the included INPUT_TYPES declarations;
// core catalog fixture plus minimal LoadAudio/primitive declarations. Not a live installation.
const catalog:Catalog={...read('../comfy/fixtures/catalog.json'),...read('../comfy/fixtures/contest-lab.catalog.json'),
 LoadAudio:{input:{required:{audio:['STRING']}},output:['AUDIO']},
 PrimitiveStringMultiline:{input:{required:{value:['STRING',{multiline:true,default:''}]}},output:['STRING']},
};
for(const e of CONTEST_EFFECTS){
 test(`${e.name}: reuse graph converts, fills effect controls and returns video`,()=>{
  const name=contestName(e.slug,'reuse'),opened=openContest(name,catalog);
  const display = openContestForDisplay(name);
  assert.equal(display.entry?.title, opened.entry?.title);
  assert.deepEqual(display.app.fields, opened.app.fields);
  assert.deepEqual(display.problems, []);
  assert.deepEqual(opened.problems,[]);
  assert.equal(opened.app.output,'10004');
  assert.equal(opened.app.produces,'video');
  assert.equal(opened.app.fields.filter(f=>f.kind==='media').length,3);
  const {prompt}=toApiPrompt(opened.ui,catalog);
  const filled=fill(prompt,opened.app,{'10000/amount':0.4,'10000/bpm':90,'10000/beat_times_seconds':'0,0.5'});
  assert.equal(filled['10000']!.inputs.amount,0.4);
  assert.equal(filled['10000']!.inputs.bpm,90);
  assert.equal(filled['10000']!.inputs.beat_times_seconds,'0,0.5');
  assert.throws(()=>fill(prompt,opened.app,{'10000/amount':2}),/out of range/);
  assert.ok(openContest(name,{}).problems.length);
  assert.ok(existsSync(new URL('../../public'+e.image,import.meta.url)));
  assert.ok(existsSync(new URL('../../public'+e.preview,import.meta.url)));
 });
 test(`${e.name}: LTX and paid H3 are distinct; all graph links and embedded subgraphs resolve`,()=>{
  // Incomplete bundled display schemas must not block a real runtime preflight.
  const display = openContestForDisplay(contestName(e.slug, 'ltx'));
  assert.deepEqual(display.problems, []);
  assert.ok(display.app.fields.some(f => f.label === 'Effect layer prompt'));
  for(const path of [e.ltx,e.reuse,e.h3]){
   const ui=read('../../public/workflows/contest-lab/'+path);
   const definitions=new Set((ui.definitions?.subgraphs??[]).map((s:{id:string})=>s.id));
   for(const graph of [ui,...(ui.definitions?.subgraphs??[])]){
    const ids=new Set(graph.nodes.map((n:{id:string|number})=>String(n.id)));
    for(const n of graph.nodes)if(/^[0-9a-f]{8}-/.test(n.type))assert.ok(definitions.has(n.type));
    for(const l of graph.links){assert.ok(ids.has(String(Array.isArray(l)?l[1]:l.origin_id))||String(l.origin_id)==='-10');assert.ok(ids.has(String(Array.isArray(l)?l[3]:l.target_id))||String(l.target_id)==='-20');}
   }
  }
  const ltx=openContest(contestName(e.slug,'ltx'),catalog);
  assert.ok(ltx.problems.length,'partial catalog must refuse missing LTX nodes');
  assert.ok(ltx.app.fields.some(f=>f.node==='251:252'&&f.kind==='text'));
  assert.equal(ltx.app.fields.filter(f=>f.kind==='media').length,4);
  const h3=read('../../public/workflows/contest-lab/'+e.h3);
  assert.equal(h3.nodes.find((n:{type:string})=>n.type==='HaggsH3PromptGate').widgets_values[0],false);
  assert.equal(contestVariant(`haggs_fx_h3_${e.slug}`),undefined,'paid variant is not registered as an app');
 });
}
test('seven grouped effects expose fourteen exact local variants, without duplicate cards',()=>{
 assert.equal(CONTEST_EFFECTS.length,7);assert.equal(contestEntries().length,14);
 assert.equal(new Set(contestEntries().map(e=>e.name)).size,14);
 assert.equal(contestTemplate('../workflows'),null);
 assert.equal(contestTemplate('toString'),null);
 const counts=read('../../public/workflows/contest-lab/DEDUPLICATION.json');
 assert.equal(counts.unique_graphs,22);assert.equal(counts.duplicate_workflow_copies_omitted,30);
});

test('SAM2 helper is an optional download with intact links, not an executable featured app',()=>{
 const ui=read('../../public/workflows/contest-lab/workflows/08-SAM2-tracked-mask-helper.json');
 const ids=new Set(ui.nodes.map((n:{id:number})=>n.id));
 for(const l of ui.links){assert.ok(ids.has(l[1]));assert.ok(ids.has(l[3]));}
 assert.ok(ui.nodes.some((n:{type:string})=>n.type==='DownloadAndLoadSAM2Model'));
 assert.equal(contestVariant('08-SAM2-tracked-mask-helper'),undefined);
});
