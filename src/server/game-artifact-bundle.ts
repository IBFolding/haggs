import {validateAtlasMetadata,validateBranchLabels} from './game-output-validation';
import type {ArtifactRole} from './managed-artifact-save';
type Artifact={node:string;name:string;mime:string;bytes:Uint8Array};
/** Validate the complete set before saving any item; caller supplies owner-scoped durable save. */
export async function persistGameBundle(kind:'atlas'|'branches',artifacts:Artifact[],save:(role:ArtifactRole,bytes:Uint8Array)=>Promise<string>):Promise<Record<string,string>> {
 const videos=artifacts.filter(a=>a.node==='911'&&a.mime==='video/mp4'&&/^[a-zA-Z0-9_.-]{1,128}$/.test(a.name));
 if(kind==='atlas'&&videos.length!==1)throw Error('Incomplete or ambiguous bundle.');
 const expected: {node:string;name:string;mime:string;role:ArtifactRole}[]=kind==='atlas'?[{node:'911',name:videos[0]!.name,mime:'video/mp4',role:'video'},{node:'950',name:'atlas.png',mime:'image/png',role:'atlas'},{node:'950',name:'atlas.json',mime:'application/json',role:'manifest'}]:[0,1,2].map(i=>({node:'9000',name:`branch-${i}.mp4`,mime:'video/mp4',role:`branch${i}` as ArtifactRole})).concat({node:'9000',name:'branches.json',mime:'application/json',role:'branches'});
 if(artifacts.length!==expected.length)throw Error('Incomplete bundle.');
 const selected=expected.map(e=>{const matches=artifacts.filter(a=>a.node===e.node&&a.name===e.name&&a.mime===e.mime);if(matches.length!==1)throw Error('Incomplete or ambiguous bundle.');return {...e,bytes:matches[0]!.bytes};});
 for(const item of selected){if(!item.bytes.length||item.bytes.length>200_000_000)throw Error('Invalid artifact size.');if(item.mime==='video/mp4'&&(item.bytes.length<12||Buffer.from(item.bytes.subarray(4,8)).toString('ascii')!=='ftyp'))throw Error('Invalid video artifact.');}
 if(kind==='atlas'){const png=selected.find(a=>a.role==='atlas')!,meta=selected.find(a=>a.role==='manifest')!;validateAtlasMetadata(meta.bytes,png.bytes);}
 else {const meta=selected.find(a=>a.role==='branches')!;if(meta.bytes.length>1_000_000)throw Error('Invalid branch metadata.');let parsed:unknown;try{parsed=JSON.parse(new TextDecoder('utf8',{fatal:true}).decode(meta.bytes));}catch{throw Error('Invalid branch metadata.');}if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw Error('Invalid branch metadata.');validateBranchLabels((parsed as Record<string,unknown>).choices);}
 const result:Record<string,string>={};for(const item of selected)result[item.role]=await save(item.role,item.bytes);return result;
}
