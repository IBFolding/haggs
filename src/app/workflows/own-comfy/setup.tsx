'use client';
import {useState} from 'react';
import {checkConnection} from './actions';

export function Setup(){
 const [address,setAddress]=useState(''),[key,setKey]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 return <main className="canvas"><h1>Connect your Comfy deployment</h1>
 <p>Run supported Haggs workflows on a deployment in your own Comfy account. Comfy bills that account for GPU time and model storage; model storage can be billed while the deployment is paused.</p>
 <ol><li>Create a Comfy API deployment with the workflow’s required nodes and models.</li><li>Enter the deployment URL and an API key from that account.</li><li>Check the connection. Workflow execution is still being tested.</li></ol>
 <p><a href="https://docs.comfy.org/development/serverless/overview" target="_blank" rel="noreferrer">Comfy deployment and billing guide</a></p>
 <form onSubmit={async e=>{e.preventDefault();setBusy(true);setMessage('');try{const result=await checkConnection(address,key);setMessage(result.message);}catch{setMessage('The connection check failed. Try again.');}finally{setKey('');setBusy(false);}}}>
 <label>Deployment URL <input type="url" value={address} onChange={e=>setAddress(e.target.value)} placeholder="https://your-deployment.run.comfy.app" required autoComplete="off" /></label>
 <label>Comfy API key <input type="password" value={key} onChange={e=>setKey(e.target.value)} required autoComplete="off" /></label>
 <p>Your key is sent only for this check, is not saved, and must be entered again for another check. Only use a deployment you trust.</p>
 <button type="submit" disabled={busy||!address||!key}>{busy?'Checking…':'Check connection'}</button>
 {message&&<p role="status">{message}</p>}</form>
 <p>Preview only: connecting and running workflows is not yet available. A successful check does not verify installed nodes or models.</p></main>;
}
