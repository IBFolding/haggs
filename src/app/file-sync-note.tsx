"use client";
import {useEffect,useState} from 'react';
import {syncStatusKey,type SyncStatus} from '../story/account-sync';
import {defaultKv} from '../story/kv';
import {useSession} from './session';
/** Kept for older local migration receipts; new status is account-scoped. */
export const FILE_SYNC='sync/file-state';

export function FileSyncNote(){
 const {session}=useSession(),user=session?.user.id;
 const [state,setState]=useState<SyncStatus|null>(null);
 useEffect(()=>{
  let active=true;setState(null);if(!user)return;
  const load=()=>{void defaultKv().get<SyncStatus>(syncStatusKey(user)).then(value=>{if(active)setState(value??null);}).catch(()=>{if(active)setState({owner:user,at:Date.now(),state:'error',waiting:-1,skipped:[],problem:'Sync status is unavailable. Your device copies are still here.'});});};
  load();const timer=setInterval(load,15000);window.addEventListener('haggs:sync-status',load);
  return()=>{active=false;clearInterval(timer);window.removeEventListener('haggs:sync-status',load);};
 },[user]);
 if(!user)return null;
 const current=state?.owner===user?state:null;
 return <section aria-label="Account project sync" className="sh-note">
  <p role="status">{!current?'Account projects will restore here. Device-only projects stay local until you choose Save to this account.':current.state==='syncing'?'Syncing account projects…':current.state==='error'?current.problem:current.waiting>0?`${current.waiting} files are still being copied. Keep this tab open.`:current.problem?current.problem:current.skipped.length?'Some projects are too large to sync. Export their production packs.':`Account sync completed at ${new Date(current.at).toLocaleTimeString()}.`}</p>
  {!!current?.skipped.length&&<p>Not synced: {current.skipped.join(', ')}</p>}
  <button className="pill" disabled={current?.state==='syncing'} onClick={()=>window.dispatchEvent(new Event('haggs:sync-now'))}>Sync now</button>
  <p>Only projects with account sync enabled are uploaded. Export a production pack for an additional backup.</p>
 </section>;
}
