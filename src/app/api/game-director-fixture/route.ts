import {spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
const actions=new Set(['idle','walk','attack','dodge','hit','victory']),shapes=new Set(['circle','cone','rectangle']);
const enabled=()=>process.env.NODE_ENV!=='production'&&process.env.HAGGS_GAME_FIXTURE==='1';
const dir=join(tmpdir(),'haggs-game-fixture-v1');
export async function POST(request:Request){
 if(!enabled())return new Response('Unavailable',{status:404});
 if(Number(request.headers.get('content-length')??0)>512)return new Response('Invalid request',{status:400});
 let body:unknown;try{body=await request.json();}catch{return new Response('Invalid request',{status:400});}
 const {mode,action,shape}=(body??{}) as Record<string,unknown>;
 if(mode==='pose'?(typeof action!=='string'||!actions.has(action)):mode==='telegraph'?(typeof shape!=='string'||!shapes.has(shape)):true)return new Response('Invalid selection',{status:400});
 const result=spawnSync('python3',[join(process.cwd(),'scripts/game-director-local-preview.py')],{input:JSON.stringify({mode,action,shape}),timeout:10000,maxBuffer:1_000_000,env:{PATH:process.env.PATH??'/usr/bin:/bin',NODE_ENV:'development'},windowsHide:true});
 if(result.error||result.status!==0||!result.stdout.length)return new Response('Preview unavailable',{status:503});
 const id=randomUUID();await mkdir(dir,{recursive:true,mode:0o700});await writeFile(join(dir,`${id}.png`),result.stdout,{mode:0o600,flag:'wx'});
 return Response.json({id},{headers:{'Cache-Control':'no-store'}});
}
export async function GET(request:Request){
 if(!enabled())return new Response('Unavailable',{status:404});
 const id=new URL(request.url).searchParams.get('id');if(!id||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))return new Response('Invalid reference',{status:400});
 try{return new Response(await readFile(join(dir,`${id}.png`)),{headers:{'Content-Type':'image/png','Cache-Control':'no-store'}});}catch{return new Response('Not found',{status:404});}
}
