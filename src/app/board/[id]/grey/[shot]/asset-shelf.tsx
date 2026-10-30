'use client';
import {useEffect,useRef,useState} from 'react';
import type {BankItem} from '../../../../../story/bank';
import {addLight,replaceRoomSource,type GreyScene} from '../../../../../story/grey-scene';
import {addUploadedLayer} from '../../../../../story/grey-tray';
import {ASSET_DRAG} from '../../../../../story/grey-drop';
import {uploadFile} from '../../../../upload-client';
import {GREY_PROPS,sceneAssetUrl} from '../../../../grey-builtins';
import {StudioIcon} from './studio-icon';
import {ReferenceBoard} from './reference-board';
export type SceneTask='surface'|'objects'|'actors'|'background'|'lights'|'sets';
export function AssetShelf({scene,selected,places,objects,actors,onChange,onSelect,onTask}:{scene:GreyScene;selected:string|null;places:BankItem[];objects:BankItem[];actors:BankItem[];onChange:(s:GreyScene)=>void;onSelect:(id:string|null)=>void;onTask:(task:SceneTask)=>void}){
 const [category,setCategory]=useState<'objects'|'actors'|'background'|'lights'|'references'>('objects');
 const [search,setSearch]=useState('');const [favorites,setFavorites]=useState<string[]>([]);const [onlyFavorites,setOnlyFavorites]=useState(false);
 useEffect(()=>{try{const saved=JSON.parse(localStorage.getItem('haggs-grey-favorites')??'[]');if(Array.isArray(saved))setFavorites(saved.filter((id:unknown):id is string=>typeof id==='string'));}catch{}},[]);
 function favorite(id:string){const next=favorites.includes(id)?favorites.filter(x=>x!==id):[...favorites,id];setFavorites(next);try{localStorage.setItem('haggs-grey-favorites',JSON.stringify(next));}catch{}}
const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 const picker=useRef<HTMLInputElement>(null),source=useRef<HTMLInputElement>(null),live=useRef(scene);live.current=scene;
 const saved=(category==='actors'?actors:category==='background'?places:objects).map(x=>({id:x.id,name:x.name,image:x.image}));
 const placed=category==='background'?[]:(scene.props??[]).filter(p=>category==='actors'?p.role==='actor':p.role!=='actor').map(p=>({id:p.id,name:p.name,image:p.url}));
 const samples=category==='objects'?GREY_PROPS:[];
 const items=[...saved,...placed.filter(p=>!samples.some(sample=>sample.name===p.name)),...samples].filter((x,i,all)=>x.image&&all.findIndex(a=>a.image===x.image)===i&&x.name.toLowerCase().includes(search.toLowerCase())&&(!onlyFavorites||favorites.includes(x.id)));
 async function place(name:string,url:string,kind=category){
  setBusy(true);setError('');
  try {url=await sceneAssetUrl(url); const s=live.current;
  if(kind==='background'){onChange({...s,backdrop:{url,name,scale:1,x:.5,y:.5,blur:0}});onTask('background');return;}
  const result=addUploadedLayer(s,{name,url},kind==='actors'?'actor':'object');onChange(result.scene);onSelect(result.selected);onTask(kind==='actors'?'actors':'objects');
  }catch(e){setError(e instanceof Error?e.message:'Could not add asset.');}finally{setBusy(false);}
 }
 async function upload(file:File|undefined,asSource=false){
  if(!file)return;setBusy(true);setError('');const kind=category;
  try{const r=await uploadFile(file);if(!r.ok)throw new Error(r.reason);if(asSource){if(r.kind!=='image'&&r.kind!=='video')throw new Error('Choose an image or video.');onChange(replaceRoomSource(live.current,{url:r.url,kind:r.kind}));onSelect(null);}else{if(r.kind!=='image')throw new Error('Choose an image cut-out.');await place(file.name.replace(/\.[^.]+$/,''),r.url,kind);}}
  catch(e){setError(e instanceof Error?e.message:'Upload did not finish.');}finally{setBusy(false);}
 }
 return <aside className="gw-assets" aria-label="Scene assets">
  <header><h2>Asset library</h2><button className="pill" disabled={busy} onClick={()=>source.current?.click()} title="Import scene"><StudioIcon name="upload"/><span>Import scene</span></button></header>
  <input ref={source} type="file" accept="image/*,video/*" hidden onChange={e=>{void upload(e.target.files?.[0],true);e.target.value='';}}/>
  <div className="gw-categories" aria-label="Asset categories">{([['objects','Objects','armchair'],['actors','Characters','user'],['background','Environments','cube'],['lights','Lighting','bulb'],['references','Mood board','photo']] as const).map(([id,label,icon])=><button className={`pill${category===id?' on':''}`} aria-pressed={category===id} key={id} onClick={()=>{setCategory(id);setSearch('');if(id!=='references')onTask(id);}}><StudioIcon name={icon}/><span>{label}</span></button>)}</div>
  {category==='references'?<ReferenceBoard scene={scene} selected={selected} onChange={onChange} onEdit={(id,task)=>{onSelect(id??null);onTask(task??'surface');}}/>:category==='lights'?<><p className="gs-soft">Add a light, then drag its dot in the preview.</p><div className="gw-light-shelf">{(['key','fill','glow','practical'] as const).map(kind=><button className="gw-asset" key={kind} onClick={()=>{const next=addLight(live.current,kind);onChange(next);onSelect(next.lights!.at(-1)!.id);onTask('lights');}}><span className={`gw-light-icon ${kind}`}><StudioIcon name={kind==='practical'?'bulb':'sun'} size={32}/></span><b>{kind==='practical'?'Lamp light':`${kind[0]!.toUpperCase()}${kind.slice(1)} light`}</b></button>)}</div><p className="gs-soft">Preview lights are flat overlays. Physical relighting is a separate render workflow.</p></>:<>
   <div className="gw-search-wrap"><StudioIcon name="search"/><input className="gw-search" aria-label="Search scene assets" placeholder="Search your assets…" value={search} onChange={e=>setSearch(e.target.value)}/></div><div className="gw-shelf-tabs"><button className={!onlyFavorites?'on':''} onClick={()=>setOnlyFavorites(false)}>All assets</button><button className={onlyFavorites?'on':''} onClick={()=>setOnlyFavorites(true)}>Favorites</button></div>
   <p className="gs-soft">Drag to place · drop on an object to swap</p>
   <div className="gw-asset-grid">{items.map(item=><article className="gw-asset-card" key={item.id}><button disabled={busy} className="gw-asset" draggable={category!=='background'} onDragStart={e=>{e.dataTransfer.setData(ASSET_DRAG,JSON.stringify({name:item.name,url:item.image,role:category==='actors'?'actor':'object'}));e.dataTransfer.effectAllowed='copy';}} onClick={()=>void place(item.name,item.image!)}><img src={item.image!} alt="" draggable={false}/><b>{item.name}</b></button><button className={`gw-favorite${favorites.includes(item.id)?' on':''}`} title="Favorite asset" aria-label={`Favorite ${item.name}`} aria-pressed={favorites.includes(item.id)} onClick={()=>favorite(item.id)}><StudioIcon name="star" size={13}/></button></article>)}<button className="gw-asset gw-upload" disabled={busy} onClick={()=>picker.current?.click()}><StudioIcon name="plus" size={28}/><b>{busy?'Uploading…':'Your image'}</b></button></div>
   {!items.length&&<p className="gs-soft">{search?'No matching assets.':'Your saved assets appear here. Upload an image to start.'}</p>}
   <input ref={picker} type="file" accept="image/*" hidden onChange={e=>{void upload(e.target.files?.[0]);e.target.value='';}}/>
   {selected&&scene.props?.some(p=>p.id===selected)&&<button className="pill" onClick={()=>onSelect(null)}>Deselect</button>}
  </>}
  <button className="pill" onClick={()=>onTask('surface')}><StudioIcon name="crop"/>Edit an area</button>
  {error&&<p role="alert">{error}</p>}
 </aside>;
}
