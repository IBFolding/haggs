import {exportProject,importBundle} from "./transfer";
import {importSheets} from "../sheets/sheets";
import type {Kv} from './kv';
import type {ProjectStore} from './store';
import {syncProjects,type Portable,type Remote} from './cloud-sync';

export const projectOwnerKey=(id:string)=>`sync/project-owner/${encodeURIComponent(id)}`;
export const syncStatusKey=(owner:string)=>`sync/account/${encodeURIComponent(owner)}/status`;
export type SyncStatus={owner:string;at:number;state:'syncing'|'saved'|'error';waiting:number;skipped:string[];problem:string|null};
const accountPrefix=(owner:string)=>`sync/account/${encodeURIComponent(owner)}/`;

/** Explicitly enroll a device project; signing in never claims another person's local work. */
export async function claimProject(kv:Kv,store:ProjectStore,owner:string,id:string){
 if(!owner)throw Error('Sign in before saving a project to your account.');
 const existing=await kv.get<string>(projectOwnerKey(id));
 if(existing&&existing!==owner)throw Error('This project belongs to another account on this device. Import a production pack to create a separate copy.');
 if(!await store.load(id))throw Error('That project is no longer on this device.');
 await kv.set(projectOwnerKey(id),owner);
}

/** Scope caches/tombstones to the account and guard every asynchronous boundary against sign-out. */
export async function syncAccount(kv:Kv,store:ProjectStore,remote:Remote,owner:string,portable?:Portable,isCurrent:()=>boolean=()=>true){
 if(!owner)throw Error('Sign in before syncing.');
 const check=()=>{if(!isCurrent())throw Error('The signed-in account changed. Sync stopped.');};
 const ours=async(id:string)=>{check();return await kv.get<string>(projectOwnerKey(id))===owner;};
 const prefix=accountPrefix(owner);
 const scoped:Kv={
  get:async<T>(key:string)=>{check();return kv.get<T>(key.startsWith('sync/')?prefix+key.slice(5):key);},
  set:async(key,value)=>{check();await kv.set(key.startsWith('sync/')?prefix+key.slice(5):key,value);},
  remove:async key=>{check();await kv.remove(key.startsWith('sync/')?prefix+key.slice(5):key);},
 };
 const owned:ProjectStore={
  list:async()=>{const all=await store.list();const allowed=await Promise.all(all.map(async p=>await ours(p.id)?p:null));check();return allowed.filter(p=>p!==null);},
  load:async id=>await ours(id)?store.load(id):undefined,
  save:async project=>{if(!await ours(project.id))throw Error('Project is not assigned to this account.');check();await store.save(project);},
  keep:async project=>{
   check();const prior=await kv.get<string>(projectOwnerKey(project.id)),local=await store.load(project.id);check();
   if(prior!==owner&&(prior||local))throw Error('An account project conflicts with a device copy. Export the device copy before restoring it.');
   await kv.set(projectOwnerKey(project.id),owner);check();await store.keep(project);
  },
  remove:async id=>{if(!await ours(id))throw Error('Project is not assigned to this account.');check();await store.remove(id);},
 };
 const guarded:Remote={
  list:async()=>{check();const value=await remote.list();check();return value;},
  get:async id=>{check();const value=await remote.get(id);check();if(value){if(value.project.id!==id)throw Error('The account returned a different project.');importBundle(exportProject(value.project));if(value.sheets!==null)importSheets(value.sheets);}return value;},
  put:async(project,sheets)=>{check();await remote.put(project,sheets);check();},
  remove:async id=>{check();await remote.remove(id);check();},
 };
 const safePortable=portable?{...portable,keep:async(url:string)=>{check();const value=await portable.keep(url);check();return value;}}:undefined;
 return syncProjects(scoped,owned,guarded,safePortable);
}
