import {createServer,type IncomingMessage,type ServerResponse} from 'node:http';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {spawn,type ChildProcess} from 'node:child_process';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {HAGGY_TOOLS} from '../agent/tool-definitions';
import {allowedOrigin,PROTOCOL,turnSchema,toolResponseSchema,type ChatEvent,type PersonalTurn} from './protocol';
import {cliArgs,outputText,runnerEnv,runnerPrompt,runnerStatus} from './cli';

type Job={turn:PersonalTurn;owner:string;token:string;events:ChatEvent[];listeners:Set<ServerResponse>;pending:Map<string,{resolve:(value:unknown)=>void;timer:ReturnType<typeof setTimeout>}>;answers:Map<string,unknown>;terminal:boolean;child?:ChildProcess;cleanup?:()=>Promise<void>;timer?:ReturnType<typeof setTimeout>;text:string;finished:boolean;};
const same=(a:string,b:string)=>{const left=Buffer.from(a),right=Buffer.from(b);return left.length===right.length&&timingSafeEqual(left,right);};
const secret=()=>randomBytes(24).toString('hex');
const noStore={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const names=new Set(HAGGY_TOOLS.map(t=>t.name));
export type CompanionOptions={port?:number;origins?:string[];pairCode?:string;status?:typeof runnerStatus;launch?:(turn:PersonalTurn,bridge:{url:string;token:string})=>Promise<{child:ChildProcess;cleanup:()=>Promise<void>}>;onPairCode?:(code:string)=>void};

/** Loopback only; pairing is one-use, browser sessions are origin-bound, each MCP token is job-bound. */
export function createCompanion(options:CompanionOptions={}){
 let pairCode=options.pairCode??randomBytes(6).toString('hex').toUpperCase(),pairUntil=Date.now()+600000;
 const sessions=new Map<string,{origin:string;until:number}>(),jobs=new Map<string,Job>();let attempts:number[]=[],closing=false;
 const status=options.status??runnerStatus;
 const emit=(job:Job,event:Omit<ChatEvent,'seq'>)=>{if(job.terminal)return;const made={...event,seq:job.events.length+1};job.events.push(made);for(const res of job.listeners)res.write(`data: ${JSON.stringify(made)}\n\n`);};
 const finish=(job:Job,type:'done'|'error'|'canceled',text?:string)=>{if(job.terminal)return;emit(job,{type,...(text?{text}:{})});job.terminal=true;if(job.timer)clearTimeout(job.timer);for(const p of job.pending.values()){clearTimeout(p.timer);p.resolve({error:'The conversation stopped.'});}job.pending.clear();for(const res of job.listeners)res.end();job.listeners.clear();};
 const kill=(job:Job)=>{const child=job.child;if(!child||child.exitCode!==null||child.signalCode!==null)return;try{if(process.platform!=='win32'&&child.pid)process.kill(-child.pid,'SIGTERM');else child.kill('SIGTERM');}catch{}setTimeout(()=>{if(child.exitCode===null&&child.signalCode===null)try{if(process.platform!=='win32'&&child.pid)process.kill(-child.pid,'SIGKILL');else child.kill('SIGKILL');}catch{}},1500).unref();};
 async function launch(turn:PersonalTurn,bridge:{url:string;token:string}){
  if(options.launch)return options.launch(turn,bridge);
  const cwd=await mkdtemp(join(tmpdir(),'haggy-run-'));const mcpConfig=join(cwd,'mcp.json');
  const loader=pathToFileURL(createRequire(import.meta.url).resolve('tsx')).href,toolScript=fileURLToPath(new URL('../../scripts/haggy-tools.ts',import.meta.url));
  await writeFile(mcpConfig,JSON.stringify({mcpServers:{haggs:{command:process.execPath,args:['--import',loader,toolScript]}}}),{mode:0o600});
  const env={...runnerEnv(),HAGGY_BRIDGE_URL:bridge.url,HAGGY_JOB_TOKEN:bridge.token};
  const child=spawn(turn.provider,cliArgs(turn.provider,{cwd,mcpConfig,node:process.execPath,loader,toolScript}),{cwd,env,stdio:['pipe','pipe','pipe'],detached:process.platform!=='win32',shell:false});
  return {child,cleanup:()=>rm(cwd,{recursive:true,force:true})};
 }
 async function start(job:Job){
  try{
   const ready=status(job.turn.provider);if(!ready.installed||!ready.compatible||!ready.signedIn){finish(job,'error',ready.note);return;}
   emit(job,{type:'status',text:`Starting your ${job.turn.provider==='claude'?'Claude':'Codex'}…`});
   const address=server.address();if(!address||typeof address==='string')throw Error('Connector is not listening.');
   const {child,cleanup}=await launch(job.turn,{url:`http://127.0.0.1:${address.port}/runner/${job.turn.id}`,token:job.token});job.child=child;job.cleanup=cleanup;
   if(job.terminal){kill(job);await cleanup();return;}
   let buffer='',partial=false,hadAssistant=false;
   const text=(value:string)=>{if(!value)return;if(job.text.length+value.length>120000){finish(job,'error','The reply exceeded the conversation limit. Start a new chat.');kill(job);return;}job.text+=value;emit(job,{type:'text',text:value});};
   child.stdout?.on('data',(chunk:Buffer)=>{buffer+=chunk.toString();if(buffer.length>1000000){finish(job,'error','The AI returned an oversized event.');kill(job);return;}
    for(;;){const end=buffer.indexOf('\n');if(end<0)break;const line=buffer.slice(0,end);buffer=buffer.slice(end+1);let event:Record<string,any>;try{event=JSON.parse(line);}catch{continue;}
     if(job.turn.provider==='claude'&&event.type==='assistant'){
      if(!partial){const value=(event.message?.content??[]).filter((c:any)=>c.type==='text').map((c:any)=>c.text).join('\n');if(value)text((hadAssistant?'\n\n':'')+value);}partial=false;hadAssistant=true;
     }
     const parsed=outputText(job.turn.provider,event);
     if(parsed.delta){if(job.turn.provider==='codex')text((job.text?'\n\n':'')+parsed.delta);else{if(!partial&&hadAssistant)text('\n\n');text(parsed.delta);partial=true;}}
     if(parsed.failure){finish(job,'error','Your AI did not complete this turn. Check its local login or usage limits. No automatic retry was made.');kill(job);}
     if(parsed.final){job.finished=true;if(job.turn.provider==='claude'&&!job.text&&typeof event.result==='string'&&!event.is_error)text(event.result);}
    }
   });
   // Consume stderr without logging it: provider diagnostics can contain private paths or authentication details.
   child.stderr?.resume();
   child.on('error',()=>{finish(job,'error','The selected AI could not start. Check its installation and reconnect.');void cleanup();});
   child.on('close',code=>{if(!job.terminal){if(code===0&&job.finished&&job.text.trim())finish(job,'done');else finish(job,'error','The AI stopped without a complete reply. No automatic retry was made.');}void cleanup();});
   child.stdin?.on('error',()=>{});child.stdin?.end(runnerPrompt(job.turn));
  }catch{finish(job,'error','The local runner could not start. No automatic retry was made.');if(job.cleanup)await job.cleanup();}
 }
 async function body(req:IncomingMessage){let size=0;const chunks:Buffer[]=[];for await(const part of req){const chunk=Buffer.from(part);size+=chunk.length;if(size>180000)throw Error('Request is too large.');chunks.push(chunk);}return JSON.parse(Buffer.concat(chunks).toString());}
 const json=(res:ServerResponse,code:number,value:unknown)=>{res.writeHead(code,{'Content-Type':'application/json',...noStore});res.end(JSON.stringify(value));};
 const server=createServer(async(req,res)=>{
  const host=req.headers.host??'',origin=req.headers.origin;const url=new URL(req.url??'/','http://127.0.0.1');
  if(!/^127\.0\.0\.1:\d+$/.test(host)&&!/^localhost:\d+$/.test(host)){json(res,403,{error:'Invalid connector host.'});return;}
  const worker=url.pathname.startsWith('/runner/');
  if(!worker){if(!origin||!allowedOrigin(origin,options.origins)){json(res,403,{error:'This origin is not paired with Haggy.'});return;}res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Methods','GET,POST,DELETE,OPTIONS');res.setHeader('Access-Control-Allow-Headers','Authorization,Content-Type');res.setHeader('Access-Control-Allow-Private-Network','true');}
  if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
  try{
   if(url.pathname==='/health'&&req.method==='GET'){json(res,200,{protocol:PROTOCOL});return;}
   if(url.pathname==='/pair'&&req.method==='POST'){
    attempts=attempts.filter(t=>t>Date.now()-60000);if(attempts.length>=6){json(res,429,{error:'Too many pairing attempts. Wait a minute.'});return;}attempts.push(Date.now());const value=await body(req);
    if(Date.now()>pairUntil||typeof value.code!=='string'||!same(value.code.replace(/-/g,'').toUpperCase(),pairCode)){json(res,403,{error:'Pairing code is invalid or expired. Use the latest code in your connector terminal.'});return;}
    for(const [key,value] of sessions)if(value.until<Date.now())sessions.delete(key);if(sessions.size>=8){json(res,429,{error:'Too many paired browsers. Disconnect one or restart the connector.'});return;}
    const token=secret();sessions.set(token,{origin:origin!,until:Date.now()+8*3600000});pairCode=randomBytes(6).toString('hex').toUpperCase();pairUntil=Date.now()+600000;options.onPairCode?.(pairCode);attempts=[];json(res,200,{protocol:PROTOCOL,token});return;
   }
   const token=/^Bearer ([a-zA-Z0-9]+)$/.exec(req.headers.authorization??'')?.[1]??'';
   if(worker){
    const id=url.pathname.split('/')[2]??'',job=jobs.get(id);if(origin||!job||!same(token,job.token)||job.terminal){json(res,403,{error:'This tool session is unavailable.'});return;}
    if(req.method!=='POST'){json(res,405,{error:'Use POST.'});return;}
    const value=await body(req);if(typeof value.name!=='string'||!names.has(value.name)||!value.input||typeof value.input!=='object'||Array.isArray(value.input)){json(res,400,{error:'Unsupported Haggs tool.'});return;}
    if(value.input.project&&value.input.project!==job.turn.context.project){json(res,403,{error:'This turn can only access its selected project.'});return;}
    if(job.pending.size>=4||job.events.filter(e=>e.type==='tool').length>=24){json(res,429,{error:'Too many tool calls. Start a new turn.'});return;}
    const requestId=crypto.randomUUID();const result=new Promise<unknown>(resolve=>{const timer=setTimeout(()=>{job.pending.delete(requestId);resolve({error:'Browser did not answer. Inspect the project before trying another edit.'});finish(job,'error','The browser disconnected during a tool call. Inspect your project; changes were not retried.');kill(job);},90000);job.pending.set(requestId,{resolve,timer});});
    emit(job,{type:'tool',requestId,name:value.name,input:value.input});json(res,200,await result);return;
   }
   const session=sessions.get(token);if(!session||session.origin!==origin||session.until<Date.now()){json(res,401,{error:'Pair the connector again.'});return;}
   if(url.pathname==='/status'&&req.method==='GET'){json(res,200,{protocol:PROTOCOL,claude:status('claude'),codex:status('codex')});return;}
   if(url.pathname==='/disconnect'&&req.method==='POST'){for(const job of jobs.values())if(job.owner===token&&!job.terminal){finish(job,'canceled');kill(job);}sessions.delete(token);json(res,200,{ok:true});return;}
   if(url.pathname==='/turn'&&req.method==='POST'){
    const turn=turnSchema.parse(await body(req));const previous=jobs.get(turn.id);if(previous){if(previous.owner!==token){json(res,404,{error:'Turn not found.'});return;}if(JSON.stringify(previous.turn)!==JSON.stringify(turn)){json(res,409,{error:'Turn ID already belongs to another message.'});return;}json(res,200,{id:turn.id});return;}
    if([...jobs.values()].some(j=>!j.terminal)){json(res,409,{error:'An AI turn is already running. Finish or stop it first.'});return;}
    if(jobs.size>=100){for(const [id,j]of jobs)if(j.terminal)jobs.delete(id);}
    const job:Job={turn,owner:token,token:secret(),events:[],listeners:new Set(),pending:new Map(),answers:new Map(),terminal:false,text:'',finished:false};jobs.set(turn.id,job);job.timer=setTimeout(()=>{finish(job,'error','The AI turn timed out. No automatic retry was made.');kill(job);},300000);json(res,202,{id:turn.id});void start(job);return;
   }
   const pendingMatch=/^\/turn\/([\w-]+)\/pending\/([\w-]+)$/.exec(url.pathname);
   if(pendingMatch&&req.method==='GET'){const job=jobs.get(pendingMatch[1]!);if(!job||job.owner!==token){json(res,404,{error:'Turn not found.'});return;}json(res,200,{pending:!job.terminal&&job.pending.has(pendingMatch[2]!)});return;}
   const match=/^\/turn\/([\w-]+)(\/result)?$/.exec(url.pathname);if(!match){json(res,404,{error:'Not found.'});return;}const job=jobs.get(match[1]!);if(!job||job.owner!==token){json(res,404,{error:'Turn not found.'});return;}
   if(req.method==='DELETE'){finish(job,'canceled');kill(job);json(res,200,{ok:true});return;}
   if(match[2]&&req.method==='POST'){
    const value=toolResponseSchema.parse(await body(req));if(job.answers.has(value.id)){json(res,200,{ok:true});return;}const pending=job.pending.get(value.id);if(!pending||job.terminal){json(res,409,{error:'This tool request is no longer pending.'});return;}const answer={result:value.result,...(value.error?{error:true}:{})};job.answers.set(value.id,answer);clearTimeout(pending.timer);job.pending.delete(value.id);pending.resolve(answer);json(res,200,{ok:true});return;
   }
   if(req.method==='GET'&&!match[2]){
    const after=Number(url.searchParams.get('after')??0);if(!Number.isSafeInteger(after)||after<0){json(res,400,{error:'Invalid event cursor.'});return;}
    res.writeHead(200,{'Content-Type':'text/event-stream','Connection':'keep-alive',...noStore});for(const event of job.events)if(event.seq>after)res.write(`data: ${JSON.stringify(event)}\n\n`);if(job.terminal){res.end();return;}job.listeners.add(res);const beat=setInterval(()=>res.write(': keepalive\n\n'),10000);req.on('close',()=>{job.listeners.delete(res);clearInterval(beat);});return;
   }
   json(res,405,{error:'Use a supported request method.'});
  }catch{if(!res.headersSent)json(res,400,{error:'The connector could not accept this request.'});else res.end();}
 });
 server.on('close',()=>{if(closing)return;closing=true;for(const job of jobs.values()){finish(job,'canceled');kill(job);}});
 return {server,pairCode:()=>pairCode,stop:()=>{for(const job of jobs.values()){finish(job,'canceled');kill(job);}server.closeAllConnections();server.close();}};
}
