import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {runGreyAssetImage,runGreyFinishing} from '../app/grey-legacy-actions';
test('legacy Grey cloud actions reject before reading credentials or submitting',async()=>{
 const image=await runGreyAssetImage('bfl/flux-3-image','fixture',{});const finishing=await runGreyFinishing({tool:'aleph',video:'https://fixture.invalid',seconds:1,prompt:'fixture'});
 for(const r of [image,finishing]){assert.equal(r.ok,false);if(!r.ok)assert.match(r.reason,/maximum charge/);}
});
test('legacy Grey panels cannot import general paid action entry points',()=>{
 for(const file of ['assets-panel','surfaces-panel','render-panel','grey-studio']){
  const source=readFileSync(`src/app/board/[id]/grey/[shot]/${file}.tsx`,'utf8');
  assert.doesNotMatch(source,/import \{[^}]*\b(?:run|runEdit|runWorkflow|quoteWorkflow)\b[^}]*\} from "\.\.\/\.\.\/\.\.\/\.\.\/(?:actions|workflow-actions)"/);
  assert.match(source,/grey-legacy-actions/);
 }
});
