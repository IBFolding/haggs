import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { ATLAS_LIMITS, atlasFrame, pngSize, readAtlas } from './atlas';
import { atlasDemo } from './atlas-demo';
import { bare, defaultSpec, keepMadeArt, readSpec, slotsOf, withArt, type Art } from './spec';
import { createGameStore } from './store';
import { memoryKv } from '../story/kv';
import { draw } from './render';
import { initGame } from './templates';
import { KIT_SOURCE, srcdoc } from './kit';
import vm from 'node:vm';

const root = new URL('../../public/workflows/game-director/', import.meta.url);
const png = readFileSync(new URL('previews/05-animation-moveset-builder-atlas.png', root));
const report = JSON.parse(readFileSync(new URL('playable-examples/05-animation-moveset-builder-atlas.json', root), 'utf8'));
const atlas = readAtlas(report, 1024, 2048);
const art: Art = { prompt:'guide', shape:'circle', color:'#123456', url:`data:image/png;base64,${png.toString('base64')}`, atlas };

test('provided guide PNG and export-format manifest retain all ordered frames/action ranges', () => {
  assert.deepEqual(pngSize(png), { width:1024, height:2048 });
  assert.equal(atlas.frames.length,124); assert.equal(atlas.fps,24);
  assert.deepEqual(atlas.frames[8], {frame:8,x:0,y:128,width:128,height:128});
  assert.ok(atlas.animations.some(a=>a.name==='hero-walk'));
  assert.equal(atlas.loop,false,'unverified loops are opt-in');
  assert.deepEqual(readAtlas({...report,frames:[...report.frames].reverse()},1024,2048),atlas);
  assert.deepEqual(readAtlas(atlas),atlas,'saved normalized schema is stable');
});

test('frame timing uses exclusive end, clamps one-shot and wraps only an explicit loop', () => {
  const clip = atlas.animations.find(a=>a.name==='hero-walk')!;
  const selected = {...atlas,selected:clip.name};
  assert.equal(atlasFrame(selected,0).frame,clip.start_frame);
  assert.equal(atlasFrame(selected,1/24).frame,clip.start_frame+1);
  assert.equal(atlasFrame(selected,100).frame,clip.end_frame_exclusive-1);
  assert.equal(atlasFrame({...selected,loop:true},(clip.end_frame_exclusive-clip.start_frame)/24).frame,clip.start_frame);
  assert.equal(atlasFrame(selected,-2).frame,clip.start_frame);
  assert.equal(atlasFrame(selected,NaN).frame,clip.start_frame);
});

for (const [name, changes] of Object.entries({
  path:{image:'../../secret.png'}, remote:{image:'https://example.org/a.png'}, fps:{fps:Infinity}, slow:{fps:0},
  duplicate:{frames:[report.frames[0],report.frames[0]]}, missing:{frames:report.frames.slice(1)},
  outside:{frames:[{frame:0,x:1000,y:0,width:128,height:128}]}, fractional:{frames:[{frame:0,x:.5,y:0,width:128,height:128}]},
  tooMany:{frames:Array.from({length:ATLAS_LIMITS.frames+1},(_,frame)=>({...report.frames[0],frame}))},
  actions:{animations:[{name:'bad',start_frame:4,end_frame_exclusive:4}]}, scriptName:{animations:[{name:'<script>',start_frame:0,end_frame_exclusive:1}]},
  selected:{selected:'missing'}, loop:{loop:'yes'}, version:{version:2}
})) test(`reject malformed atlas: ${name}`,()=>assert.throws(()=>readAtlas({...report,...changes},1024,2048)));

test('PNG signature and dimensions are checked before decode; unrelated JSON is stripped',()=>{
  assert.throws(()=>pngSize(new TextEncoder().encode('<svg onload="alert(1)"></svg>')));
  const huge=Uint8Array.from(png);new DataView(huge.buffer).setUint32(16,99999);assert.throws(()=>pngSize(huge));
  assert.throws(()=>readAtlas(report,8192,8192),/million/);
  assert.equal('script' in readAtlas({...report,script:'alert(1)',timeline:{url:'https://bad.test'}},1024,2048),false);
});

test('atlas persists, survives prompt-preserving edits, undoes and is stripped from model requests',async()=>{
  const kv=memoryKv();const store=createGameStore(kv,()=>1,()=> 'atlas-test');
  const original=defaultSpec('runner'); const made=withArt(original,'player',art);
  const game=await store.create(original);await store.change(game.id,made);
  const loaded=await createGameStore(kv).get(game.id);
  assert.deepEqual(slotsOf(loaded!.spec)[0]!.art.atlas,atlas);
  assert.equal(slotsOf(keepMadeArt(made,bare(made)))[0]!.art.atlas?.frames.length,124);
  assert.doesNotMatch(JSON.stringify(bare(made)),/base64|start_frame|timeline/);
  assert.equal(slotsOf((await store.undo(game.id))!.spec)[0]!.art.atlas,undefined);
  assert.equal(slotsOf(withArt(made,'player',{url:undefined}))[0]!.art.atlas,undefined);
  assert.equal(slotsOf(withArt(made,'player',{url:'https://example.org/photo.png'}))[0]!.art.atlas,undefined);
  assert.throws(()=>readSpec(withArt(original,'background',art)),/sprite slots/);
});

test('storage rejection propagates without claiming a completed import',async()=>{
  const kv=memoryKv();const store=createGameStore(kv,()=>1,()=> 'quota-test');const saved=await store.create(defaultSpec('runner'));
  const failing=createGameStore({...kv,set:async()=>{throw new Error('Quota exceeded');}});
  await assert.rejects(failing.change(saved.id,withArt(saved.spec,'player',art)),/Quota/);
  assert.equal(slotsOf((await store.get(saved.id))!.spec)[0]!.art.atlas,undefined);
});

test('durable atlas stores request one atomic record/index write and propagate an abort',async()=>{
  const kv=memoryKv();const base=createGameStore(kv,()=>1,()=> 'atomic-test');const saved=await base.create(defaultSpec('runner'));
  let keys:string[]=[];
  const strict=createGameStore({...kv,setMany:async entries=>{keys=entries.map(e=>e[0]);throw new Error('Transaction aborted');}});
  await assert.rejects(strict.change(saved.id,withArt(saved.spec,'player',art)),/Transaction aborted/);
  assert.deepEqual(keys,['playable/atomic-test','playable/index']);
  assert.equal(slotsOf((await base.get(saved.id))!.spec)[0]!.art.atlas,undefined);
});

test('template renderer crops the selected atlas frame at simulation time for desktop/mobile sizes',()=>{
  const spec=withArt(defaultSpec('runner'),'player',{...art,atlas:{...atlas,loop:true}});
  assert.equal(spec.template,'runner');
  const state=initGame(spec,1);state.t=1/24;
  const calls:unknown[][]=[];
  const ctx=new Proxy({drawImage:(...a:unknown[])=>calls.push(a),createLinearGradient:()=>({addColorStop:()=>{}})},{get:(t,k)=>k in t?t[k as keyof typeof t]:()=>{}}) as unknown as CanvasRenderingContext2D;
  const image={} as CanvasImageSource;
  for(const [w,h] of [[1600,900],[390,219]]){calls.length=0;draw(ctx,spec,state,new Map([['player',image]]),w!,h!);assert.deepEqual(calls.at(-1)?.slice(1,5),[128,0,128,128]);}
});

test('code-game kit loads full atlas and advances the drawable canvas without changing sandbox policy',async()=>{
  const spec=atlasDemo({...art,atlas:{...atlas,loop:true}},art);
  const doc=srcdoc(spec,{hero:art.url!,effect:art.url!});assert.match(doc,/default-src 'none'/);assert.match(doc,/"frames"/);
  const crops:unknown[][]=[];const events:Record<string,()=>void>={};let next:((t:number)=>void)|undefined;
  const ctx=new Proxy({drawImage:(...a:unknown[])=>crops.push(a),createLinearGradient:()=>({addColorStop:()=>{}})},{get:(t,k)=>k in t?t[k as keyof typeof t]:()=>{}});
  const element=()=>({width:0,height:0,style:{},getContext:()=>ctx,addEventListener:()=>{},querySelector:()=>({}),getBoundingClientRect:()=>({left:0,top:0,width:960,height:540})});
  const config={size:[960,540],palette:{sky:'#000',ground:'#111',accent:'#fff'},touch:'tap',three:false,assets:[{id:'hero',kind:'sprite',shape:'circle',color:'#fff',src:art.url,atlas:{...atlas,loop:true}}]};
  const win:Record<string,unknown>={devicePixelRatio:1,addEventListener:()=>{}};
  const scope={window:win,parent:{postMessage:()=>{}},document:{getElementById:(id:string)=>id==='haggs-config'?{textContent:JSON.stringify(config)}:element(),createElement:element},Image:class{naturalWidth=1024;naturalHeight=2048;onload?:()=>void;set src(_s:string){queueMicrotask(()=>this.onload?.());}},addEventListener:(name:string,fn:()=>void)=>{events[name]=fn;},performance:{now:()=>0},requestAnimationFrame:(fn:(t:number)=>void)=>{next=fn;},matchMedia:()=>({matches:false}),console};
  vm.runInNewContext(KIT_SOURCE,scope);await new Promise(resolve=>setImmediate(resolve));
  assert.ok(crops.some(a=>a.length===9 && a[1]===0 && a[2]===0));
  const kit=win.HAGGS as {start:(v:object)=>void;img:(id:string)=>unknown;time:number};
  const first=kit.img('hero');kit.start({draw:()=>{}});next!(50);
  assert.equal(kit.img('hero'),first,'stable canvas reference for existing game code');
  assert.ok(crops.some(a=>a.length===9&&a[1]===128),'frame 1 was cropped at the next simulation step');
});
