import {test} from 'node:test';
import assert from 'node:assert/strict';
import {arrange,parse,type Layout} from './workspace';
test('arrange packs mixed-size ungrouped cards into rows without overlap',()=>{
 const l:Layout={cards:{a:{x:0,y:0},b:{x:0,y:0},c:{x:0,y:0}},frames:[],notes:[]};
 const sizes={a:{w:220,h:240},b:{w:220,h:120},c:{w:220,h:300}};
 const out=arrange(l,sizes,540);assert.equal(out.cards.a!.y,out.cards.b!.y);assert.ok(out.cards.c!.y>=out.cards.a!.y+240);assert.deepEqual(l.cards.a,{x:0,y:0});
 assert.deepEqual(arrange(parse(JSON.parse(JSON.stringify(out))),sizes,540),out);
});
test('arrange preserves groups, shared membership, notes and all assets',()=>{
 const l:Layout={cards:{a:{x:-40,y:0},b:{x:0,y:0},c:{x:0,y:0},d:{x:0,y:0}},frames:[{id:'g1',name:'Film',x:0,y:0,w:200,h:200,members:['a','b']},{id:'g2',name:'Shared',x:0,y:0,w:200,h:200,members:['b','c']}],notes:[{id:'n1',text:'Keep this',x:0,y:0}]};
 const out=arrange(l,{},700);assert.deepEqual(Object.keys(out.cards),Object.keys(l.cards));assert.deepEqual(out.frames.map(f=>f.members),l.frames.map(f=>f.members));assert.equal(out.notes[0]!.text,'Keep this');
 for(const f of out.frames)for(const id of f.members!){const c=out.cards[id]!;assert.ok(c.x>=f.x&&c.y>=f.y+44);assert.ok(c.x+220<=f.x+f.w&&c.y+165<=f.y+f.h);}
 assert.ok(out.cards.d!.y>out.cards.c!.y);
});
