import {spawnSync} from 'node:child_process';
import {join} from 'node:path';
const allowed=new Set(['idle','walk','attack','dodge','hit','victory']);
export async function POST(request:Request){
 if(process.env.NODE_ENV==='production'||process.env.HAGGS_GAME_FIXTURE!=='1')return new Response('Unavailable',{status:404});
 if(Number(request.headers.get('content-length')??0)>512)return new Response('Invalid request',{status:400});
 let body:unknown;try{body=await request.json();}catch{return new Response('Invalid request',{status:400});}
 const action=(body as {action?:unknown})?.action;if(typeof action!=='string'||!allowed.has(action))return new Response('Invalid action',{status:400});
 const result=spawnSync('python3',[join(process.cwd(),'scripts/game-director-local-preview.py')],{input:JSON.stringify({action}),timeout:10000,maxBuffer:1_000_000,env:{PATH:process.env.PATH??'/usr/bin:/bin',NODE_ENV:'development'},windowsHide:true});
 if(result.error||result.status!==0||!result.stdout.length)return new Response('Preview unavailable',{status:503});
 return new Response(result.stdout,{headers:{'Content-Type':'image/png','Cache-Control':'no-store'}});
}
