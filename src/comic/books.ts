import {z} from 'zod';
import type {Kv} from '../story/kv';
import {newPanel,SPARK_SAMPLE,emptyStyle,type Panel,type LookId,type LayoutId,type StyleSheet} from './comic';
import {defaultAppearance,readAppearance,type Appearance} from './appearance';
export type ComicPageDraft={artTakes?:Record<string,string[]>;panels:Panel[];pictures:Record<string,string>;title:string;look:LookId;layout:LayoutId;style:StyleSheet;inIt:string[];extras:import('../story/bank').BankItem[];appearance?:Appearance;animations?:Record<string,import('./living').PanelAnimation>};
export type BookPage={id:string;title:string;summary:string;draft:ComicPageDraft};
export type ComicBook={schema:'haggs.comic-book/1';id:string;title:string;premise:string;look:LookId;layout:LayoutId;cast:string;world:string;chapters:{id:string;title:string;pages:BookPage[]}[];updatedAt:number};
const looks=['custom','ink','manga','vector','noir','ligne','story'] as const;
const safeUrl=z.string().max(10000000).refine(v=>/^\/(?!\/)|^https:\/\/|^data:image\/(png|jpeg|webp);base64,/.test(v),'Use local media, HTTPS or an uploaded picture.');
const panel=z.object({id:z.string().min(1).max(100),action:z.string().max(6000),caption:z.string().max(500),lines:z.array(z.object({who:z.string().max(120),text:z.string().max(2000)})).max(10),shape:z.enum(['wide','square','tall']),who:z.array(z.string().max(100)).max(30),seconds:z.number().min(1).max(15).optional(),motion:z.string().max(1000).optional(),include:z.boolean().optional(),lettering:z.object({caption:z.object({x:z.number().min(0).max(1000),y:z.number().min(0).max(1000)}).optional(),bubbles:z.array(z.object({x:z.number().min(0).max(1000),y:z.number().min(0).max(1000)})).max(10).optional()}).optional()}).passthrough();
export function readBook(value:unknown):ComicBook {
  const schema=z.object({schema:z.literal('haggs.comic-book/1'),id:z.string().min(1).max(100),title:z.string().min(1).max(120),premise:z.string().max(30000),look:z.enum(looks),layout:z.enum(['strip','page','webtoon']),cast:z.string().max(10000),world:z.string().max(10000),updatedAt:z.number().finite(),chapters:z.array(z.object({id:z.string().min(1).max(100),title:z.string().max(120),pages:z.array(z.object({id:z.string().min(1).max(100),title:z.string().max(120),summary:z.string().max(10000),draft:z.object({artTakes:z.record(z.string(),z.array(safeUrl).max(20)).optional(),panels:z.array(panel).min(1).max(12),pictures:z.record(z.string(),safeUrl),title:z.string().max(120),look:z.enum(looks),layout:z.enum(['strip','page','webtoon']),style:z.object({notes:z.string().max(10000),palette:z.array(z.string().max(30)).max(30),line:z.enum(['','fine','medium','bold']),refs:z.array(safeUrl).max(2)}),inIt:z.array(z.string()).max(30),extras:z.array(z.object({kind:z.enum(['character','place','accessory']),id:z.string().max(100),name:z.string().max(120),image:safeUrl.nullable(),words:z.string().max(6000)})).max(50),appearance:z.unknown().optional(),animations:z.record(z.string(),z.object({url:safeUrl,source:safeUrl,prompt:z.string().max(10000),model:z.string().max(200)})).optional()})})).min(1).max(40)})).min(1).max(30)});
  const parsed=schema.parse(value);
  const ids=[parsed.id,...parsed.chapters.flatMap(c=>[c.id,...c.pages.map(p=>p.id)])];
  if(new Set(ids).size!==ids.length)throw Error('Book, chapter and page IDs must be unique.');
  // Validate ancillary records with their own readers in the editor; never trust imported rendering controls.
  for(const chapter of parsed.chapters)for(const page of chapter.pages){
    const all=new Set(page.draft.panels.map(p=>p.id));if(all.size!==page.draft.panels.length)throw Error('Panel IDs must be unique per page.');
    page.draft.appearance=readAppearance(page.draft.appearance as Partial<Appearance> | undefined);
  }
  return parsed as unknown as ComicBook;
}
export const pageDraftKey=(book:string,page:string)=>`comic:book-page:${book}:${page}`;
export function blankBookPage(title:string,look:LookId='manga',layout:LayoutId='page',summary=''):BookPage {
 const panels=Array.from({length:4},()=>newPanel());
 return {id:crypto.randomUUID(),title,summary,draft:{panels,pictures:{},title,look,layout,style:emptyStyle(),inIt:[],extras:[],appearance:defaultAppearance()}};
}
export function newBook(title='Untitled comic',premise='',look:LookId='manga',layout:LayoutId='page'):ComicBook {
 return {schema:'haggs.comic-book/1',id:crypto.randomUUID(),title:title.trim().slice(0,120)||'Untitled comic',premise:premise.slice(0,30000),look,layout,cast:'',world:'',chapters:[{id:crypto.randomUUID(),title:'Chapter 1',pages:[blankBookPage('Page 1',look,layout,premise.slice(0,500))]}],updatedAt:Date.now()};
}
export const BOOK_SAMPLES=[
 {id:'spark',title:'SPARK',tag:'Superhero · color comic',cover:'/samples/comic-starter-spark.webp',look:'ink' as LookId,layout:'page' as LayoutId,premise:'When a blackout traps her neighbourhood, Juno discovers her power cannot save everyone at once.',cast:'Juno: a young rooftop courier, cropped dark hair, amber jacket, blue electrical light. Keep her outfit and face consistent.',world:'Storm-dark city, warm windows, blue electricity. Rescue and responsibility before spectacle.'},
 {id:'heist',title:'The Last Delivery',tag:'Heist · manga',cover:'/samples/comic-starter-heist.webp',look:'manga' as LookId,layout:'page' as LayoutId,premise:'A courier must deliver a sealed letter before dawn. Every person chasing her claims it belongs to them.',cast:'Ari: observant bicycle courier, oversized raincoat, messenger bag. Vale: elderly station keeper with a silver whistle.',world:'A rain-soaked railway town; shuttered platforms and hidden service tunnels. Black ink and crisp silhouettes.'},
 {id:'signal',title:'After the Last Signal',tag:'Sci-fi · webtoon',cover:'/samples/comic-look-noir.webp',look:'noir' as LookId,layout:'webtoon' as LayoutId,premise:'A station archivist receives a distress call in her own voice, dated twenty years from tomorrow.',cast:'Mira: sleep-deprived archivist, dark coveralls, copper hearing device. Sol: maintenance drone with a cracked lens.',world:'An abandoned orbital archive. Sparse amber light against cold blue machinery. Silence and absence matter.'},
 {id:'garden',title:'The Borrowed Garden',tag:'Fantasy · storybook',cover:'/samples/comic-look-story.webp',look:'story' as LookId,layout:'page' as LayoutId,premise:'A child borrows one hour of summer from a winter garden, and must return it before the town forgets spring.',cast:'Nell: curious child in a green coat and patched boots. Moss: a tiny gardener with a seed-filled satchel.',world:'Hand-painted village, frosted greenhouse, warm seed lanterns. Gentle wonder with a real cost.'},
] as const;
export function sampleBook(id:string):ComicBook {
 const sample=BOOK_SAMPLES.find(s=>s.id===id);if(!sample)throw Error('Unknown comic sample.');
 const book={...newBook(sample.title,sample.premise,sample.look,sample.layout),cast:sample.cast,world:sample.world};
 if(id==='spark'){
  const panels=SPARK_SAMPLE.panels.map(p=>newPanel({action:p.action,caption:p.caption,lines:p.lines,shape:p.shape}));
  book.chapters[0]!.pages[0]!.draft={...book.chapters[0]!.pages[0]!.draft,panels,pictures:Object.fromEntries(panels.map((p,i)=>[p.id,SPARK_SAMPLE.panels[i]!.picture])),title:'SPARK — First light'};
 }
 return book;
}
/** Chapter headings and blank-line paragraphs are split literally, with no claim of AI story analysis. */
export function outlineFromScript(book:ComicBook,script:string):ComicBook {
 if(!script.trim()||script.length>30000)throw Error('Paste 1–30,000 characters of script.');
 const groups=script.trim().split(/\n(?=(?:#{1,3}\s+|CHAPTER\s+|Chapter\s+))/).filter(Boolean);
 if(groups.length>30)throw Error('Use at most 30 chapters per book.');
 const chapters=groups.map((group,i)=>{
  const lines=group.trim().split('\n'),heading=/^(?:#{1,3}\s+|CHAPTER\s+|Chapter\s+)/.test(lines[0]??'');
  const title=heading?lines.shift()!.replace(/^#+\s*/, '').slice(0,120):`Chapter ${i+1}`;
  const rows=lines.join('\n').trim().split(/\n\s*\n/).filter(Boolean);
  if(rows.length>40)throw Error('Use at most 40 paragraphs per chapter, one per page.');
  const pages=(rows.length?rows:['']).map((text,j)=>{if(text.length>6000)throw Error('Split paragraphs longer than 6,000 characters into multiple pages.');const page=blankBookPage(`Page ${j+1}`,book.look,book.layout,text);const sentences=text.split(/(?<=[.!?])\s+/).filter(Boolean);const actions=sentences.length>6?[...sentences.slice(0,5),sentences.slice(5).join(' ')]:sentences;page.draft.panels=actions.length?actions.map(action=>newPanel({action})):[newPanel()];return page;});
  return {id:crypto.randomUUID(),title,pages};
 });
 return {...book,chapters,updatedAt:Date.now()};
}
export function createBookStore(kv:Kv){
 const index='comic:books:index:v1',key=(id:string)=>`comic:books:${id}`;let writes=Promise.resolve();
 const list=async()=>await kv.get<{id:string;title:string;updatedAt:number}[]>(index)??[];
 const load=async(id:string)=>{const book=await kv.get<ComicBook>(key(id));if(!book)return;const hydrated=structuredClone(book);for(const chapter of hydrated.chapters)for(const page of chapter.pages){const draft=await kv.get<ComicPageDraft>(pageDraftKey(id,page.id));if(draft)page.draft=draft;}return hydrated;};
 const save=(book:ComicBook)=>{const next=structuredClone({...book,updatedAt:Date.now()});const job=writes.catch(()=>undefined).then(async()=>{const summaries=(await list()).filter(b=>b.id!==next.id);summaries.unshift({id:next.id,title:next.title,updatedAt:next.updatedAt});if(kv.setMany)await kv.setMany([[key(next.id),next],[index,summaries]]);else{await kv.set(key(next.id),next);await kv.set(index,summaries);}});writes=job;return job;};
 return {list,load,save,async page(bookId:string,pageId:string){return (await load(bookId))?.chapters.flatMap(c=>c.pages).find(p=>p.id===pageId);}};
}
