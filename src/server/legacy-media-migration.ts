import { createHash } from "node:crypto";
import { privateMediaUrl } from "./private-media-url";
export type LegacyObject = { url: string; owner: string; bytes: number; sha256: string };
export type VerifiedCopy = { source: string; destination: string; bytes: number; sha256: string };
/** Offline planning only: this module never contacts storage or deletes objects. */
export function planLegacyCopies(objects: LegacyObject[], trustedOrigin: string) {
 const origin=new URL(trustedOrigin);
 if(origin.protocol!=="https:"||!origin.hostname.endsWith(".public.blob.vercel-storage.com")||origin.origin!==trustedOrigin)throw Error("Use the exact trusted legacy store origin.");
 const seen=new Set<string>();
 return objects.map(object=>{
  const source=new URL(object.url);
  if(source.origin!==trustedOrigin||source.username||source.password||source.search||source.hash||seen.has(object.url))throw Error("Invalid or duplicate legacy source.");
  if(!/^[0-9a-f-]{36}$/.test(object.owner)||!source.pathname.startsWith(`/haggs/u-${object.owner}/`)||!Number.isSafeInteger(object.bytes)||object.bytes<=0||!/^[0-9a-f]{64}$/.test(object.sha256))throw Error("Invalid legacy inventory.");
  const ext=/\.(mp4|webm|mov|png|jpe?g|webp|mp3|m4a|aac|flac|wav)$/.exec(source.pathname)?.[1];
  if(!ext)throw Error("Unsupported legacy media.");
  seen.add(object.url);
  const key=createHash("sha256").update(object.url).digest("hex");
  return {...object,destination:privateMediaUrl(`haggs/u-${object.owner}/migrated/${key}.${ext}`)};
 });
}
/** Reference rewriting is permitted only after every planned copy is independently verified. */
export function verifiedReferenceMap(plan: ReturnType<typeof planLegacyCopies>, copies: VerifiedCopy[]): Map<string,string> {
 const mapping=new Map<string,string>();
 if(copies.length!==plan.length)throw Error("Copy verification is incomplete.");
 for(const object of plan){
  const matches=copies.filter(copy=>copy.source===object.url);
  const copy=matches[0];
  if(matches.length!==1||!copy||copy.destination!==object.destination||copy.bytes!==object.bytes||copy.sha256!==object.sha256)throw Error("Copy verification failed.");
  mapping.set(object.url,object.destination);
 }
 return mapping;
}
/** Operates on an exported JSON snapshot; caller retains the original for rollback. */
export function rewriteMediaReferences(value: unknown, mapping: ReadonlyMap<string,string>): unknown {
 if(typeof value==="string")return mapping.get(value)??value;
 if(Array.isArray(value))return value.map(item=>rewriteMediaReferences(item,mapping));
 if(value&&typeof value==="object")return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,rewriteMediaReferences(item,mapping)]));
 return value;
}
