// Loopback-only fixture. Returns prepared synthetic outputs; never runs a model.
import http from 'node:http';import {randomUUID} from 'node:crypto';import {readFile,mkdir} from 'node:fs/promises';import {join} from 'node:path';import {tmpdir} from 'node:os';import {DatabaseSync} from 'node:sqlite';
const dir=join(tmpdir(),'haggs-game-bundle-fixture');await mkdir(dir,{recursive:true,mode:0o700});const db=new DatabaseSync(join(dir,'provider.sqlite'));db.exec('CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY,kind TEXT NOT NULL,polls INTEGER NOT NULL)');
const root='public/workflows/game-director/';const files={
 'guide.mp4':['video/mp4',await readFile(root+'previews/05-animation-moveset-builder-guide.mp4')],
 'atlas.png':['image/png',await readFile(root+'previews/05-animation-moveset-builder-atlas.png')],
 'atlas.json':['application/json',await readFile(root+'playable-examples/05-animation-moveset-builder-atlas.json')],
 'branches.json':['application/json',Buffer.from(JSON.stringify({choices:['Walk','Dodge','Attack']}))],
};for(let i=0;i<3;i++)files[`branch-${i}.mp4`]=['video/mp4',await readFile(root+`previews/prepared-branch-player/branch-${i}.mp4`)];
const server=http.createServer((req,res)=>{
 const json=(obj,status=200)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(obj));};
 if(req.method==='POST'&&req.url==='/api/v2/jobs'){let raw='';req.on('data',b=>{raw+=b;if(raw.length>5000)req.destroy();});req.on('end',()=>{try{const kind=JSON.parse(raw).workflow?.fixture?.inputs?.kind;if(!['atlas','branches'].includes(kind))return json({error:'invalid'},400);const id=`game-${randomUUID()}`;db.prepare('INSERT INTO jobs VALUES(?,?,0)').run(id,kind);json({id,urls:{self:`/api/v2/jobs/${id}`}},201);}catch{json({error:'invalid'},400);}});return;}
 const match=/^\/api\/v2\/jobs\/(game-[a-f0-9-]+)$/.exec(req.url??'');if(req.method==='GET'&&match){const job=db.prepare('SELECT kind,polls FROM jobs WHERE id=?').get(match[1]);if(!job)return json({error:'missing'},404);db.prepare('UPDATE jobs SET polls=polls+1 WHERE id=?').run(match[1]);const names=job.kind==='atlas'?[['911','guide.mp4'],['950','atlas.png'],['950','atlas.json']]:[['9000','branch-0.mp4'],['9000','branch-1.mp4'],['9000','branch-2.mp4'],['9000','branches.json']];return json({id:match[1],status:job.polls<1?'running':'succeeded',outputs:job.polls<1?[]:names.map(([node,name])=>({node_id:node,name,content_type:files[name][0],url:`/api/v2/assets/${name}/content`}))});}
 const asset=/^\/api\/v2\/assets\/([a-z0-9.-]+)\/content$/.exec(req.url??'');if(req.method==='GET'&&asset&&files[asset[1]]){res.writeHead(200,{'content-type':files[asset[1]][0]});return res.end(files[asset[1]][1]);}json({error:'missing'},404);
});server.listen(8199,'127.0.0.1',()=>console.log('Synthetic Game Director provider on loopback 8199.'));
