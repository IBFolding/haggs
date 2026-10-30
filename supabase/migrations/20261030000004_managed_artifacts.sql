-- Draft only: no production migration. One independently recoverable output per job role.
create table public.managed_artifacts (
 submission_id uuid not null references public.managed_job_journal(submission_id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 role text not null check(role in ('video','atlas','manifest','branch0','branch1','branch2','branches')),
 reservation_id uuid not null unique,
 pathname text not null unique,
 extension text not null check(extension in ('mp4','png','json')),
 bytes bigint not null check(bytes>0 and bytes<=200000000),
 sha256 text not null check(sha256 ~ '^[0-9a-f]{64}$'),
 state text not null check(state in ('reserved','committed')),
 url text,
 primary key(submission_id,role),
 check((state='reserved' and url is null) or (state='committed' and url is not null))
);
alter table public.managed_artifacts enable row level security;
revoke all on public.managed_artifacts from anon,authenticated;
grant select on public.managed_artifacts to authenticated;
create policy "read own managed artifacts" on public.managed_artifacts for select to authenticated using(auth.uid()=user_id);
create or replace function public.managed_artifact_claim(target uuid,submission uuid,p_role text,reservation uuid,extension text,amount bigint,digest text,allowance bigint,existing_files jsonb,secret text)
returns text language plpgsql security definer set search_path=public as $$
declare item managed_artifacts; expected text; permitted boolean;
begin
 if secret is null or secret is distinct from (select value from app_secrets where key='webhook') then raise exception 'not allowed'; end if;
 if target is null or submission is null or reservation is null or p_role is null or extension is null or amount is null or amount<=0 or amount>200000000 or digest is null or digest !~ '^[0-9a-f]{64}$' then raise exception 'invalid artifact'; end if;
 if not ((p_role in ('video','branch0','branch1','branch2') and extension='mp4') or (p_role='atlas' and extension='png') or (p_role in ('manifest','branches') and extension='json')) then raise exception 'invalid role'; end if;
 perform pg_advisory_xact_lock(hashtext('managed-artifact:'||submission::text||':'||p_role));
 if not exists(select 1 from managed_job_journal where submission_id=submission and user_id=target and state='accepted') then raise exception 'job unavailable'; end if;
 select * into item from managed_artifacts where submission_id=submission and role=p_role;
 if found then if item.user_id<>target or item.extension<>extension or item.bytes<>amount or item.sha256<>digest then raise exception 'artifact conflict'; end if; return 'existing'; end if;
 expected:=format('haggs/u-%s/uploads/%s/managed-%s-%s.%s',target,reservation,submission,p_role,extension);
 permitted:=storage_reserve(target,reservation,amount,allowance,existing_files,secret);if permitted is distinct from true then raise exception 'storage unavailable'; end if;
 insert into managed_artifacts values(submission,target,p_role,reservation,expected,extension,amount,digest,'reserved',null);
 return 'created';
end $$;
create or replace function public.managed_artifact_commit(target uuid,submission uuid,p_role text,location text,digest text,secret text)
returns boolean language plpgsql security definer set search_path=public as $$
declare item managed_artifacts;
begin
 if secret is null or secret is distinct from (select value from app_secrets where key='webhook') then raise exception 'not allowed'; end if;
 perform pg_advisory_xact_lock(hashtext('managed-artifact:'||submission::text||':'||p_role));
 select * into item from managed_artifacts where submission_id=submission and user_id=target and role=p_role for update;
 if not found then raise exception 'artifact not found'; end if;
 if location is null or location !~ '^https://[a-zA-Z0-9.-]+[.]public[.]blob[.]vercel-storage[.]com/' or right(location,length(item.pathname)+1)<>'/'||item.pathname or digest is distinct from item.sha256 then raise exception 'verification failed'; end if;
 if item.state='committed' then return item.url=location; end if;
 perform pg_advisory_xact_lock(hashtext('storage:'||target::text));
 if not exists(select 1 from storage_reservations where id=item.reservation_id and user_id=target and state='pending' and bytes=item.bytes for update) then raise exception 'storage confirmation failed'; end if;
 update storage_accounts set used_bytes=used_bytes+item.bytes where user_id=target;if not found then raise exception 'storage account missing';end if;
 update storage_reservations set state='committed',url=location where id=item.reservation_id and user_id=target;
 update managed_artifacts set state='committed',url=location where submission_id=submission and role=p_role and user_id=target;
 return true;
end $$;
revoke all on function public.managed_artifact_claim(uuid,uuid,text,uuid,text,bigint,text,bigint,jsonb,text) from public;
revoke all on function public.managed_artifact_commit(uuid,uuid,text,text,text,text) from public;
grant execute on function public.managed_artifact_claim(uuid,uuid,text,uuid,text,bigint,text,bigint,jsonb,text) to anon,authenticated;
grant execute on function public.managed_artifact_commit(uuid,uuid,text,text,text,text) to anon,authenticated;

-- Generic cleanup cannot settle an unverified artifact.
create or replace function public.storage_finish(target uuid,reservation uuid,location text,secret text,actual_bytes bigint default null)
returns void language plpgsql security definer set search_path=public as $$
declare item storage_reservations;
begin
 if secret is null or secret is distinct from (select value from app_secrets where key='webhook') then raise exception 'not allowed'; end if;
 perform pg_advisory_xact_lock(hashtext('storage:'||target::text));
 -- Managed reservations are settled only by managed_output_commit, which verifies the object.
 if exists(select 1 from managed_output_journal where reservation_id=reservation) or exists(select 1 from managed_artifacts where reservation_id=reservation) then raise exception 'managed reservation requires verified recovery'; end if;
 select * into item from storage_reservations where id=reservation and user_id=target for update;
 if item.state is distinct from 'pending' then return; end if;
 if actual_bytes is not null and (actual_bytes<=0 or actual_bytes>item.bytes) then raise exception 'invalid final size'; end if;
 if location is null then update storage_reservations set state='released' where id=reservation;
 else
  update storage_accounts set used_bytes=used_bytes+coalesce(actual_bytes,item.bytes) where user_id=target;
  update storage_reservations set state='committed',url=location,bytes=coalesce(actual_bytes,item.bytes) where id=reservation;
 end if;
end $$;

