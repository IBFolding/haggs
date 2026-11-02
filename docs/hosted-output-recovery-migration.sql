-- DRAFT ONLY: validate in the approved isolated environment before applying anywhere.
-- Does not migrate/delete objects or change any existing media link.
begin;
do $$ begin
 if not exists(select 1 from pg_proc p where p.oid=to_regprocedure('public.storage_finish(uuid,uuid,text,text,bigint)') and md5(p.prosrc)='96343c123bc2449075456f51176e0088') then raise exception 'storage_finish differs from the reviewed baseline; reconcile existing recovery protections before applying'; end if;
end $$;
create table public.hosted_output_recovery (
 id uuid primary key, user_id uuid not null references auth.users(id), scope text not null check(scope in ('platform','own')),
 credential_hash text not null check(credential_hash ~ '^[0-9a-f]{64}$'), output_node text not null check(output_node ~ '^[a-zA-Z0-9_-]{1,128}$'),
 state text not null check(state in ('dispatching','accepted','ready','saving','saved','missing','canceled')),
 provider_job text, filename text, subfolder text, extension text,
 bytes bigint check(bytes>0 and bytes<=104857600),digest text check(digest ~ '^[0-9a-f]{64}$'),reservation_id uuid references public.storage_reservations(id),url text,
 created_at timestamptz not null default now()
);
create index hosted_output_owner on public.hosted_output_recovery(user_id,created_at desc);
create unique index hosted_output_job_once on public.hosted_output_recovery(user_id,credential_hash,provider_job) where provider_job is not null;
alter table public.hosted_output_recovery enable row level security;
revoke all on public.hosted_output_recovery from anon,authenticated;
grant select on public.hosted_output_recovery to authenticated;
create policy "read own hosted outputs" on public.hosted_output_recovery for select to authenticated using(auth.uid()=user_id);
create function public.hosted_output_act(p_id uuid,p_action text,p_value jsonb,p_secret text) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); h hosted_output_recovery; location text;
begin
 if u is null or p_secret is null or p_secret is distinct from (select value from app_secrets where key='webhook') then raise exception 'not allowed'; end if;
 perform pg_advisory_xact_lock(hashtext('storage:'||u::text));
 if p_action='probe' then return 'true'::jsonb; end if;
 if p_action='begin' then
  if p_value->>'scope' not in ('platform','own') or p_value->>'credential_hash' !~ '^[0-9a-f]{64}$' or p_value->>'output_node' !~ '^[a-zA-Z0-9_-]{1,128}$' then raise exception 'invalid recovery intent'; end if;
  insert into hosted_output_recovery(id,user_id,scope,credential_hash,output_node,state) values(p_id,u,p_value->>'scope',p_value->>'credential_hash',p_value->>'output_node','dispatching');
  return 'true'::jsonb;
 end if;
 select * into h from hosted_output_recovery where id=p_id and user_id=u for update;
 if not found then raise exception 'not found'; end if;
 if p_action='accepted' then
  if h.state<>'dispatching' or p_value->>'job' is null or p_value->>'job' !~ '^[-a-zA-Z0-9_]{1,128}$' then raise exception 'invalid accepted job'; end if;
  update hosted_output_recovery set provider_job=p_value->>'job',state='accepted' where id=p_id;return 'true'::jsonb;
 elsif p_action='ready' then
  if h.state not in ('accepted','missing') or p_value->>'filename' is null or p_value->>'filename' !~ '^[-a-zA-Z0-9_.]{1,200}$' or p_value->>'subfolder' is null or p_value->>'subfolder' !~ '^[-a-zA-Z0-9_/]{0,100}$' or position('..' in p_value->>'subfolder')>0 or p_value->>'extension' is null or p_value->>'extension' not in ('png','jpg','webp','mp4','webm','mp3','wav','flac') then raise exception 'invalid recovery output'; end if;
  update hosted_output_recovery set filename=p_value->>'filename',subfolder=p_value->>'subfolder',extension=p_value->>'extension',state='ready' where id=p_id;return 'true'::jsonb;
 elsif p_action='claim' then
  if h.state<>'ready' then return 'false'::jsonb; end if;
  if p_value->>'bytes' is null or p_value->>'digest' is null or p_value->>'reservation' is null or (p_value->>'bytes')::bigint not between 1 and 104857600 or p_value->>'digest' !~ '^[0-9a-f]{64}$' then raise exception 'invalid output digest'; end if;
  if not exists(select 1 from storage_reservations r where r.id=(p_value->>'reservation')::uuid and r.user_id=u and r.state='pending' and r.bytes>=(p_value->>'bytes')::bigint) then return 'false'::jsonb; end if;
  update hosted_output_recovery set state='saving',bytes=(p_value->>'bytes')::bigint,digest=p_value->>'digest',reservation_id=(p_value->>'reservation')::uuid where id=p_id;return 'true'::jsonb;
 elsif p_action='saved' then
  location:='/api/media/haggs/u-'||u::text||'/recovered/'||p_id::text||'.'||h.extension;
  if h.state='saved' then return 'true'::jsonb; end if;
  if h.state<>'saving' or not exists(select 1 from storage_reservations r where r.id=h.reservation_id and r.user_id=u and r.state='committed' and r.url=location and r.bytes=h.bytes) then raise exception 'output accounting unconfirmed'; end if;
  update hosted_output_recovery set state='saved',url=location where id=p_id;return 'true'::jsonb;
 elsif p_action='missing' then
  if h.state not in ('accepted','ready','missing') then raise exception 'invalid missing state'; end if;
  update hosted_output_recovery set state='missing' where id=p_id;return 'true'::jsonb;
 elsif p_action='cancel' then
  update hosted_output_recovery set state='canceled' where id=p_id;
  if h.reservation_id is not null then perform storage_finish(u,h.reservation_id,null,p_secret,null); end if;
  return 'true'::jsonb;
 end if;
 raise exception 'invalid recovery action';
end $$;
revoke all on function public.hosted_output_act(uuid,text,jsonb,text) from public;
grant execute on function public.hosted_output_act(uuid,text,jsonb,text) to authenticated;
create or replace function public.storage_finish(target uuid,reservation uuid,location text,secret text,actual_bytes bigint default null)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare item storage_reservations;
begin
 if secret is null or secret is distinct from (select value from app_secrets where key='webhook') then raise exception 'not allowed'; end if;
 perform pg_advisory_xact_lock(hashtext('storage:'||target::text));
 select * into item from storage_reservations where id=reservation and user_id=target for update;
 if item.state is distinct from 'pending' then return; end if;
 if actual_bytes is not null and (actual_bytes<=0 or actual_bytes>item.bytes) then raise exception 'invalid final size'; end if;
 if location is null and exists(select 1 from public.hosted_output_recovery h where h.user_id=target and h.reservation_id=reservation and h.state='saving') then return; end if;
 if location is null then update storage_reservations set state='released' where id=reservation;
 else
  update storage_accounts set used_bytes=used_bytes+coalesce(actual_bytes,item.bytes) where user_id=target;
  update storage_reservations set state='committed',url=location,bytes=coalesce(actual_bytes,item.bytes) where id=reservation;
 end if;
end $$;

commit;
