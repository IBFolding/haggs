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
 if(Number(request.headers.get('content-length')??0)>700000)return new Response('Invalid request',{status:400});
 let body:unknown;try{const reader=request.body?.getReader();if(!reader)return new Response('Invalid request',{status:400});const chunks:Uint8Array[]=[];let size=0;try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>700000){await reader.cancel();return new Response('Invalid request',{status:400});}chunks.push(value);}}finally{reader.releaseLock();}body=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{return new Response('Invalid request',{status:400});}
 const {mode,action,shape,path,impact,image}=(body??{}) as Record<string,unknown>;
 if(['pose','boss','moveset'].includes(String(mode))?(typeof action!=='string'||!actions.has(action)):mode==='telegraph'?(typeof shape!=='string'||!shapes.has(shape)):mode==='reskin'?(typeof image!=='string'||image.length>670000||! /^[A-Za-z0-9+/]*={0,2}$/.test(image)):true)return new Response('Invalid selection',{status:400});
 if(path!==undefined&&(!Array.isArray(path)||path.length<2||path.length>50||path.some(p=>!Array.isArray(p)||p.length!==3||p.some(n=>typeof n!=='number'||!Number.isFinite(n)||n<0||n>1))))return new Response('Invalid path',{status:400});
 if(impact!==undefined&&(typeof impact!=='number'||!Number.isFinite(impact)||impact<.05||impact>.45))return new Response('Invalid timing',{status:400});
 const result=spawnSync('python3',[join(process.cwd(),'scripts/game-director-local-preview.py')],{input:JSON.stringify({mode,action,shape,path,impact,image}),timeout:10000,maxBuffer:1_000_000,env:{PATH:process.env.PATH??'/usr/bin:/bin',NODE_ENV:'development'},windowsHide:true});
 if(result.error||result.status!==0||!result.stdout.length)return new Response('Preview unavailable',{status:503});
 const id=randomUUID();await mkdir(dir,{recursive:true,mode:0o700});await writeFile(join(dir,`${id}.png`),result.stdout,{mode:0o600,flag:'wx'});
 const metadata={kind:mode,procedural:true,frames:mode==='moveset'?12:1,fps:mode==='moveset'?24:null,rectangles:mode==='moveset'?Array.from({length:12},(_,i)=>({frame:i,x:(i%4)*64,y:Math.floor(i/4)*64,width:64,height:64})):[],action:['telegraph','reskin'].includes(String(mode))?null:action,shape:mode==='telegraph'?shape:null};await writeFile(join(dir,`${id}.json`),JSON.stringify(metadata),{mode:0o600,flag:'wx'});
 return Response.json({id},{headers:{'Cache-Control':'no-store'}});
}
export async function GET(request:Request){
 if(!enabled())return new Response('Unavailable',{status:404});
 const id=new URL(request.url).searchParams.get('id');if(!id||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))return new Response('Invalid reference',{status:400});
 try{const json=new URL(request.url).searchParams.get('format')==='json';return new Response(await readFile(join(dir,`${id}.${json?'json':'png'}`)),{headers:{'Content-Type':json?'application/json':'image/png','Cache-Control':'no-store'}});}catch{return new Response('Not found',{status:404});}
}
