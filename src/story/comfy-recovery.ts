/** Identity for one Comfy output, including its folder. Older records omitted it. */
export type RecoveryFile = {job:string;filename:string;subfolder:string};
export const recoveryId=(file:RecoveryFile)=>`v2:${JSON.stringify([file.job,file.subfolder,file.filename])}`;
const legacyId=(file:RecoveryFile)=>`${file.job}:${file.filename}`;

/** Older records cannot identify a folder when a job contains same-named files. */
export function hasAmbiguousLegacy(items:RecoveryFile[],added:Set<string>):boolean {
 const groups=new Map<string,Set<string>>();
 for(const item of items){const key=legacyId(item),group=groups.get(key)??new Set<string>();group.add(recoveryId(item));groups.set(key,group);}
 return [...groups].some(([key,group])=>added.has(key)&&group.size>1);
}

/** Keep ambiguous legacy matches visible rather than hiding a different file. */
export function unrecovered<T extends RecoveryFile>(items:T[],added:Set<string>):T[]{
 const groups=new Map<string,Set<string>>();
 for(const item of items){const key=legacyId(item),group=groups.get(key)??new Set<string>();group.add(recoveryId(item));groups.set(key,group);}
 const seen=new Set<string>();
 return items.filter(item=>{const id=recoveryId(item);if(seen.has(id))return false;seen.add(id);return !added.has(id)&&!(added.has(legacyId(item))&&groups.get(legacyId(item))?.size===1);});
}
