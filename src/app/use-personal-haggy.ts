"use client";
import {useCallback,useEffect,useRef,useState} from 'react';
import {companionOrigin,PROTOCOL,type ChatEvent,type PersonalProvider} from '../haggy/protocol';
import {runTool,type ToolContext} from '../story/agent-tools';
import type {Project} from '../story/model';
import {useSession} from './session';

type Connection={endpoint:string;token:string};
type Line={who:'you'|'assistant'|'change'|'error';text:string;undo?:Project;undone?:boolean};
type Runner={installed:boolean;compatible:boolean;signedIn:boolean;note:string};
type Active={id:string;cursor:number;owner:string;context:{project:string;board?:string;mode?:'simple'|'pro'};};
const STORAGE='haggs.personal-ai/1';
class ConnectorRejection extends Error{constructor(message:string,readonly status:number){super(message);}}
/** Browser talks only to the paired loopback connector. AI credentials never enter this state. */
export function usePersonalHaggy(ctx:ToolContext,enabled:boolean){
 const {session,ready:sessionReady}=useSession(),owner=session?.user.id??'device';
 const [connection,setConnection]=useState<Connection|null>(null),[provider,setProvider]=useState<PersonalProvider>('claude'),[lines,setLines]=useState<Line[]>([]),[runners,setRunners]=useState<{claude:Runner;codex:Runner}|null>(null),[status,setStatus]=useState('Not connected'),[busy,setBusy]=useState(false),[recoverable,setRecoverable]=useState(false),[contextProject,setContextProject]=useState(''),[projects,setProjects]=useState<{id:string;name:string}[]>([]),[problem,setProblem]=useState('');
 const con=useRef<Connection|null>(null),active=useRef<Active|null>(null),abort=useRef<AbortController|null>(null),history=useRef<{role:'user'|'assistant';text:string}[]>([]),receipts=useRef<Record<string,{state:'running'|'done';result?:unknown;error?:boolean}>>({}),mounted=useRef(true),ownerRef=useRef(owner),turnStart=useRef(false),providerRef=useRef<PersonalProvider>('claude'),projectRef=useRef('');
 ownerRef.current=owner;
 const persist=useCallback(()=>{try{sessionStorage.setItem(STORAGE,JSON.stringify({owner:ownerRef.current,connection:con.current,active:active.current,provider:providerRef.current,project:projectRef.current,history:history.current.slice(-40),receipts:receipts.current}));}catch{/* Storage failures are reported before executing edits. */}},[]);
 const request=useCallback(async(path:string,init:RequestInit={},c=con.current)=>{
  if(!c)throw Error('Connect your AI first.');
  const response=await fetch(c.endpoint+path,{...init,redirect:'error',headers:{'Content-Type':'application/json',Authorization:`Bearer ${c.token}`,...init.headers}});
  if(!response.ok){let message='The connector could not answer.';try{message=(await response.json()).error??message;}catch{}throw new ConnectorRejection(message,response.status);}
  return response;
 },[]);
 const refresh=useCallback(async()=>{setProblem('');try{const response=await request('/status',{signal:AbortSignal.timeout(20000)}),data=await response.json();if(data.protocol!==PROTOCOL)throw Error('This is not a compatible Haggy connector.');setRunners({claude:data.claude,codex:data.codex});setStatus('Connected to your computer');}catch(error){setProblem(error instanceof Error?error.message:'Connector unavailable.');setStatus('Connection unavailable');}},[request]);
 const consume=useCallback(async(job:Active)=>{
  abort.current?.abort();const controller=new AbortController();abort.current=controller;setBusy(true);setRecoverable(false);setProblem('');
  try{
   const response=await request(`/turn/${job.id}?after=${job.cursor}`,{signal:controller.signal});if(!response.body)throw Error('The connector did not return an event stream.');
   const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='',terminal=false;
   try{for(;;){const part=await reader.read();if(part.done)break;buffer+=decoder.decode(part.value,{stream:true});if(buffer.length>1000000)throw Error('Reply exceeded the stream limit.');
    for(;;){const end=buffer.indexOf('\n\n');if(end<0)break;const frame=buffer.slice(0,end);buffer=buffer.slice(end+2);if(!frame.startsWith('data: '))continue;const event=JSON.parse(frame.slice(6)) as ChatEvent;if(controller.signal.aborted||job.owner!==ownerRef.current)return;
     if(!Number.isSafeInteger(event.seq)||event.seq<=job.cursor)continue;
     if(event.type==='status')setStatus(event.text??'Working…');
     if(event.type==='text'&&typeof event.text==='string'){
      setLines(all=>{const last=all[all.length-1];return last?.who==='assistant'?[...all.slice(0,-1),{...last,text:last.text+event.text}]:[...all,{who:'assistant',text:event.text!}];});
      const last=history.current[history.current.length-1];if(last?.role==='assistant')last.text+=event.text;else history.current.push({role:'assistant',text:event.text});
     }
     if(event.type==='tool'&&event.requestId&&event.name&&event.input){
      const pending=await (await request(`/turn/${job.id}/pending/${event.requestId}`,{signal:controller.signal})).json();
      if(!pending.pending){job.cursor=event.seq;persist();continue;}
      const before=receipts.current[event.requestId];
      if(before?.state==='running'){
       await request(`/turn/${job.id}`,{method:'DELETE'});active.current=null;persist();throw Error('A previous edit was interrupted. Inspect your project before asking again; it was not retried.');
      }
      let answer=before;
      if(!answer){
       receipts.current[event.requestId]={state:'running'};
       // A durable receipt must precede mutations so reloads cannot repeat an uncertain tool call.
       try{sessionStorage.setItem(STORAGE,JSON.stringify({owner:ownerRef.current,connection:con.current,active:job,provider:providerRef.current,project:projectRef.current,history:history.current,receipts:receipts.current}));}catch{await request(`/turn/${job.id}`,{method:'DELETE'});active.current=null;throw Error('Browser storage is unavailable. No edit was applied.');}
       if(job.owner!==ownerRef.current)throw Error('The account changed. This tool call was stopped.');
       const scoped:ToolContext={...ctx,mode:ctx.mode==='simple'?'simple':job.context.mode??'pro',production:ctx.production?{propose:(id,input)=>{if(id!==job.context.project)throw Error('Only the selected project is available.');return ctx.production!.propose(id,input);},read:id=>{if(id!==job.context.project)throw Error('Only the selected project is available.');return ctx.production!.read(id);}}:undefined,list:async()=> (await ctx.list()).filter(p=>p.id===job.context.project),load:async id=>id===job.context.project?ctx.load(id):null,save:async project=>{if(project.id!==job.context.project||job.owner!==ownerRef.current)throw Error('This turn can only change its selected project and account.');await ctx.save(project);},sheets:async id=>id===job.context.project?ctx.sheets(id):null,open:path=>{if(path.startsWith('/board/')&&decodeURIComponent(path.split('/')[2]??'')!==job.context.project)throw Error('This turn can only open its selected project.');ctx.open(path);}};
       setStatus(`Using ${event.name.replaceAll('_',' ')}…`);
       const result=await runTool(event.name,event.input,scoped);
       if(result.change)setLines(all=>[...all,{who:'change',text:result.change!.label,undo:result.change!.before}]);
       answer={state:'done',result:result.result,...(result.error?{error:true}:{})};receipts.current[event.requestId]=answer;persist();
      }
      await request(`/turn/${job.id}/result`,{method:'POST',body:JSON.stringify({id:event.requestId,result:answer.result??null,...(answer.error?{error:true}:{})})});
     }
     if(['done','error','canceled'].includes(event.type)){
      terminal=true;active.current=null;setBusy(false);setRecoverable(false);setStatus(event.type==='done'?'Connected · reply complete':event.type==='canceled'?'Stopped':'Turn failed');
      if(event.type==='error'&&event.text)setLines(all=>[...all,{who:'error',text:event.text!}]);
     }
     job.cursor=event.seq;persist();
    }
   }}finally{await reader.cancel().catch(()=>{});}
   if(!terminal&&active.current)throw Error('Connection interrupted. Recover this turn instead of sending it again.');
  }catch(error){if(controller.signal.aborted)return;if(mounted.current){setBusy(false);setRecoverable(!!active.current);setProblem(error instanceof Error?error.message:'Connector unavailable.');setStatus(active.current?'Connection interrupted':'Connected');}}
 },[ctx,persist,request]);
 const consumeRef=useRef(consume);consumeRef.current=consume;
 useEffect(()=>{
  if(!sessionReady)return;
  mounted.current=true;
  try{const saved=JSON.parse(sessionStorage.getItem(STORAGE)??'null');if(saved?.owner===owner&&saved.connection){con.current={endpoint:companionOrigin(saved.connection.endpoint),token:saved.connection.token};setConnection(con.current);providerRef.current=saved.provider==='codex'?'codex':'claude';setProvider(providerRef.current);projectRef.current=typeof saved.project==='string'?saved.project:'';setContextProject(projectRef.current);history.current=Array.isArray(saved.history)?saved.history:[];const visible=/^\/board\/([^/]+)/.exec(window.location.pathname)?.[1]??new URLSearchParams(window.location.search).get('project');if(visible&&visible!==projectRef.current&&!saved.active){history.current=[];projectRef.current=visible;setContextProject(visible);}receipts.current=saved.receipts??{};active.current=saved.active??null;setLines(history.current.map(m=>({who:m.role==='user'?'you':'assistant',text:m.text})));if(active.current)setRecoverable(true);void refresh();}else{abort.current?.abort();if(con.current)void request('/disconnect',{method:'POST'}).catch(()=>{});con.current=null;active.current=null;history.current=[];receipts.current={};setConnection(null);setLines([]);setRunners(null);setBusy(false);setRecoverable(false);sessionStorage.removeItem(STORAGE);}}catch{setProblem('Saved connection could not be restored. Pair again.');}
  return()=>{mounted.current=false;abort.current?.abort();};
 },[owner,sessionReady,refresh,request]);
 useEffect(()=>{if(!enabled)return;let live=true;void ctx.list().then(items=>{if(!live)return;setProjects(items.map(p=>({id:p.id,name:p.name})));const page=/^\/board\/([^/]+)/.exec(window.location.pathname)?.[1]??new URLSearchParams(window.location.search).get('project');setContextProject(current=>{const chosen=current&&items.some(p=>p.id===current)?current:(page&&items.some(p=>p.id===page)?page:items[0]?.id??'');projectRef.current=chosen;return chosen;});});return()=>{live=false;};},[enabled,ctx]);
 const pair=async(endpoint:string,code:string)=>{setProblem('');try{
  const origin=companionOrigin(endpoint);const probe=await fetch(origin+'/health',{redirect:'error',signal:AbortSignal.timeout(5000)});if((await probe.json()).protocol!==PROTOCOL)throw Error('This is not a Haggy connector.');
  const response=await fetch(origin+'/pair',{method:'POST',redirect:'error',headers:{'Content-Type':'application/json'},body:JSON.stringify({code}),signal:AbortSignal.timeout(5000)}),data=await response.json();if(!response.ok||data.protocol!==PROTOCOL||typeof data.token!=='string')throw Error(data.error??'Pairing failed.');
  con.current={endpoint:origin,token:data.token};setConnection(con.current);persist();await refresh();
 }catch(error){setProblem(error instanceof TypeError?'Could not reach your connector. Keep its terminal open and allow local-network access if your browser asks.':error instanceof Error?error.message:'The connector could not be reached.');}};
 const send=async(text:string)=>{
  if(turnStart.current||busy||active.current||!contextProject||!con.current)return;
  const ready=runners?.[provider];if(!ready?.signedIn||!ready.compatible){setProblem(ready?.note??'Refresh the connector status before sending.');return;}
  turnStart.current=true;setBusy(true);setProblem('');
  const board=new URLSearchParams(window.location.search).get('b');const job:Active={id:crypto.randomUUID(),cursor:0,owner:ownerRef.current,context:{project:contextProject,mode:ctx.mode??'pro',...(board?{board}:{})}};
  history.current.push({role:'user',text});setLines(all=>[...all,{who:'you',text}]);active.current=job;receipts.current={};persist();
  try{await request('/turn',{method:'POST',body:JSON.stringify({id:job.id,provider,messages:history.current.slice(-40),context:{...job.context,page:window.location.pathname+window.location.search}}),signal:AbortSignal.timeout(15000)});await consumeRef.current(job);}
  catch(error){setBusy(false);const rejected=error instanceof ConnectorRejection&&[400,401,403,404,409,413,429].includes(error.status);if(rejected){active.current=null;persist();}setRecoverable(!rejected);setProblem((error instanceof Error?error.message:'The connector could not confirm submission.')+(rejected?' No turn was started.':' Recover this turn; do not resend it.'));}finally{turnStart.current=false;}
 };
 const stop=async()=>{abort.current?.abort();if(active.current)try{await request(`/turn/${active.current.id}`,{method:'DELETE'});}catch(error){if(!(error instanceof ConnectorRejection&&error.status===404)){setProblem('Stop could not be confirmed. The connector has a five-minute timeout.');return;}}active.current=null;setBusy(false);setRecoverable(false);setStatus('Stopped');persist();};
 const disconnect=async()=>{await stop();try{await request('/disconnect',{method:'POST'});}catch{}con.current=null;setConnection(null);setRunners(null);setStatus('Not connected');active.current=null;persist();};
 const newChat=()=>{if(busy||active.current)return;history.current=[];receipts.current={};setLines([]);setProblem('');persist();};
 const changeProvider=(next:PersonalProvider)=>{if(busy||active.current)return;newChat();providerRef.current=next;setProvider(next);persist();};
 const undo=async(index:number)=>{const line=lines[index];if(!line?.undo||line.undone)return;await ctx.save(line.undo);setLines(all=>all.map((l,i)=>i===index?{...l,undone:true}:l));};
 return {connection,provider,changeProvider,lines,status,runners,busy,recoverable,projects,contextProject,setContextProject:(id:string)=>{if(busy||active.current)return;newChat();projectRef.current=id;setContextProject(id);persist();},problem,pair,refresh,send,stop,disconnect,newChat,undo,recover:()=>{if(active.current)void consumeRef.current(active.current);}};
}
