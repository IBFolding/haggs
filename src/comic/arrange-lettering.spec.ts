import test from 'node:test';
import assert from 'node:assert/strict';
import { arrangeLettering } from './arrange-lettering';
import { bookLayout, letterBoxes, THEMES, pageSvg, panelLetters } from './appearance';
import { newPanel } from './comic';
test('arranges overlapping lettering for every page count and theme without changing story or art',()=>{
 for(const {design} of THEMES)for(let count=1;count<=8;count++){
  const panel=newPanel({caption:'Night falls.',lines:[{who:'Juno',text:'I can help.'},{who:'Juno',text:'Follow me!'}],lettering:{caption:{x:0,y:0},bubbles:[{x:0,y:0},{x:0,y:0}]}});
  const before=JSON.stringify(panel),panels=Array.from({length:count},()=>panel);
  for(const r of bookLayout(panels,'page',design).rects){
   const result=arrangeLettering(panel,r.w,r.h,design);assert.ok(result,`${design.theme}/${count}`);assert.equal(JSON.stringify(panel),before);
   const moved={...panel,lettering:JSON.parse(JSON.stringify(result))},boxes=letterBoxes(moved,r.w,r.h,design);
   for(const [i,b] of boxes.entries())for(const c of boxes.slice(i+1))assert.ok(b.x+b.boxW<=c.x||c.x+c.boxW<=b.x||b.y+b.boxH+(b.kind==='bubble'?10:0)<=c.y||c.y+c.boxH+(c.kind==='bubble'?10:0)<=b.y);
   assert.ok(pageSvg([moved],{},'page','Test',design).includes(panelLetters(moved,940,500,design)));
  }
 }
});
test('impossible text fails without mutating the saved positions',()=>{const p=newPanel({caption:'Too much text. '.repeat(100),lettering:{caption:{x:25,y:50}}});const before=JSON.stringify(p);assert.equal(arrangeLettering(p,200,100,THEMES[0]!.design),null);assert.equal(JSON.stringify(p),before)});
