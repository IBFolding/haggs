import test from 'node:test';
import assert from 'node:assert/strict';
import {allowedGpuRequest,checkRented,publicIPv4,rentedBase,rentedFetch,sealConnection,unsealConnection} from './rented-gpu';
import {createLocalRunner} from '../providers/local';
import {workflowRuntime} from '../comfy/runtime';
import type {Catalog} from '../comfy/convert';
const base='https://fixture-gpu.example.com', token='fixture-not-a-real-gateway-secret';
test('rented endpoints require a clean HTTPS DNS origin',()=>{
  assert.equal(rentedBase(base+'/'),base);
  for(const input of ['http://example.com','https://127.0.0.1','https://[::1]','https://foo.local','https://foo.internal','https://user:password@example.com','https://example.com/path','https://example.com?token=abc','https://example.com#token','https://example.com:8188','file:///tmp/foo'])assert.throws(()=>rentedBase(input));
});
test('DNS pinning guard excludes metadata, private, loopback and reserved IPv4 ranges',()=>{
  for(const ip of ['127.0.0.1','10.1.2.3','172.16.0.1','172.31.0.1','192.168.1.1','169.254.169.254','100.64.0.1','0.0.0.0','224.0.0.1','255.255.255.255','198.18.0.1','::1','::ffff:127.0.0.1'])assert.equal(publicIPv4(ip),false,ip);
  assert.equal(publicIPv4('8.8.8.8'),true);
  assert.equal(publicIPv4('172.32.0.1'),true);
});
test('transport never accepts foreign origins, admin routes, URL credentials or query tokens',()=>{
  for(const [method,path] of [['GET','/system_stats'],['GET','/object_info'],['GET','/history/job-id'],['GET','/view?filename=clip.mp4'],['POST','/prompt'],['POST','/upload/image']])assert.equal(allowedGpuRequest(new URL(path!,base),base,method!),true);
  for(const url of ['https://other.example/prompt',base+'/manager/install',base+'/queue',base+'/system_stats?token=x','https://x:y@fixture-gpu.example.com/prompt'])assert.equal(allowedGpuRequest(new URL(url),base,'POST'),false);
});
test('sealed connections are opaque, bound to account, tamper checked and expire',()=>{
  const connection={base,token,owner:'owner-a',expires:Date.now()+10000};
  const sealed=sealConnection(connection);
  assert.ok(!sealed.includes(token));
  assert.deepEqual(unsealConnection(sealed,'owner-a'),connection);
  assert.equal(unsealConnection(sealed,'owner-b'),undefined);
  assert.equal(unsealConnection('x'+sealed.slice(1),'owner-a'),undefined);
  assert.equal(unsealConnection(sealConnection({...connection,expires:0}),'owner-a'),undefined);
});
test('connection check requires authentication and a real catalog; never submits a prompt',async()=>{
  const calls:string[]=[];
  const fixture=((_connection:unknown,auth=true)=> (async(input:string)=>{
    const path=new URL(input).pathname;calls.push(`${auth}:${path}`);
    if(!auth)return new Response(null,{status:401});
    return Response.json(path==='/system_stats'?{devices:[{name:'Fixture GPU'}]}:{Example:{input:{required:{}}}});
  }) as typeof fetch);
  assert.deepEqual(await checkRented({base,token},fixture),{base,gpu:'Fixture GPU',nodes:1});
  assert.deepEqual(calls,['false:/system_stats','true:/system_stats','true:/object_info']);
  await assert.rejects(checkRented({base,token},()=>async()=>Response.json({devices:[]})),/Protect the GPU/);
  await assert.rejects(checkRented({base,token},(_c,auth=true)=>async()=>new Response(null,{status:auth?401:403})),/did not accept/);
  await assert.rejects(checkRented({base,token},(_c,auth=true)=>async()=>auth?Response.json({devices:[]}):new Response(null,{status:401})),/GPU status/);
});
test('rented transport rejects an unsafe request before any DNS or network traffic',async()=>{
  await assert.rejects(rentedFetch({base,token})('https://127.0.0.1/system_stats'),/outside the GPU/);
});
test('workflow runtime keeps public destinations blocked unless the server supplies its verified resolver',()=>{
  const prompt={'1':{class_type:'Example',inputs:{}}}, catalog={} as Catalog;
  assert.throws(()=>workflowRuntime(prompt,catalog,base,false,'local'),/Only ComfyUI/);
  assert.deepEqual(workflowRuntime(prompt,catalog,base,false,'local',rentedBase),{kind:'local',base});
  assert.throws(()=>workflowRuntime(prompt,{Example:{api_node:true}} as unknown as Catalog,base,true,'local',rentedBase),/No cloud fallback/);
});
test('same GPU runner uploads, queues once, polls, downloads and keeps a fixture result',async()=>{
  const calls:string[]=[];
  const runner=createLocalRunner({base,pollMs:0,keep:async(bytes,ext)=>{assert.equal(bytes.length,3);assert.equal(ext,'mp4');return '/fixture/video.mp4';},fetch:(async(input,init)=>{
    const url=new URL(String(input));calls.push(`${init?.method??'GET'} ${url.pathname}`);
    if(url.pathname==='/upload/image')return Response.json({name:'reference.png'});
    if(url.pathname==='/prompt')return Response.json({prompt_id:'fixture-id'});
    if(url.pathname==='/history/fixture-id')return Response.json({'fixture-id':{status:{completed:true},outputs:{'20':{videos:[{filename:'take.mp4',type:'output'}]}}}});
    return new Response(new Uint8Array([1,2,3]));
  }) as typeof fetch});
  await runner.uploadBytes(new Uint8Array([1]),'image/png');
  assert.equal((await runner.run({'20':{class_type:'Fixture',inputs:{}}})).url,'/fixture/video.mp4');
  assert.deepEqual(calls,['POST /upload/image','POST /prompt','GET /history/fixture-id','GET /view']);
});

test('HTTPS transport pins approved DNS, strips caller headers, rejects redirects and never retries',async()=>{
  const {EventEmitter}=await import('node:events');
  const {PassThrough}=await import('node:stream');
  type Network=NonNullable<Parameters<typeof rentedFetch>[2]>;
  let requests=0, status=200;
  const network:Network={
    lookup:(async()=>[{address:'8.8.8.8',family:4}]) as unknown as Network['lookup'],
    request:((url:URL,options:Record<string,unknown>,callback:(response:unknown)=>void)=>{
      requests++;assert.equal(url.origin,base);assert.equal(options.agent,false);
      const headers=options.headers as Record<string,string>;
      assert.equal(headers.Authorization,`Bearer ${token}`);
      assert.equal(headers.Cookie,undefined);assert.equal(headers['X-API-Key'],undefined);
      const lookup=options.lookup as (host:string,options:object,done:(err:null,address:string,family:number)=>void)=>void;
      lookup(url.hostname,{},(_err,address,family)=>{assert.equal(address,'8.8.8.8');assert.equal(family,4);});
      const outgoing=new EventEmitter() as InstanceType<typeof EventEmitter>&{end:()=>void;destroy:()=>void};
      outgoing.destroy=()=>{outgoing.emit('error',new Error('socket details must be redacted'));outgoing.emit('close');};
      outgoing.end=()=>{const response=Object.assign(new PassThrough(),{statusCode:status,headers:{'content-type':'application/json'}});callback(response);response.end('{}');outgoing.emit('close');};
      return outgoing;
    }) as unknown as Network['request'],
  };
  const fetcher=rentedFetch({base,token},true,network);
  assert.equal((await fetcher(`${base}/system_stats`,{headers:{Cookie:'private','X-API-Key':'not-forwarded'}})).status,200);
  status=302;await assert.rejects(fetcher(`${base}/system_stats`),/Could not reach/);assert.equal(requests,2);
  const mixed={...network,lookup:(async()=>[{address:'8.8.8.8',family:4},{address:'127.0.0.1',family:4}]) as unknown as Network['lookup']};
  await assert.rejects(rentedFetch({base,token},true,mixed)(`${base}/system_stats`),/public IPv4/);assert.equal(requests,2);
});

test('connection origins normalize before encryption so saved trailing slashes still route correctly',()=>{
  const sealed=sealConnection({base:base+'/',token,owner:'test-owner',expires:Date.now()+10000});
  assert.equal(unsealConnection(sealed,'test-owner')?.base,base);
});
test('remote-output mode keeps a private GPU reference without requiring hosted storage',async()=>{
  let kept=0,downloaded=0;
  const runner=createLocalRunner({base,pollMs:0,keep:async()=>{kept++;return '/unexpected';},keepRemote:async file=>{assert.equal(file.filename,'take.mp4');return '/api/gpu/output?fixture';},fetch:(async(input)=>{
    const path=new URL(String(input)).pathname;
    if(path==='/prompt')return Response.json({prompt_id:'remote-job'});
    if(path==='/history/remote-job')return Response.json({'remote-job':{status:{completed:true},outputs:{'20':{videos:[{filename:'take.mp4',type:'output'}]}}}});
    downloaded++;throw Error('Result should stay on GPU');
  })as typeof fetch});
  const result=await runner.run({'20':{class_type:'Fixture',inputs:{}}});
  assert.equal(result.url,'/api/gpu/output?fixture');assert.equal(result.kind,'video');assert.equal(kept,0);assert.equal(downloaded,0);
});
