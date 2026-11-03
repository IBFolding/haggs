'use client';
import {useEffect,useState} from 'react';
import {greySpendingStatus,setGreySpendingCap} from '../../../grey-spending-actions';
import type {GreySpendStatus} from '../../../../server/grey-spending';
/** A small chip ("Cap: not set" or "$x left") that opens the full spending-cap form on click. The cap rules themselves are unchanged. */
export function GreySpendingPanel(){
 const [amount,setAmount]=useState(''),[status,setStatus]=useState<GreySpendStatus|null>(null),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[open,setOpen]=useState(false);
 async function load(){const result=await greySpendingStatus();if(result.ok){setStatus(result.status);setAmount(String(result.status?.capUsd??0));}else setMessage(result.reason);}
 useEffect(()=>{void load();},[]);
 const left=status&&status.capUsd>0?Math.max(0,status.capUsd-status.chargedUsd-status.reservedUsd):null;
 const label=left===null?'Cap: not set':`$${left.toFixed(2)} left`;
 return <div className="gw-cap"><button type="button" className="gw-cap-chip" aria-expanded={open} aria-controls="gw-cap-form" title="Your Grey Room spending cap" onClick={()=>setOpen(!open)}>{label}</button>{open&&<section id="gw-cap-form" className="gw-cap-pop" aria-label="Grey Room spending cap"><h3>Your Grey Room spending cap</h3><p>No paid requests until you set a cap. This is a total budget, not a monthly reset. Unresolved provider charges remain reserved.</p>{status&&<p>Charged ${status.chargedUsd.toFixed(2)} · Reserved ${status.reservedUsd.toFixed(2)}</p>}<label>Total limit in USD <input type="number" min="0" max="10000" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)}/></label><button className="pill" disabled={busy||!amount.trim()} onClick={async()=>{setBusy(true);try{const result=await setGreySpendingCap(Number(amount));setMessage(result.ok?'Spending cap saved.':result.reason);if(result.ok)await load();}finally{setBusy(false);}}}>Save cap</button><p role="status">{message}</p><p>Actions without a verified maximum provider charge remain unavailable to protect this limit.</p></section>}</div>;
}
