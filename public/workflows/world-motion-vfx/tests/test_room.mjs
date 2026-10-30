import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const code=await readFile(new URL('../custom_nodes/ComfyUI-HaggsStudio/web/room.js',import.meta.url),'utf8');
const {step,solid,INITIAL}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
let s=structuredClone(INITIAL);for(let i=0;i<300;i++)s=step(s,new Set(['KeyA']),1/60);
assert(s.x>=.19);assert(!solid(s.x,s.z));
s={...structuredClone(INITIAL),x:2.5,z:1.1};for(let i=0;i<120;i++)s=step(s,new Set(['KeyS']),1/60);
assert(s.z<1.5);assert(!solid(s.x,s.z));
s=structuredClone(INITIAL);
function drive(key,test){for(let i=0;i<600&&!test(s);i++)s=step(s,new Set([key]),1/60);assert(test(s));}
drive('KeyD',s=>s.x>=5.8);drive('KeyS',s=>s.z>=5.4);drive('KeyA',s=>s.x<=1.2||s.won);
assert(s.won);assert(s.orbs.every(Boolean));
assert.equal(INITIAL.x,1.1);console.log('Room simulation: wall collision, obstacle collision, reachable win and immutable input passed.');
