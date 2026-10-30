// Explicit local fixture, no external services or AI generation.
import http from 'node:http';
import {readFile} from 'node:fs/promises';
const jobs=new Map();let asset=0;
const sample=await readFile('public/workflows/contest-lab/previews/03-portal-paint-synthetic.mp4');
const server=http.createServer((req,res)=>{
 const json=(obj,status=200)=>{res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(obj));};
 if(req.method==='POST'&&req.url==='/api/v2/assets'){req.resume();req.on('end',()=>json({id:`fixture${++asset}`}));return;}
 if(req.method==='POST'&&req.url==='/api/v2/jobs'){let text='';req.on('data',b=>{text+=b;if(text.length>1_000_000)req.destroy();});req.on('end',()=>{try{JSON.parse(text);const id=`fixturejob${jobs.size+1}`;jobs.set(id,0);json({id,urls:{self:`/api/v2/jobs/${id}`}},201);}catch{json({error:'invalid'},400);}});return;}
 const match=/^\/api\/v2\/jobs\/(fixturejob\d+)$/.exec(req.url??'');
 if(req.method==='GET'&&match){const count=jobs.get(match[1]);if(count===undefined){json({error:'missing'},404);return;}jobs.set(match[1],count+1);json({id:match[1],status:count<2?'running':'succeeded',outputs:count<2?[]:[{node_id:'10004',content_type:'video/mp4',url:'/api/v2/assets/output/content'}]});return;}
 if(req.method==='GET'&&req.url==='/api/v2/assets/output/content'){res.writeHead(200,{'content-type':'video/mp4'});res.end(sample);return;}
 json({error:'not found'},404);
});
server.listen(8198,'127.0.0.1',()=>console.log('Fake Portal provider on loopback 8198; sample video only.'));
