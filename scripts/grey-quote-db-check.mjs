/** Starts and destroys an isolated local Postgres cluster on the external-drive workspace. No remote DB connection. */
import {execFileSync,execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdtempSync,readFileSync,rmSync,mkdirSync,writeFileSync} from 'node:fs';import {join} from 'node:path';import assert from 'node:assert/strict';
const exec=promisify(execFile),base=process.cwd();mkdirSync(join(base,'runtime-tmp'),{recursive:true});mkdirSync(join(base,'output'),{recursive:true});
const dir=mkdtempSync(join(base,'runtime-tmp','grey-pg-')),port='55439',user=process.env.USER;
if(!base.includes('grey-room-enhancements')||!user)throw Error('Run only from the isolated Grey Room checkout.');
let started=false;
const args=['-X','-q','-h','127.0.0.1','-p',port,'-U',user,'-d','postgres','-v','ON_ERROR_STOP=1','-At'];
const sql=text=>execFileSync('psql',[...args,'-c',text],{encoding:'utf8'}).trim();
try{
 execFileSync('initdb',['-D',dir,'--auth=trust','--no-locale','--encoding=UTF8'],{stdio:'pipe'});
 execFileSync('pg_ctl',['-D',dir,'-l',join(dir,'server.log'),'-o',`-h 127.0.0.1 -p ${port} -k '' -c cluster_name=haggs-grey-quote-test`,'-w','start'],{stdio:'pipe'});started=true;
 assert.equal(sql("select current_setting('cluster_name')"),'haggs-grey-quote-test');
 sql("create role anon; create role authenticated; create table public.app_secrets(key text primary key,value text); insert into public.app_secrets values('webhook','local-test-only');");
 sql(readFileSync(join(base,'supabase/migrations/20261102000000_grey_proposal_quotes.sql'),'utf8'));
 const id='11111111-1111-4111-8111-111111111111',expiry=Date.now()+300000;
 const parameters=`'${id}','${'a'.repeat(64)}','${'b'.repeat(64)}','${'c'.repeat(64)}',${expiry},0.05,'local-test-only'`;
 assert.equal(sql(`set role anon; select public.grey_quote_create(${parameters})`),'t');
 assert.equal(sql(`set role anon; select public.grey_quote_create(${parameters})`),'f');
 assert.equal(JSON.parse(sql(`set role anon; select public.grey_quote_read('${id}','local-test-only')`)).contextHash,'a'.repeat(64));
 assert.throws(()=>sql(`set role anon; select * from public.grey_proposal_quotes`));
 assert.throws(()=>sql(`select public.grey_quote_read('${id}','wrong')`));
 assert.equal(sql(`set role anon; select public.grey_quote_claim(${parameters.replace('b'.repeat(64),'d'.repeat(64))})`),'f');
 const results=await Promise.all(Array.from({length:12},()=>exec('psql',[...args,'-c',`set role anon; select public.grey_quote_claim(${parameters})`])));
 assert.equal(results.filter(r=>r.stdout.trim()==='t').length,1);assert.equal(results.filter(r=>r.stdout.trim()==='f').length,11);
 execFileSync('pg_ctl',['-D',dir,'-l',join(dir,'server.log'),'-w','restart'],{stdio:'pipe'});
 assert.equal(sql(`set role anon; select public.grey_quote_claim(${parameters})`),'f');
 assert.equal(sql(`select public.grey_quote_read('${id}','local-test-only') is null`),'t');
 const expired=parameters.replace(id,'22222222-2222-4222-8222-222222222222').replace(String(expiry),String(Date.now()-1000));assert.equal(sql(`select public.grey_quote_create(${expired})`),'f');
 const report={passed:['migration applied in isolated local Postgres','metadata quote round trip','duplicate creation refused','RLS/table grants deny anon reads','wrong secret and credential binding refused','anonymous RPC role works only with server secret','12 concurrent database claims yield exactly one winner','claim survives Postgres restart','claimed quote cannot be read or replayed','expired creation refused'],remoteConnections:false};
 writeFileSync(join(base,'output','grey-quote-db-results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{try{if(started)execFileSync('pg_ctl',['-D',dir,'-m','fast','-w','stop'],{stdio:'pipe'});}finally{rmSync(dir,{recursive:true,force:true});}}
