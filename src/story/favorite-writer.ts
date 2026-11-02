/** Saves snapshots in order, including after a failed write. */
export function createFavoriteWriter(save:(value:string[])=>Promise<void>){
 let tail:Promise<void>=Promise.resolve();
 return (value:string[]):Promise<void>=>{
  const snapshot=[...value];
  const current=tail.catch(()=>{}).then(()=>save(snapshot));
  tail=current;
  return current;
 };
}
