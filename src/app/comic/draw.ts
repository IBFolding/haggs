import type { LayoutId, Panel } from '../../comic/comic';
import { bookLayout, defaultAppearance, pageSvg, type Appearance } from '../../comic/appearance';
const load=(src:string)=>new Promise<HTMLImageElement>((resolve,reject)=>{const i=new Image();i.crossOrigin='anonymous';i.onload=()=>resolve(i);i.onerror=()=>reject(new Error('A panel picture could not be loaded for export.'));i.src=src;});
/** Embed originals first: SVG image decoding cannot fetch external subresources. */
async function embedded(src:string) {
 if(src.startsWith('data:image/'))return src;
 const image=await load(src),canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;canvas.getContext('2d')!.drawImage(image,0,0);return canvas.toDataURL('image/png');
}
export async function drawComic(canvas:HTMLCanvasElement,panels:Panel[],pictures:Record<string,string>,layout:LayoutId,scale=1,appearance:Appearance=defaultAppearance(),title='Your comic') {
 const images=Object.fromEntries(await Promise.all(panels.filter(p=>pictures[p.id]).map(async p=>[p.id,await embedded(pictures[p.id]!)])));
 const svg=pageSvg(panels,images,layout,title,appearance),url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));
 try{const image=await load(url),size=bookLayout(panels,layout,appearance);canvas.width=Math.round(size.width*scale);canvas.height=Math.round(size.height*scale);canvas.getContext('2d')!.drawImage(image,0,0,canvas.width,canvas.height);}finally{URL.revokeObjectURL(url);}
}
export { PAGE_W, SHAPE_RATIO } from '../../comic/comic';
