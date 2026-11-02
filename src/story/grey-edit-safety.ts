import type { GreyScene } from "./grey-scene";

/** Complete a cut-out only on the source that was sent to the provider. */
export function finishCutout(current: GreyScene, requestedSource: GreyScene["source"], matte: NonNullable<GreyScene["matte"]>): GreyScene | null {
  const source = current.source;
  if (!!source !== !!requestedSource || (source && requestedSource && (source.url !== requestedSource.url || source.kind !== requestedSource.kind || source.revision !== requestedSource.revision || (source.trimIn ?? 0) !== (requestedSource.trimIn ?? 0)))) return null;
  return { ...current, matte };
}

/** Preserve a visible, debounced edit as the first undo step. */
export function undoPending<T>(history: { push(value: T): void; undo(): T | null }, pending: T | undefined): T | null {
  if (pending !== undefined) history.push(pending);
  return history.undo();
}

export type GreyEditState = { grey: import("./grey").GreyFrame | undefined; scene: GreyScene };
/** Restore only editable setup data. Takes, render results, approvals and other shot fields stay current. */
export function restoreGreyEdit(shot: import("./model").Shot, state: GreyEditState): import("./model").Shot {
  const {grey:_old,...rest}=shot;
  return {...rest,...(state.grey?{grey:state.grey}:{}),greyScene:state.scene};
}

/** Scene data is JSON-shaped; ignore key order and absent optional fields when detecting no-op edits. */
export function sameGreyEdit(a:GreyEditState,b:GreyEditState):boolean {
  const same=(x:unknown,y:unknown):boolean=>{
    if(x===y)return true;
    if(!x||!y||typeof x!=="object"||typeof y!=="object")return false;
    if(Array.isArray(x)||Array.isArray(y))return Array.isArray(x)&&Array.isArray(y)&&x.length===y.length&&x.every((v,i)=>same(v,y[i]));
    const left=x as Record<string,unknown>,right=y as Record<string,unknown>;
    const keys=Object.keys(left).filter(k=>left[k]!==undefined),other=Object.keys(right).filter(k=>right[k]!==undefined);
    return keys.length===other.length&&keys.every(k=>same(left[k],right[k]));
  };
  return same(a,b);
}
