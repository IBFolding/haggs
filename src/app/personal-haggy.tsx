"use client";
import {useEffect,useRef,useState} from 'react';
import {Dictation} from './simple/dictation';
import type {usePersonalHaggy} from './use-personal-haggy';
export function PersonalHaggy({ai,embedded=false}:{ai:ReturnType<typeof usePersonalHaggy>;embedded?:boolean}){
 const [endpoint,setEndpoint]=useState('http://127.0.0.1:3211'),[code,setCode]=useState(''),[text,setText]=useState(''),[pairing,setPairing]=useState(false);
 const end=useRef<HTMLDivElement>(null);
 useEffect(()=>{const log=end.current?.parentElement;if(log)log.scrollTop=log.scrollHeight;},[ai.lines,ai.busy]);
 return <>
  <details className="haggy-connection" open={!ai.connection} key={ai.connection?'paired':'unpaired'}><summary>{ai.connection?`${ai.provider==='claude'?'Claude Code':'Codex'} · ${ai.status}`:'Connect your AI'}</summary><section aria-label="Your AI connection">
   {!ai.connection?<><h2>Connect your own Claude or Codex</h2><p>Run the connector on your computer, then enter its pairing code here. Your AI login stays on your computer.</p><code>npm run haggy:connect</code><p className="producer-small">Run this from your Haggs checkout. Install and sign in to Claude Code or Codex first. Your account’s usage limits apply. No new AI key is needed in Haggs.</p><label>Connector address<input value={endpoint} onChange={e=>setEndpoint(e.target.value)} autoComplete="off"/></label><label>Pairing code<input value={code} onChange={e=>setCode(e.target.value)} placeholder="XXXX-XXXX-XXXX" autoComplete="off" spellCheck={false}/></label><button className="pill" disabled={pairing||!code.trim()} onClick={async()=>{setPairing(true);try{await ai.pair(endpoint,code);setCode('');}finally{setPairing(false);}}}>{pairing?'Connecting…':'Pair my AI'}</button><p className="producer-small">Allow local-network access if your browser asks. Keep the connector terminal open.</p></>:<>
    <div className="haggy-connection-row"><b role="status">{ai.status}</b><button className="plain" onClick={()=>void ai.disconnect()}>Disconnect</button></div>
    <label>Use my<select value={ai.provider} disabled={ai.busy||ai.recoverable} onChange={e=>ai.changeProvider(e.target.value as 'claude'|'codex')}><option value="claude">Claude Code</option><option value="codex">Codex</option></select></label>
    <p className="producer-small">{ai.runners?.[ai.provider].note??'Checking desktop login…'}</p><button className="plain" onClick={()=>void ai.refresh()}>Refresh connection status</button>
    {!embedded&&<><label>Project context<select value={ai.contextProject} disabled={ai.busy||ai.recoverable} onChange={e=>ai.setContextProject(e.target.value)}><option value="">Choose a project</option>{ai.projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
    <p className="producer-small">Only this project is available to this conversation. Switching AI starts a new chat.</p></>}
   </>}
  </section></details>
  {ai.problem&&<p role="alert" className="library-error" style={{margin:'8px 16px',fontSize:12}}>{ai.problem}</p>}
  {ai.recoverable&&<button className="pill" style={{margin:'8px 16px'}} onClick={ai.recover}>Recover existing turn</button>}
  <div className="producer-log" aria-live="polite">
   {!ai.lines.length&&ai.connection&&<div className="producer-hello"><p>Talk to your own AI here. Ask it to review pacing, refine a shot or plan a new board.</p><p className="producer-small">Edits have Undo in this session. Generating media and spending credits remain separate actions in the studio.</p></div>}
   {ai.lines.map((line,i)=><div key={i} className={`producer-line ${line.who==='assistant'?'claude':line.who}`}>{line.who==='change'?<><span>{line.undone?'Undone: ':'Done: '}{line.text}</span>{line.undo&&!line.undone&&<button className="plain" onClick={()=>void ai.undo(i)}>Undo</button>}</>:<p>{line.text}</p>}</div>)}
   {ai.busy&&<p role="status" className="producer-small">{ai.status}</p>}<div ref={end}/>
  </div>
  <div className="haggy-connection-row"><Dictation disabled={ai.busy||ai.recoverable} onText={value=>setText(current=>current+(current?" ":"")+value)}/><button className="plain" disabled={ai.busy||ai.recoverable} onClick={ai.newChat}>New conversation</button>{(ai.busy||ai.recoverable)&&<button className="pill" onClick={()=>void ai.stop()}>Stop</button>}</div>
  <form className="producer-say" onSubmit={e=>{e.preventDefault();const value=text.trim();if(value){setText('');void ai.send(value);}}}><textarea value={text} onChange={e=>setText(e.target.value)} rows={2} maxLength={24000} placeholder="Talk to your AI…" aria-label="Message your AI"/><button className="fire" disabled={!ai.connection||!ai.contextProject||ai.busy||ai.recoverable||!text.trim()||(!ai.runners?.[ai.provider].signedIn||!ai.runners?.[ai.provider].compatible)}>Send</button></form>
 </>;
}
