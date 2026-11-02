import subprocess,tempfile,pathlib,pwd,os,shutil,json,socket
base=pathlib.Path.cwd()
root=pathlib.Path(tempfile.mkdtemp(prefix='grey-packet-',dir=base/'runtime-tmp'))
data=root/'data'; sock=root/'socket';sock.mkdir()
user=pwd.getpwuid(os.getuid()).pw_name
with socket.socket() as listener:
 listener.bind(('127.0.0.1',0));port=str(listener.getsockname()[1])
started=False
def run(args,**kw):
 return subprocess.run(args,check=True,capture_output=True,text=True,**kw)
def sql(text):
 return run(['psql','-X','-q','-h','127.0.0.1','-p',port,'-U',user,'-d','postgres','-v','ON_ERROR_STOP=1','-At','-c',text]).stdout.strip()
try:
 run(['initdb','-D',str(data),'--auth=trust','--no-locale','--encoding=UTF8'])
 run(['pg_ctl','-D',str(data),'-l',str(root/'server.log'),'-o',"-h 127.0.0.1 -p "+port+" -k ''",'-w','start']);started=True
 sql("create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to authenticated; create table public.app_secrets(key text primary key,value text); insert into public.app_secrets values('webhook','synthetic-local-only');")
 sql('alter default privileges in schema public grant execute on functions to anon,authenticated;')
 sql((base/'supabase/migrations/20261103000000_grey_user_spending_caps.sql').read_text())
 a='11111111-1111-4111-8111-111111111111';b='22222222-2222-4222-8222-222222222222'
 sql(f"insert into auth.users values('{a}'),('{b}')")
 def owned(uid,query):return sql(f"set request.jwt.claim.sub='{uid}';set role authenticated;{query}")
 assert owned(a,"select public.grey_spend_set_cap(1)")=='t'
 import concurrent.futures,uuid
 ids=[str(uuid.uuid4()) for _ in range(12)]
 def reserve(ref):return sql(f"select public.grey_spend_reserve('{ref}','{a}',0.4,'synthetic-local-only')")
 with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool: results=list(pool.map(reserve,ids))
 assert results.count('t')==2,results
 winners=[ref for ref,result in zip(ids,results) if result=='t']
 assert float(json.loads(owned(a,'select public.grey_spend_status()'))['reservedUsd'])==.8
 assert owned(a,'select public.grey_spend_set_cap(0.5)')=='f'
 assert sql(f"select public.grey_spend_finish('{winners[0]}',null,'synthetic-local-only')")=='t'
 assert float(json.loads(owned(a,'select public.grey_spend_status()'))['reservedUsd'])==.8
 assert sql(f"select public.grey_spend_finish('{winners[0]}','NaN'::numeric,'synthetic-local-only')")=='f'
 assert sql(f"select public.grey_spend_finish('{winners[0]}',0.1,'synthetic-local-only')")=='t'
 assert sql(f"select public.grey_spend_finish('{winners[0]}',0,'synthetic-local-only')")=='f'
 assert owned(a,'select public.grey_spend_set_cap(0.5)')=='t'
 assert json.loads(owned(b,'select public.grey_spend_status()'))['capUsd']==0
 for query in ["set role anon;select public.grey_spend_set_cap(1)","set role authenticated;select * from public.grey_spend_accounts",f"select public.grey_spend_reserve('{uuid.uuid4()}','{a}',0.1,'wrong')"]:
  try:sql(query);raise AssertionError('Access unexpectedly allowed')
  except subprocess.CalledProcessError:pass
 # Owner-authorized $100 cap: concurrent full-context planning reservations.
 assert owned(b,'select public.grey_spend_set_cap(100)')=='t'
 refs=[str(uuid.uuid4()) for _ in range(50)]
 def plan(ref):return sql(f"select public.grey_spend_reserve('{ref}','{b}',2.03,'synthetic-local-only')")
 with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool: plans=list(pool.map(plan,refs))
 assert plans.count('t')==49,plans
 assert float(json.loads(owned(b,'select public.grey_spend_status()'))['reservedUsd'])==99.47
 assert owned(b,'select public.grey_spend_set_cap(99)')=='f'
 report={'passed':['12 concurrent reservations respect per-user cap','unknown charge retains reservation','cannot lower cap below charged+reserved','settlement releases only known unused amount','duplicate settlement refused','other customer remains isolated','anonymous set-cap denied','direct table access denied','wrong server secret denied','$100 cap permits 49 full-context reservations and rejects the 50th'],'providerCalls':0,'remoteConnections':False}
 (base/'output/grey-cap-db-results.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))
finally:
 if started:run(['pg_ctl','-D',str(data),'-m','fast','-w','stop'])
 shutil.rmtree(root)
