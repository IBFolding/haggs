import test from 'node:test';
import assert from 'node:assert/strict';
import {sceneForgeHtml} from './scene-forge';
const clip='data:video/mp4;base64,AAAA';
test('exports three prepared branches and keeps labels out of executable markup',()=>{
 const html=sceneForgeHtml(['Walk','</script><script>alert(1)</script>','Run'],[clip,clip,clip]);
 assert.equal((html.match(/<script>/g)??[]).length,1);
 assert.ok(html.includes('\\u003c/script>'));
 assert.ok(html.includes('textContent=label'));
 assert.ok(html.includes(clip));
});
test('requires exactly three supported videos',()=>{
 assert.throws(()=>sceneForgeHtml(['a'],[clip]));
 assert.throws(()=>sceneForgeHtml(['a','b','c'],[clip,clip,'data:text/html;base64,AAAA']));
});
