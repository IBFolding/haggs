import {verifyUser} from '../../../../server/auth';
import {checkOwnedComfy} from '../../../../server/comfy-owned-connection';
const reply=(message:string,status:number)=>Response.json({message},{status,headers:{'Cache-Control':'no-store'}});
/** Request body is never logged or stored. Preview is disabled by default. */
export async function POST(request:Request){
 if(process.env.HAGGS_OWN_COMFY_SETUP_PREVIEW!=='1') return reply('This connection is not available yet.',503);
 if(!await verifyUser(request)) return reply('Sign in to check your deployment.',401);
 const length=Number(request.headers.get('content-length')??0);
 if(!Number.isSafeInteger(length)||length>4096||length<0) return reply('Invalid request.',400);
 let body:unknown;
 try {
  if(!request.body)return reply('Invalid request.',400);
  const reader=request.body.getReader(),chunks:Uint8Array[]=[];let size=0;
  try {for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>4096){await reader.cancel();return reply('Invalid request.',400);}chunks.push(value);}} finally {reader.releaseLock();}
  body=JSON.parse(Buffer.concat(chunks).toString('utf8'));
 } catch {return reply('Invalid request.',400);}
 if(!body || typeof body!=='object' || Array.isArray(body))return reply('Invalid request.',400);
 const {address,key}=body as Record<string,unknown>;
 if(typeof address!=='string'||address.length>300||typeof key!=='string'||!key.trim()||key.length>1000)return reply('Enter your deployment URL and API key.',400);
 try{await checkOwnedComfy(address,key);return reply('Connection check passed. Your key was not saved; workflow runs are not available yet.',200);}
 catch{return reply('Could not verify this connection. Check your deployment URL and key; no workflow was submitted.',400);}
}
