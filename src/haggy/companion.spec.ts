import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {request as httpRequest} from 'node:http';
import {createRequire} from 'node:module';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {createCompanion,type CompanionOptions} from './companion';
import {allowedOrigin,companionOrigin,type ChatEvent} from './protocol';
import {cliArgs,outputText,runnerEnv} from './cli';
import {createProject,newShot} from '../story/model';
import {createProjectStore} from '../story/store';
import {memoryKv} from '../story/kv';
import {runTool,type ToolContext} from '../story/agent-tools';
const origin='http://localhost:3112',code='AABBCCDDEEFF';
const ready=()=>({installed:true,compatible:true,signedIn:true,note:'Fixture login; no model API.'});
async function setup(override?:CompanionOptions['launch']){
 let starts=0;
 const loader=pathToFileURL(createRequire(import.meta.url).resolve('tsx')).href;
 const app=createCompanion({pairCode:code,status:ready,launch:async(turn,bridge)=>{starts++;if(override)return override(turn,bridge);const child=spawn(process.execPath,['--import',loader,fileURLToPath(new URL('./fixtures/provider.ts',import.meta.url)),turn.provider],{env:{...runnerEnv(),HAGGY_BRIDGE_URL:bridge.url,HAGGY_JOB_TOKEN:bridge.token},detached:true,stdio:['pipe','pipe','pipe']});return {child,cleanup:async()=>{}};}});
 await new Promise<void>(resolve=>app.server.listen(0,'127.0.0.1',resolve));const address=app.server.address() as {port:number};const base=`http://127.0.0.1:${address.port}`;
 const post=(path:string,data:unknown,token='',from=origin)=>fetch(base+path,{method:'POST',headers:{Origin:from,'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify(data)});
 const pair=await post('/pair',{code});assert.equal(pair.status,200);const token=(await pair.json()).token as string;
 return {app,base,post,token,starts:()=>starts};
}

test('origin, URL and environment boundaries fail closed',()=>{
 assert.equal(allowedOrigin('https://evil.example'),false);assert.equal(allowedOrigin('http://localhost:3112'),true);
 assert.equal(companionOrigin('http://127.0.0.1:3211'),'http://127.0.0.1:3211');
 for(const url of ['https://evil.example','http://127.0.0.1:3211/secret','http://user:pass@localhost:3211'])assert.throws(()=>companionOrigin(url));
 const env=runnerEnv({PATH:'/bin',HOME:'/fixture',NODE_ENV:'test',OPENAI_API_KEY:'fixture-secret',ANTHROPIC_API_KEY:'fixture-secret'});assert.equal(env.OPENAI_API_KEY,undefined);assert.equal(env.ANTHROPIC_API_KEY,undefined);
 const args=cliArgs('codex',{cwd:'/fixture',mcpConfig:'/mcp',node:'/node',loader:'/loader',toolScript:'/tools'}).join(' ');assert.ok(args.includes('forced_login_method="chatgpt"'));assert.ok(args.includes(':root'));assert.ok(!args.includes('dangerously'));
 const claude=cliArgs('claude',{cwd:'/fixture',mcpConfig:'/mcp',node:'/node',loader:'/loader',toolScript:'/tools'});assert.ok(claude.includes('--strict-mcp-config'));assert.equal(claude[claude.indexOf('--tools')+1],'');assert.ok(!claude.includes('--bare'));
});
test('provider parsing uses actual deltas or completed messages and recognizes failures',()=>{
 assert.deepEqual(outputText('claude',{type:'stream_event',event:{type:'content_block_delta',delta:{type:'text_delta',text:'Hello'}}}),{delta:'Hello'});
 assert.deepEqual(outputText('codex',{type:'item.completed',item:{type:'agent_message',text:'Hello'}}),{delta:'Hello'});
 assert.equal(outputText('claude',{type:'result',subtype:'error_max_turns',is_error:true}).failure,true);assert.equal(outputText('codex',{type:'turn.failed'}).failure,true);
});
test('pairing is one-use, session is origin-bound, hostile origins and rebinding are rejected',async()=>{
 const s=await setup();try{
  assert.equal((await s.post('/pair',{code})).status,403);
  assert.equal((await fetch(s.base+'/health',{headers:{Origin:'https://evil.example'}})).status,403);
  const rebound=await new Promise<number>(resolve=>{const req=httpRequest(s.base+'/health',{headers:{Origin:origin,Host:'evil.example'}},res=>{res.resume();resolve(res.statusCode!);});req.end();});assert.equal(rebound,403);
  assert.equal((await fetch(s.base+'/status',{headers:{Origin:'http://localhost:9999',Authorization:`Bearer ${s.token}`}})).status,401);
  assert.equal((await s.post('/turn',{id:'bad',provider:'claude',messages:[],context:{}},s.token)).status,400);
 }finally{s.app.stop();}
});
for(const provider of ['claude','codex'] as const)test(`${provider}: real MCP transport edits only the selected project, replays events without another runner and preserves Undo`,async()=>{
 const s=await setup(),store=createProjectStore(memoryKv()),p={...createProject('MCP fixture'),shots:[{...newShot(),beat:'She reaches the door.',seconds:3}]};await store.save(p);let before:typeof p|undefined,edits=0;
 const ctx:ToolContext={list:()=>store.list(),load:async id=>await store.load(id)??null,save:async project=>{edits++;await store.save(project);},sheets:async()=>null,workflows:async()=>[],open:()=>{}};
 try{
  const turn={id:crypto.randomUUID(),provider,messages:[{role:'user',text:'Shorten the opening.'}],context:{page:'/editor',project:p.id}};
  const created=await s.post('/turn',turn,s.token);assert.equal(created.status,202);assert.equal((await s.post('/turn',turn,s.token)).status,200);
  const stream=await fetch(s.base+`/turn/${turn.id}`,{headers:{Origin:origin,Authorization:`Bearer ${s.token}`}});const reader=stream.body!.getReader(),decoder=new TextDecoder();let buffer='',events:ChatEvent[]=[];
  for(;;){const part=await reader.read();if(part.done)break;buffer+=decoder.decode(part.value,{stream:true});for(;;){const end=buffer.indexOf('\n\n');if(end<0)break;const frame=buffer.slice(0,end);buffer=buffer.slice(end+2);if(!frame.startsWith('data: '))continue;const event=JSON.parse(frame.slice(6)) as ChatEvent;events.push(event);if(event.type==='tool'){
   const pending=await fetch(s.base+`/turn/${turn.id}/pending/${event.requestId}`,{headers:{Origin:origin,Authorization:`Bearer ${s.token}`}});assert.equal((await pending.json()).pending,true);
   const result=await runTool(event.name!,event.input!,ctx);if(result.change)before=result.change.before as typeof p;
   const body={id:event.requestId,result:result.result??null,...(result.error?{error:true}:{})};assert.equal((await s.post(`/turn/${turn.id}/result`,body,s.token)).status,200);assert.equal((await s.post(`/turn/${turn.id}/result`,body,s.token)).status,200);
  }}}
  assert.equal(events.at(-1)?.type,'done');assert.equal(edits,1);assert.equal(s.starts(),1);for(const event of events.filter(e=>e.type==='tool')){const response=await fetch(s.base+`/turn/${turn.id}/pending/${event.requestId}`,{headers:{Origin:origin,Authorization:`Bearer ${s.token}`}});assert.equal((await response.json()).pending,false);}assert.ok(!JSON.stringify(events).includes('fixture-private-diagnostic'));
  assert.equal((await store.load(p.id))!.boards![0]!.shots[0]!.seconds,2);assert.ok(before);await store.save(before!);assert.equal((await store.load(p.id))!.boards![0]!.shots[0]!.seconds,3);
  const replay=await fetch(s.base+`/turn/${turn.id}?after=${events.at(-2)!.seq}`,{headers:{Origin:origin,Authorization:`Bearer ${s.token}`}});assert.ok((await replay.text()).includes('done'));assert.equal(s.starts(),1);
  assert.equal((await s.post('/turn',{...turn,messages:[{role:'user',text:'Different'}]},s.token)).status,409);
 }finally{s.app.stop();}
});

for(const mode of ['stop','disconnect','incomplete'] as const)test(`${mode}: runner cannot report success after cancellation or an incomplete reply`,async()=>{
 let child:ReturnType<typeof spawn>|undefined;
 const s=await setup(async()=>{child=spawn(process.execPath,['-e',mode==='incomplete'?`console.log(JSON.stringify({type:'item.completed',item:{type:'agent_message',text:'Partial reply'}}))`:`setInterval(()=>{},1000)`],{detached:true,stdio:['pipe','pipe','pipe']});return {child,cleanup:async()=>{}};});
 try{
  const id=crypto.randomUUID();assert.equal((await s.post('/turn',{id,provider:'codex',messages:[{role:'user',text:'Review'}],context:{page:'/board',project:crypto.randomUUID()}},s.token)).status,202);
  const headers={Origin:origin,Authorization:`Bearer ${s.token}`};
  const response=await fetch(s.base+`/turn/${id}`,{headers});
  if(mode==='stop')assert.equal((await fetch(s.base+`/turn/${id}`,{method:'DELETE',headers})).status,200);
  if(mode==='disconnect'){assert.equal((await s.post('/disconnect',{},s.token)).status,200);assert.equal((await fetch(s.base+'/status',{headers})).status,401);}
  const events=(await response.text()).split('\n\n').filter(line=>line.startsWith('data: ')).map(line=>JSON.parse(line.slice(6)) as ChatEvent);
  assert.equal(events.at(-1)?.type,mode==='incomplete'?'error':'canceled');assert.equal(events.some(e=>e.type==='done'),false);assert.equal(s.starts(),1);
  if(mode!=='incomplete'&&child&&child.exitCode===null&&child.signalCode===null)await new Promise<void>(resolve=>{child!.once('close',()=>resolve());});
 }finally{s.app.stop();}
});
