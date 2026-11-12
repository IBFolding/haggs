import {test} from 'node:test';
import assert from 'node:assert/strict';
import {productionPack,readProductionPack} from './production-pack';
import {restoreMediaEnvelope} from './media-bundle';
import {createProject,newShot} from './model';
import {importBundle} from './transfer';
import {zipFiles} from '../comic/archive';
const data='data:image/png;base64,aGVsbG8=';
function fixture(){return {...createProject('Production <script>'),shots:[{...newShot(),heading:'Meet <script>',beat:'They meet.',refs:[data],render:{url:data,kind:'image' as const,usd:0,promptHash:'x',at:1}}]};}

test('production ZIP preserves editable boards, deduplicates media and restores into a new project',async()=>{
 const source=fixture(),bytes=await productionPack(source),envelope=await readProductionPack(bytes);
 assert.equal(Object.keys((envelope.mediaBundle as {files:object}).files).length,1);
 let uploads=0;
 const restored=await restoreMediaEnvelope(envelope,async file=>{uploads++;assert.equal(await file.text(),'hello');return {ok:true,url:'/api/local/restored.png'};});
 const bundle=importBundle(JSON.stringify(restored));
 assert.notEqual(bundle.project.id,source.id);
 assert.equal(bundle.project.boards![0]!.shots[0]!.render!.url,'/api/local/restored.png');
 assert.equal(uploads,1);
 const text=new TextDecoder().decode(bytes);
 assert.ok(text.includes('script.md'));
 assert.ok(text.includes('continuity.json'));
 assert.ok(text.includes('Meet &lt;script&gt;'));
 assert.ok(!text.includes('<h2>1. Meet <script>'));
});
test('pack refuses damaged media before restore and rejects incomplete ZIPs',async()=>{
 const bytes=await productionPack(fixture());
 const needle=new TextEncoder().encode('hello');let at=-1;
 for(let i=0;i<bytes.length-needle.length;i++)if(needle.every((b,j)=>bytes[i+j]===b)){at=i;break;}
 assert.ok(at>=0);bytes[at]=0;
 await assert.rejects(()=>readProductionPack(bytes),/integrity/);
 await assert.rejects(()=>readProductionPack(bytes.subarray(0,50)),/ZIP|size/);
});
test('pack strips known runtime credentials and records external dependencies',async()=>{
 const source={...fixture(),apiKey:'fixture-only-secret',notes:[{id:'n',text:'Remote https://example.com/art.png',x:0,y:0}]};
 const bytes=await productionPack(source);
 assert.ok(!new TextDecoder().decode(bytes).includes('fixture-only-secret'));
 const restored=await readProductionPack(bytes);
 assert.equal('apiKey' in (restored.project as object),false);
 assert.ok(new TextDecoder().decode(bytes).includes('https://example.com/art.png'));
});
test('import refuses unknown archives and duplicate attachment paths',async()=>{
 const bytes=zipFiles([{name:'project.haggs.json',bytes:new TextEncoder().encode('{}')},{name:'project.haggs.json',bytes:new Uint8Array()}]);
 await assert.rejects(()=>readProductionPack(bytes),/duplicate/);
});

test('inaccessible stored media stops export rather than producing a misleading portable pack',async()=>{
 const source=fixture();source.shots[0]!.refs=['/api/local/missing.png'];
 await assert.rejects(()=>productionPack(source,undefined,async()=>new Response(null,{status:401})),/could not be bundled/);
});
