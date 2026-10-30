import { letterBoxes, type Appearance, type Lettering, type LetterPosition } from './appearance';
import type { Panel } from './comic';

// Candidate search adapted from stockedge/manga-generator's dialogue-layout.mjs.
// Copyright (c) 2026 issei.mori. MIT notice: THIRD_PARTY_NOTICES.md.
// Uses our shared horizontal lettering geometry and left-to-right reading order.
export function arrangeLettering(panel:Panel,w:number,h:number,a:Appearance):Lettering|null {
 const boxes=letterBoxes(panel,w,h,a);
 if(boxes.some(b=>b.overflow))return null;
 const pools=boxes.map(b=>{
  const dx=Math.max(0,w-b.boxW-20),dy=Math.max(0,h-b.boxH-28);
  const xs=new Set([b.x,10,10+dx]),ys=new Set([b.y,10,10+dy]);
  for(let x=10;x<=10+dx;x+=24)xs.add(x);
  for(let y=10;y<=10+dy;y+=24)ys.add(y);
  return [...xs].flatMap(x=>[...ys].map(y=>({x,y,w:b.boxW,h:b.boxH+(b.kind==='bubble'?10:0),kind:b.kind,index:b.index,position:{x:dx?(x-10)/dx*100:0,y:dy?(y-10)/dy*100:0},score:Math.abs(x-b.x)+1.2*Math.abs(y-b.y)}))).sort((a,b)=>a.score-b.score);
 });
 type Candidate=(typeof pools)[number][number];
 const chosen:Candidate[]=[];let attempts=0;
 const solve=(i:number):boolean=>{
  if(i===pools.length)return true;
  for(const item of pools[i]!){
   if(++attempts>20000)return false;
   if(chosen.some(b=>item.x<b.x+b.w+6&&b.x<item.x+item.w+6&&item.y<b.y+b.h+6&&b.y<item.y+item.h+6))continue;
   const previous=chosen.filter(b=>b.kind==='bubble').at(-1);
   if(item.kind==='bubble'&&previous&&!(item.y>=previous.y+previous.h+6||(item.x>=previous.x+previous.w+6&&item.y>=previous.y)))continue;
   chosen.push(item);if(solve(i+1))return true;chosen.pop();
  }return false;
 };
 if(!solve(0))return null;
 const result:Lettering={...panel.lettering,bubbles:[...(panel.lettering?.bubbles??[])]};
 for(const b of chosen){const position:LetterPosition={...b.position};if(b.kind==='caption')result.caption=position;else result.bubbles![b.index]=position;}
 return result;
}
