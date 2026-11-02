"use client";
import {useEffect,useRef,useState} from 'react';
import {defaultKv} from '../../story/kv';
import {createFavoriteWriter} from '../../story/favorite-writer';
const key='workflows/favorites';
export function useWorkflowFavorites(){
 const [favorites,setFavorites]=useState<string[]>([]),[ready,setReady]=useState(false),[error,setError]=useState('');
 const current=useRef<string[]>([]),mounted=useRef(false),write=useRef(createFavoriteWriter(value=>defaultKv().set(key,value)));
 useEffect(()=>{let live=true;mounted.current=true;void defaultKv().get<unknown>(key).then(v=>{if(!live)return;const saved=Array.isArray(v)?v.filter((x):x is string=>typeof x==='string'):[];current.current=saved;setFavorites(saved);setReady(true);}).catch(()=>{if(live)setError('Favorites could not be loaded. Reload to try again.');});return()=>{live=false;mounted.current=false;};},[]);
 function toggle(id:string){if(!ready)return;const old=current.current,next=old.includes(id)?old.filter(x=>x!==id):[...old,id];current.current=next;setFavorites(next);void write.current(next).then(()=>{if(mounted.current)setError('');}).catch(()=>{if(mounted.current)setError('Favorites could not be saved. Please try again.');});}
 return {favorites,ready,error,toggle};
}
export function Favorite({active,disabled,onClick,name}:{active:boolean;disabled:boolean;onClick:()=>void;name:string}){return <button className="wf-favorite plain" aria-label={`Favorite ${name}`} aria-pressed={active} disabled={disabled} onClick={onClick} title={active?'Saved to Favorites':'Save to Favorites'}>{active?'★':'☆'}</button>;}
