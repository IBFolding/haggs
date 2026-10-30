import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {GAME_DIRECTOR_PREVIEW_OUTPUTS} from './game-director-managed';
test('preview output inventory matches the six bundled graphs',async()=>{
 for(const [name,outputs] of Object.entries(GAME_DIRECTOR_PREVIEW_OUTPUTS)){
  const graph=JSON.parse(await readFile(`public/workflows/game-director/workflows/preview-no-model/${name}.json`,'utf8')) as {nodes:{id:number;type:string}[]};
  for(const output of outputs){const node=graph.nodes.find(n=>String(n.id)===output.node);assert.ok(node,`${name}: missing node ${output.node}`);assert.equal(node.type,output.type==='video'?'SaveVideo':output.type==='atlas-and-metadata'?'HaggsAtlasExport':'HaggsBranchPlayer');}
 }
 assert.equal(Object.keys(GAME_DIRECTOR_PREVIEW_OUTPUTS).length,6);
});
