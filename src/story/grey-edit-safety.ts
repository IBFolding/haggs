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
