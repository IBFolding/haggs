import {createHash} from 'node:crypto';
import type {GpuOutput} from '../providers/local';
import {cookies} from 'next/headers';
import {localIn} from './keys';
import {localBase} from '../providers/local';
import {userNow} from './auth';
import {RENTED_COOKIE, rentedBase, rentedFetch, unsealConnection} from './rented-gpu';
export async function rentedConnection() {
  const value=(await cookies()).get(RENTED_COOKIE)?.value;
  if(!value)return;
  const owner=process.env.NODE_ENV==='production'?(await userNow())?.id:'local-development';
  if(!owner)throw Error('Sign in again to use your rented GPU. No job was submitted.');
  const data=unsealConnection(value,owner);
  if(!data)throw Error('Reconnect your rented GPU: the saved connection expired or the host key changed. No job was submitted.');
  return data;
}
export async function gpuIn():Promise<string|undefined> { return (await rentedConnection())?.base ?? localIn(await cookies()); }
/** Public origins are only reachable when the encrypted connection matches. Local validation remains unchanged. */
export function gpuBase(address:string) { try {return localBase(address);} catch {return rentedBase(address);} }
export const gpuFetch:typeof fetch=async(input,init)=>{
  const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
  const connection=await rentedConnection();
  if(connection && url.origin===connection.base)return rentedFetch(connection)(input,init);
  localBase(url.origin);
  return fetch(input,{...init,redirect:'error'});
};

/** Results stay on the rented disk, with an authenticated view URL instead of Haggs storage. */
export function gpuResultUrl(connection:{base:string;token:string;owner:string},file:GpuOutput):string {
  const endpoint=createHash('sha256').update(JSON.stringify([connection.base,connection.token,connection.owner])).digest('hex').slice(0,32);
  return '/api/gpu/output?'+new URLSearchParams({endpoint,filename:file.filename,subfolder:file.subfolder??''});
}
export async function readGpuOutput(source:string):Promise<Response> {
  const parsed=new URL(source,'https://haggs.invalid');
  if(!source.startsWith('/api/gpu/output?') || parsed.pathname!=='/api/gpu/output' || parsed.search.length>1000)throw Error('Invalid GPU result.');
  const connection=await rentedConnection();
  if(!connection)throw Error('Reconnect the original GPU to view this result.');
  const filename=parsed.searchParams.get('filename')??'',subfolder=parsed.searchParams.get('subfolder')??'';
  if(!/^[\w .-]{1,200}\.(mp4|webm|png|jpe?g|webp|mp3|flac|wav)$/i.test(filename) || subfolder.length>200 || subfolder.split('/').some(part=>part==='..'||part==='.') || /[\\\x00-\x1f]/.test(subfolder))throw Error('Invalid GPU result filename.');
  if(new URL(gpuResultUrl(connection,{filename,subfolder}),'https://haggs.invalid').searchParams.get('endpoint')!==parsed.searchParams.get('endpoint'))throw Error('Reconnect the original GPU and gateway token to view this result.');
  return rentedFetch(connection)(connection.base+'/view?'+new URLSearchParams({filename,subfolder,type:'output'}),{signal:AbortSignal.timeout(120000)});
}
