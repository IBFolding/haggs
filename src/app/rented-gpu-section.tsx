"use client";
import {useEffect,useState} from 'react';
import {rentedGpu,saveRentedGpu,clearRentedGpu} from './actions';
export function RentedGpuSection({refresh,onConnected}:{refresh:number;onConnected:()=>void}) {
  const [base,setBase]=useState(''),[token,setToken]=useState(''),[connected,setConnected]=useState<string|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  useEffect(()=>{let active=true;void rentedGpu().then(value=>{if(active)setConnected(value?.base??null);}).catch(()=>{if(active)setMessage('Could not load the GPU connection.');});return()=>{active=false;};},[refresh]);
  return <section className="key-row"><header><b>Rented GPU</b><span className={`lamp${connected?' live':''}`} /><span className="key-status">{connected?'connected':'not connected'}</span></header>
    <p className="key-blurb">Use a GPU you already rent from RunPod, Vast.ai or another host, running ComfyUI behind an authenticated HTTPS gateway. Open-weight workflows use your installed models; partner models still require Comfy Cloud.</p>
    <ol><li>Start your GPU and install the workflow’s models and nodes.</li><li>Protect ComfyUI with a bearer-token gateway. Copy its HTTPS root URL.</li><li>Check and connect below, then choose <b>Your GPU</b> in a workflow and run its preflight.</li></ol>
    <p><a href="/runpod">Using RunPod Serverless instead? Open its queue setup →</a></p>
    <p><a href="/guides/rented-gpu" target="_blank" rel="noreferrer">GPU setup guide</a></p>
    {connected && <p>Active endpoint: {connected}</p>}
    <label>GPU gateway URL<input aria-label="GPU gateway URL" value={base} onChange={e=>setBase(e.target.value)} placeholder="https://your-gpu.example.com" autoComplete="off" /></label>
    <label>Gateway bearer token<input aria-label="GPU gateway bearer token" type="password" value={token} onChange={e=>setToken(e.target.value)} placeholder="Gateway token, not a RunPod or Vast API key" autoComplete="new-password" /></label>
    <div className="sheet-row"><button className="plain" disabled={busy||!base.trim()||!token} onClick={async()=>{setBusy(true);setMessage('');try{const result=await saveRentedGpu(base.trim(),token);setToken('');if(result.ok){setConnected(result.base);onConnected();setMessage(`Connected: ${result.gpu}. No render submitted.`);}else setMessage(result.reason);}catch{setToken('');setMessage('Connection check failed. No render was submitted.');}finally{setBusy(false);}}}>{busy?'Checking…':'Check and connect'}</button>
    {connected && <button className="plain" disabled={busy} onClick={async()=>{setBusy(true);try{await clearRentedGpu();setConnected(null);setMessage('Disconnected from Haggs. Stop your rental separately to stop its compute charges.');}catch{setMessage('Disconnect failed. Try again.');}finally{setBusy(false);}}}>Disconnect rented GPU</button>}</div>
    {message && <p role="status">{message}</p>}
    <p className="sh-note">Checks read GPU status and installed nodes only. Your token is encrypted in a server-readable cookie for seven days. Results stay on your rented disk; download them before stopping or deleting it. Provider compute and storage bills are separate from Studio Access. Disconnecting does not stop a rental. If you run Haggs on your computer, an SSH tunnel can also connect through Local GPU.</p>
  </section>;
}
