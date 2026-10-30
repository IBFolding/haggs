// Explicit local fixture, no external services or AI generation.
import http from 'node:http';
import {randomUUID} from 'node:crypto';
import {readFile,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
const dir=join(tmpdir(),'haggs-portal-fixture-v1');await mkdir(dir,{recursive:true,mode:0o700});
const db=new DatabaseSync(join(dir,'provider.sqlite'));db.exec('CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, polls INTEGER NOT NULL)');
const sample=await readFile('public/workflows/contest-lab/previews/03-portal-paint-synthetic.mp4');
const server=http.createServer((req,res)=>{
 const json=(obj,status=200)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(obj));};
 if(req.method==='POST'&&req.url==='/api/v2/assets'){req.resume();req.on('end',()=>json({id:`fixture-${randomUUID()}`}));return;}
 if(req.method==='POST'&&req.url==='/api/v2/jobs'){let text='';req.on('data',b=>{text+=b;if(text.length>1_000_000)req.destroy();});req.on('end',()=>{try{JSON.parse(text);const id=`fixturejob-${randomUUID()}`;db.prepare('INSERT INTO jobs VALUES(?,0)').run(id);json({id,urls:{self:`/api/v2/jobs/${id}`}},201);}catch{json({error:'invalid'},400);}});return;}
 const match=/^\/api\/v2\/jobs\/(fixturejob-[a-f0-9-]+)$/.exec(req.url??'');
 if(req.method==='GET'&&match){const row=db.prepare('SELECT polls FROM jobs WHERE id=?').get(match[1]);if(!row){json({error:'missing'},404);return;}const polls=Number(row.polls);db.prepare('UPDATE jobs SET polls=polls+1 WHERE id=?').run(match[1]);json({id:match[1],status:polls<2?'running':'succeeded',outputs:polls<2?[]:[{node_id:'10004',content_type:'video/mp4',url:'/api/v2/assets/output/content'}]});return;}
 if(req.method==='GET'&&req.url==='/api/v2/assets/output/content'){res.writeHead(200,{'content-type':'video/mp4'});res.end(sample);return;}
 json({error:'not found'},404);
});
server.listen(8198,'127.0.0.1',()=>console.log('Fake Portal provider on loopback 8198; synthetic sample video only.'));
