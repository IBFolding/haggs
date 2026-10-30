-- Draft only. Uncertain uploads and expired provider assets remain for manual cleanup.
create table public.managed_input_intents (
 submission_id uuid not null,
 user_id uuid not null references auth.users(id) on delete cascade,
 deployment text not null check(deployment ~ '^https://[a-z0-9-]+[.]run[.]comfy[.]app$'),
 field text not null check(field in ('1/file','10001/file','10002/audio')),
 mime text not null,
 bytes bigint not null check(bytes>0 and bytes<=100000000),
 sha256 text not null check(sha256 ~ '^[0-9a-f]{64}$'),
 state text not null check(state in ('uploading','ready')),
 asset_id text,
 expires_at timestamptz not null,
 primary key(submission_id,field),
 check((state='uploading' and asset_id is null) or (state='ready' and asset_id ~ '^[a-zA-Z0-9_-]{1,128}$'))
);
alter table public.managed_input_intents enable row level security;
revoke all on public.managed_input_intents from anon,authenticated;
grant select on public.managed_input_intents to authenticated;
create policy "read own input intents" on public.managed_input_intents for select to authenticated using(auth.uid()=user_id);
create or replace function public.managed_input_begin(target uuid,submission uuid,p_field text,p_deployment text,p_mime text,p_bytes bigint,digest text,secret text)
returns boolean language plpgsql security definer set search_path=public as $$
begin
 if secret is null or secret is distinct from (select value from app_secrets where key='webhook') then raise exception 'not allowed'; end if;
 if target is null or submission is null or p_deployment is null or p_deployment !~ '^https://[a-z0-9-]+[.]run[.]comfy[.]app$' or p_field not in ('1/file','10001/file','10002/audio') or p_bytes is null or p_bytes<=0 or p_bytes>100000000 or digest is null or digest !~ '^[0-9a-f]{64}$' then raise exception 'invalid input'; end if;
 if (p_field in ('1/file','10001/file') and p_mime not in ('video/mp4','video/webm')) or (p_field='10002/audio' and p_mime not in ('audio/mpeg','audio/wav','audio/flac')) or p_mime is null then raise exception 'invalid type'; end if;
 perform pg_advisory_xact_lock(hashtext('managed-owner:'||submission::text));
 if exists(select 1 from managed_input_intents where submission_id=submission and (user_id<>target or deployment<>p_deployment)) or exists(select 1 from managed_job_journal where submission_id=submission and (user_id<>target or deployment<>p_deployment)) then raise exception 'owner mismatch'; end if;
 insert into managed_input_intents values(submission,target,p_deployment,p_field,p_mime,p_bytes,digest,'uploading',null,now()+interval '24 hours') on conflict do nothing;
 return found;
end $$;
create or replace function public.managed_input_accept(target uuid,submission uuid,p_field text,digest text,provider_id text,secret text)
returns boolean language plpgsql security definer set search_path=public as $$
begin
 if secret is null or secret is distinct from (select value from app_secrets where key='webhook') then raise exception 'not allowed'; end if;
 if provider_id is null or provider_id !~ '^[a-zA-Z0-9_-]{1,128}$' then raise exception 'invalid asset'; end if;
 update managed_input_intents set state='ready',asset_id=provider_id where submission_id=submission and user_id=target and field=p_field and sha256=digest and state='uploading' and expires_at>now();
 return found;
end $$;
revoke all on function public.managed_input_begin(uuid,uuid,text,text,text,bigint,text,text) from public;
revoke all on function public.managed_input_accept(uuid,uuid,text,text,text,text) from public;
grant execute on function public.managed_input_begin(uuid,uuid,text,text,text,bigint,text,text) to anon,authenticated;
grant execute on function public.managed_input_accept(uuid,uuid,text,text,text,text) to anon,authenticated;

-- Bind job and upload ownership under the same transaction lock.
create or replace function public.managed_job_begin(target uuid, submission uuid, p_deployment text, p_output_node text, secret text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if secret is null or secret is distinct from (select value from app_secrets where key='webhook') then raise exception 'not allowed'; end if;
  if target is null or submission is null or p_deployment is null or p_output_node is null or p_deployment !~ '^https://[a-z0-9-]+[.]run[.]comfy[.]app$' or p_output_node !~ '^[a-zA-Z0-9_-]{1,128}$' then raise exception 'invalid managed job'; end if;
  perform pg_advisory_xact_lock(hashtext('managed-owner:'||submission::text));
  if exists(select 1 from managed_input_intents where submission_id=submission and (user_id<>target or deployment<>p_deployment)) then raise exception 'owner mismatch'; end if;
  insert into managed_job_journal(submission_id,user_id,deployment,output_node,state)
  values(submission,target,p_deployment,p_output_node,'dispatching') on conflict do nothing;
  return found;
end $$;
