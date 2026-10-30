import { SHAPE_RATIO, type LayoutId, type LookId, type Panel, type Rect, wrapWords } from './comic';
export type Appearance = { theme: string; paper: string; ink: string; border: string; bubble: string; caption: string; borderWidth: number; gutter: number; texture: 'plain'|'dots'|'grain'; bubbleShape: 'oval'|'rounded'|'box'; font: 'comic'|'serif'|'sans'; textScale: number };
export const THEMES: {id:string;name:string;look:LookId;design:Appearance}[] = [
 {id:'classic',name:'Classic comic',look:'ink',design:{theme:'classic',paper:'#f6f0df',ink:'#171512',border:'#171512',bubble:'#fffef7',caption:'#ffeaaa',borderWidth:4,gutter:14,texture:'grain',bubbleShape:'oval',font:'comic',textScale:1}},
 {id:'manga',name:'Manga',look:'manga',design:{theme:'manga',paper:'#ffffff',ink:'#111111',border:'#111111',bubble:'#ffffff',caption:'#ffffff',borderWidth:3,gutter:12,texture:'plain',bubbleShape:'oval',font:'sans',textScale:1}},
 {id:'noir',name:'Noir',look:'noir',design:{theme:'noir',paper:'#20232b',ink:'#f4eee2',border:'#c7a66a',bubble:'#292e38',caption:'#40352b',borderWidth:3,gutter:18,texture:'plain',bubbleShape:'box',font:'serif',textScale:1}},
 {id:'storybook',name:'Storybook',look:'story',design:{theme:'storybook',paper:'#f0e8d9',ink:'#4b342b',border:'#967c60',bubble:'#fff9ed',caption:'#e3d5b9',borderWidth:2,gutter:24,texture:'grain',bubbleShape:'rounded',font:'serif',textScale:1.1}},
];
export const defaultAppearance = ():Appearance => ({...THEMES[0]!.design});
const color=(v:unknown,fallback:string)=>typeof v==='string'&&/^#[a-f\d]{6}$/i.test(v)?v:fallback;
const number=(v:unknown,min:number,max:number,fallback:number)=>typeof v==='number'&&Number.isFinite(v)?Math.min(max,Math.max(min,v)):fallback;
export function readAppearance(value?:Partial<Appearance>):Appearance {
 if(!value)return defaultAppearance();
 const d=defaultAppearance(),v=value;
 return {theme:THEMES.some(t=>t.id===v.theme)?v.theme!:'custom',paper:color(v.paper,d.paper),ink:color(v.ink,d.ink),border:color(v.border,d.border),bubble:color(v.bubble,d.bubble),caption:color(v.caption,d.caption),borderWidth:number(v.borderWidth,0,10,d.borderWidth),gutter:number(v.gutter,0,32,d.gutter),texture:['plain','dots','grain'].includes(v.texture??'')?v.texture!:d.texture,bubbleShape:['oval','rounded','box'].includes(v.bubbleShape??'')?v.bubbleShape!:d.bubbleShape,font:['comic','serif','sans'].includes(v.font??'')?v.font!:d.font,textScale:number(v.textScale,.7,1.5,d.textScale)};
}
export type LetterPosition={x:number;y:number};
export type Lettering={caption?:LetterPosition;bubbles?:LetterPosition[]};
export const FONTS={comic:"'Comic Sans MS', 'Trebuchet MS', sans-serif",serif:"Georgia, serif",sans:"Arial, sans-serif"};
export function bookLayout(panels:Panel[],layout:LayoutId,a:Appearance) {
 const width=1000, margin=30, content=940, gap=a.gutter, rects:Rect[]=[];let y=110;
 if(layout==='page') {
  // Explicit compositions preserve reading order for every supported page size.
  // Older drafts with more than eight panels continue below; no panels are dropped.
  const patterns: Record<number, number[][]> = {
   1:[[0,0,6,1]], 2:[[0,0,3,1],[3,0,3,1]],
   3:[[0,0,6,1],[0,1,3,1],[3,1,3,1]],
   4:[[0,0,6,1],[0,1,2,2],[2,1,4,1],[2,2,4,1]],
   5:[[0,0,3,1],[3,0,3,1],[0,1,2,2],[2,1,4,1],[2,2,4,1]],
   6:[[0,0,6,1],[0,1,2,2],[2,1,4,1],[2,2,4,1],[0,3,3,1],[3,3,3,1]],
   7:[[0,0,6,1],[0,1,2,2],[2,1,4,1],[2,2,4,1],[0,3,2,1],[2,3,2,1],[4,3,2,1]],
   8:[[0,0,6,1],[0,1,2,1],[2,1,2,1],[4,1,2,1],[0,2,3,1],[3,2,3,1],[0,3,3,1],[3,3,3,1]],
  };
  for(let n=0;n<panels.length;n+=8){
   const count=Math.min(8,panels.length-n),row=count<=2?500:244,unit=(content-gap*5)/6;
   const batch=patterns[count]!.map(([col,r,span,rows])=>({x:margin+col!*(unit+gap),y:y+r!*(row+gap),w:span!*(unit+gap)-gap,h:rows!*(row+gap)-gap}));
   rects.push(...batch);y=Math.max(...batch.map(r=>r.y+r.h))+gap;
  }
 } else {const columns=layout==='strip'?3:1,w=(content-gap*(columns-1))/columns;for(let i=0;i<panels.length;i+=columns){const row=panels.slice(i,i+columns);const h=layout==='strip'?340:w/SHAPE_RATIO[row[0]!.shape];row.forEach((_,k)=>rects.push({x:margin+k*(w+gap),y,w,h}));y+=h+gap;}}
 return {width,height:y+36,rects};
}
export const escapeSvg=(v:string)=>v.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!));
export function letterBoxes(panel:Panel,w:number,h:number,a:Appearance) {
 const make=(text:string,kind:'bubble'|'caption',index:number)=>{
  const font=(kind==='bubble'?17:16)*a.textScale;
  const maxW=w*(kind==='bubble'?.86:.8),pad=font*.8;
  const lines=wrapWords(text.toUpperCase(),Math.max(6,Math.floor((maxW-pad*2)/(font*.62))));
  const boxW=Math.min(maxW,Math.max(...lines.map(l=>l.length))*font*.62+pad*2),boxH=Math.min(h-20,lines.length*font*1.2+pad*2);
  const position=kind==='caption'?panel.lettering?.caption:panel.lettering?.bubbles?.[index];
  const px=number(position?.x,0,100,kind==='caption'?0:index===0?100:0)/100,py=number(position?.y,0,100,kind==='caption'?100:index===0?0:45)/100;
  const x=10+Math.max(0,w-boxW-20)*px,y=10+Math.max(0,h-boxH-28)*py;
  return {kind,index,font,pad,lines,boxW,boxH,x,y,overflow:lines.length*font*1.2+pad*2>h-20};
 };
 return [...(panel.caption.trim()?[make(panel.caption,'caption',0)]:[]),...panel.lines.filter(l=>l.text.trim()).map((l,i)=>make(l.text,'bubble',i))];
}
export function panelLetters(panel:Panel,w:number,h:number,a:Appearance) {
 return letterBoxes(panel,w,h,a).map(({kind,font,pad,lines,boxW,boxH,x,y})=>{
  const rx=kind==='caption'?0:a.bubbleShape==='oval'?boxW/2:a.bubbleShape==='rounded'?16:0;
  const background=kind==='caption'?a.caption:a.bubble;
  const shape=`<rect x="${x}" y="${y}" width="${boxW}" height="${boxH}" rx="${rx}" fill="${background}" stroke="${a.border}" stroke-width="2"/>`;
  const tail=kind==='bubble'?`<path d="M ${x+boxW*.35} ${y+boxH-2} l 0 10 l 12 -10" fill="${background}" stroke="${a.border}" stroke-width="2"/>`:'';
  const label=lines.map((line,i)=>`<text x="${x+boxW/2}" y="${y+pad+font*.85+i*font*1.2}" text-anchor="middle" textLength="${Math.min(boxW-pad*2,line.length*font*.62)*(kind==='bubble'&&a.bubbleShape==='oval'?.82:1)}" lengthAdjust="spacingAndGlyphs" fill="${a.ink}" font-family="${escapeSvg(FONTS[a.font])}" font-size="${font}" font-weight="700">${escapeSvg(line)}</text>`).join('');
  return shape+tail+label;
 }).join('');
}
export function pageSvg(panels:Panel[],pictures:Record<string,string>,layout:LayoutId,title:string,a:Appearance) {
 const {width,height,rects}=bookLayout(panels,layout,a);
 const titleText=title.trim()||'Your comic';
 const pattern=a.texture==='plain'?'':`<defs><pattern id="paper-texture" width="${a.texture==='dots'?10:7}" height="${a.texture==='dots'?10:11}" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="${a.texture==='dots'?1:.5}" fill="${a.ink}" opacity=".12"/></pattern></defs><rect width="100%" height="100%" fill="url(#paper-texture)"/>`;
 const cells=panels.map((p,i)=>{const r=rects[i]!;const src=pictures[p.id];return `<svg x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" viewBox="0 0 ${r.w} ${r.h}" overflow="hidden"><rect width="100%" height="100%" fill="${a.paper}"/>${src?`<image href="${escapeSvg(src)}" width="${r.w}" height="${r.h}" preserveAspectRatio="xMidYMid slice"/>`:`<text x="12" y="30" fill="${a.ink}" font-size="18">Panel ${i+1} · add artwork</text>`}${panelLetters(p,r.w,r.h,a)}<rect x="${a.borderWidth/2}" y="${a.borderWidth/2}" width="${r.w-a.borderWidth}" height="${r.h-a.borderWidth}" fill="none" stroke="${a.border}" stroke-width="${a.borderWidth}"/></svg>`}).join('');
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="${a.paper}"/>${pattern}<path d="M30 30 H970 M30 94 H970" stroke="${a.border}" stroke-width="3"/><text x="500" y="72" text-anchor="middle" fill="${a.ink}" font-family="${escapeSvg(FONTS[a.font])}" font-size="${Math.min(36,1300/titleText.length)}" font-weight="900">${escapeSvg(titleText.toUpperCase())}</text>${cells}<text x="30" y="${height-14}" fill="${a.ink}" font-family="${escapeSvg(FONTS[a.font])}" font-size="12">${escapeSvg(titleText)}</text><text x="970" y="${height-14}" text-anchor="end" fill="${a.ink}" font-size="12">— 01 —</text></svg>`;
}
