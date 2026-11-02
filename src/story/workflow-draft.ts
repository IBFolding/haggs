import type {Kv} from './kv';
import type {Canvas} from '../comfy/canvas';

/** Serializes each draft's writes and waits for pending writes before reloading it. */
export function createWorkflowDraftStore(kv:Kv){
 const pending=new Map<string,Promise<void>>();
 return {
  async load(key:string):Promise<Canvas|undefined>{const write=pending.get(key);if(write)await write;return kv.get<Canvas>(key);},
  save(key:string,canvas:Canvas):Promise<void>{
   let snapshot:Canvas;
   try{snapshot=structuredClone(canvas);}catch(error){return Promise.reject(error);}
   const previous=pending.get(key);
   const next=(previous?previous.catch(()=>{}):Promise.resolve()).then(()=>kv.set(key,snapshot));
   pending.set(key,next);void next.then(()=>{if(pending.get(key)===next)pending.delete(key);},()=>{});
   return next;
  },
 };
}
