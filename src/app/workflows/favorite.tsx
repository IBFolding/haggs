"use client";
import {useEffect,useState} from 'react';
import {defaultKv} from '../../story/kv';
const key='workflows/favorites';
export function useWorkflowFavorites(){
 const [favorites,setFavorites]=useState<string[]>([]),[ready,setReady]=useState(false),[error,setError]=useState('');
 useEffect(()=>{void defaultKv().get<unknown>(key).then(v=>{setFavorites(Array.isArray(v)?v.filter((x):x is string=>typeof x==='string'):[]);setReady(true);}).catch(()=>setError('Favorites could not be loaded. Reload to try again.'));},[]);
 function toggle(id:string){if(!ready)return;setFavorites(old=>{const next=old.includes(id)?old.filter(x=>x!==id):[...old,id];void defaultKv().set(key,next).then(()=>setError('')).catch(()=>setError('Favorites could not be saved. Please try again.'));return next;});}
 return {favorites,ready,error,toggle};
}
export function Favorite({active,disabled,onClick,name}:{active:boolean;disabled:boolean;onClick:()=>void;name:string}){return <button className="wf-favorite plain" aria-label={`Favorite ${name}`} aria-pressed={active} disabled={disabled} onClick={onClick} title={active?'Saved to Favorites':'Save to Favorites'}>{active?'★':'☆'}</button>;}
