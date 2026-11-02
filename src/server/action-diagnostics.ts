/** Fixed labels only: never pass prompts, user/project IDs, URLs or errors here. */
type ActionName = 'media_generation' | 'video_edit';
type Event = {event:'action_started';action:ActionName}|{event:'action_finished';action:ActionName;outcome:'returned'|'threw';durationMs:number};
type Sink = (event:Event)=>void;
const log:Sink=(event)=>console.info(JSON.stringify(event));

/** Logging failure must never affect a run, its billing, or its result. */
export async function diagnoseAction<T>(action:ActionName,work:()=>Promise<T>,sink:Sink=log):Promise<T>{
 const start=performance.now();
 const emit=(event:Event)=>{try{sink(event);}catch{/* Diagnostics never change action behavior. */}};
 emit({event:'action_started',action});
 let outcome:'returned'|'threw'='threw';
 try{const result=await work();outcome='returned';return result;}
 finally{emit({event:'action_finished',action,outcome,durationMs:Math.max(0,Math.round(performance.now()-start))});}
}
