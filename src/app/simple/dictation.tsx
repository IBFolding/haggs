'use client';
import {useEffect,useRef,useState} from 'react';
type Recognition={lang:string;continuous:boolean;interimResults:boolean;onresult:((e:{results:{length:number;[key:number]:{[key:number]:{transcript:string}}}})=>void)|null;onerror:(()=>void)|null;onend:(()=>void)|null;start():void;stop():void;};
export function Dictation({onText,disabled}:{onText:(text:string)=>void;disabled:boolean}){
 const [available,setAvailable]=useState(false),[listening,setListening]=useState(false),[error,setError]=useState(''),active=useRef<Recognition|null>(null);
 useEffect(()=>{setAvailable(!!((window as any).SpeechRecognition??(window as any).webkitSpeechRecognition));return()=>{active.current?.stop();};},[]);
 useEffect(()=>{if(disabled)active.current?.stop();},[disabled]);
 if(!available)return null;
 return <span><button type="button" className="plain" disabled={disabled} aria-pressed={listening} title="Uses your browser’s speech service; microphone starts only when pressed" onClick={()=>{
 if(listening){active.current?.stop();return;}setError('');const Constructor=(window as any).SpeechRecognition??(window as any).webkitSpeechRecognition;const r:Recognition=new Constructor();active.current=r;r.lang=navigator.language||'en-US';r.continuous=false;r.interimResults=false;r.onresult=e=>{onText(Array.from({length:e.results.length},(_,i)=>e.results[i]![0]!.transcript).join(' '));};r.onerror=()=>{setError('Dictation unavailable. You can still type.');setListening(false);};r.onend=()=>setListening(false);try{r.start();setListening(true);}catch{setError('Microphone could not start.');}
 }}>{listening?'Stop dictation':'Dictate'}</button>{error&&<small role="status">{error}</small>}</span>;
}
