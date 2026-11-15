"use client";
import {useEffect,useState} from 'react';
import {claimProject,projectOwnerKey} from '../story/account-sync';
import {defaultKv} from '../story/kv';
import {createProjectStore} from '../story/store';
import {supabase,useSession} from './session';

export function ProjectAccountLink({id}:{id:string}){
 const {session,ready}=useSession(),user=session?.user.id;
 const [owner,setOwner]=useState<string|null>(null),[loaded,setLoaded]=useState(false),[busy,setBusy]=useState(false),[problem,setProblem]=useState('');
 useEffect(()=>{let active=true;setLoaded(false);setOwner(null);setProblem('');
  void defaultKv().get<string>(projectOwnerKey(id)).then(value=>{if(active){setOwner(value??null);setLoaded(true);}}).catch(()=>{if(active)setProblem('Account sync status could not be read.');});
  return()=>{active=false;};
 },[id,user]);
 if(!ready||!user)return null;
 if(problem)return <p role="alert">{problem}</p>;
 if(!loaded)return <span>Checking account sync…</span>;
 if(owner)return <span>{owner===user?'Account sync enabled':'Device copy linked to another account'}</span>;
 return <span><button className="ph-link" disabled={busy} onClick={async()=>{
  setBusy(true);setProblem('');
  try{
   const enroll=async()=>{
    if((await supabase()?.auth.getSession())?.data.session?.user.id!==user)throw Error('The signed-in account changed. Try again.');
    const kv=defaultKv();await claimProject(kv,createProjectStore(kv),user,id);
    setOwner(user);
   };
   if(navigator.locks)await navigator.locks.request('haggs-cloud-sync',enroll);else await enroll();
   window.dispatchEvent(new Event('haggs:sync-now'));
  }catch(error){setProblem(error instanceof Error?error.message:'Could not enable account sync.');}finally{setBusy(false);}
 }}>{busy?'Enabling sync…':'Save to this account'}</button><small> Device-only until you choose to save.</small></span>;
}
