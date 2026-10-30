import type {Journal,JournalEntry} from './managed-job-journal';
export type ActionMode='drag-to-action'|'boss-fight'|'moveset'|'branches'|'reskin'|'telegraph'|'vfx-mask'|'vfx-reuse'|'recorded-room';
/** Each operation must atomically bind or check the immutable mode in the same record as the job. */
export type ActionJournalStore={begin(entry:JournalEntry,mode:ActionMode):Promise<boolean>;read(user:string,id:string):Promise<{entry:JournalEntry;mode:ActionMode}|null>;accept(user:string,id:string,mode:ActionMode,jobId:string,url:string):Promise<boolean>};
export function bindActionJournal(store:ActionJournalStore,mode:ActionMode):Journal{return {
 begin:entry=>store.begin(entry,mode),
 read:async(user,id)=>{const row=await store.read(user,id);return row?.mode===mode?row.entry:null;},
 accept:(user,id,job,url)=>store.accept(user,id,mode,job,url),
};}
