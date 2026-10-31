-- Draft only: reserve storage and journal one deterministic output per managed job.
-- Do not apply until the managed runtime, owner checks and Blob reconciliation are verified.
create table if not exists public.managed_output_journal (
  submission_id uuid primary key references public.managed_job_journal(submission_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reservation_id uuid not null unique,
  pathname text not null unique,
  extension text not null check (extension in ('mp4','webm','png','jpg','webp','mp3','flac','wav')),
  bytes bigint not null check (bytes > 0 and bytes <= 200000000),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  state text not null check (state in ('reserved','committed')),
  url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((state='reserved' and url is null) or (state='committed' and url is not null))
);
alter table public.managed_output_journal enable row level security;
revoke all on public.managed_output_journal from anon, authenticated;
grant select on public.managed_output_journal to authenticated;
create policy "read own managed output" on public.managed_output_journal for select to authenticated using (auth.uid()=user_id);

-- Keep generic stale-hold cleanup from releasing or settling managed outputs.
create or replace function public.storage_finish(target uuid,reservation uuid,location text,secret text,actual_bytes bigint default null)
returns void language plpgsql security definer set search_path=public as $$
declare item storage_reservations;
begin
 if secret is null or secret is distinct from (select value from app_secrets where key='webhook') then raise exception 'not allowed'; end if;
 perform pg_advisory_xact_lock(hashtext('storage:'||target::text));
 -- Managed reservations are settled only by managed_output_commit, which verifies the object.
 if exists(select 1 from managed_output_journal where reservation_id=reservation) then raise exception 'managed reservation requires verified recovery'; end if;
 select * into item from storage_reservations where id=reservation and user_id=target for update;
 if item.state is distinct from 'pending' then return; end if;
 if actual_bytes is not null and (actual_bytes<=0 or actual_bytes>item.bytes) then raise exception 'invalid final size'; end if;
 if location is null then update storage_reservations set state='released' where id=reservation;
 else
  update storage_accounts set used_bytes=used_bytes+coalesce(actual_bytes,item.bytes) where user_id=target;
  update storage_reservations set state='committed',url=location,bytes=coalesce(actual_bytes,item.bytes) where id=reservation;
 end if;
end $$;

-- Claim and quota hold happen in one transaction. A repeated identical request
-- can inspect the same claim; it does not authorize a second upload.
create or replace function public.managed_output_claim(target uuid, submission uuid, reservation uuid, extension text, amount bigint, digest text, allowance bigint, existing_files jsonb, secret text)
returns text language plpgsql security definer set search_path=public as $$
declare item managed_output_journal; expected_path text; allowed boolean;
begin
 if secret is null or secret is distinct from (select value from app_secrets where key='webhook') then raise exception 'not allowed'; end if;
 if target is null or submission is null or reservation is null or extension not in ('mp4','webm','png','jpg','webp','mp3','flac','wav') or amount is null or amount <= 0 or amount > 200000000 or digest is null or digest !~ '^[0-9a-f]{64}$' then raise exception 'invalid output'; end if;
 perform pg_advisory_xact_lock(hashtext('managed-output:'||submission::text));
 if not exists(select 1 from managed_job_journal where submission_id=submission and user_id=target and state='accepted') then raise exception 'job not available'; end if;
 expected_path := format('haggs/u-%s/uploads/%s/managed-%s.%s',target,reservation,submission,extension);
 select * into item from managed_output_journal where submission_id=submission;
 if found then
  if item.user_id<>target or item.reservation_id<>reservation or item.pathname<>expected_path or item.bytes<>amount or item.sha256<>digest then raise exception 'output claim conflict'; end if;
  return 'existing';
 end if;
 allowed := storage_reserve(target,reservation,amount,allowance,existing_files,secret);
 if allowed is distinct from true then raise exception 'storage unavailable'; end if;
 insert into managed_output_journal(submission_id,user_id,reservation_id,pathname,extension,bytes,sha256,state)
 values(submission,target,reservation,expected_path,extension,amount,digest,'reserved');
 return 'created';
end $$;

-- The caller must independently verify object host, path, size and digest. Both
-- the storage hold and the output journal commit together or neither commits.
create or replace function public.managed_output_commit(target uuid, submission uuid, location text, digest text, secret text)
returns boolean language plpgsql security definer set search_path=public as $$
declare item managed_output_journal;
begin
 if secret is null or secret is distinct from (select value from app_secrets where key='webhook') then raise exception 'not allowed'; end if;
 perform pg_advisory_xact_lock(hashtext('managed-output:'||submission::text));
 select * into item from managed_output_journal where submission_id=submission and user_id=target for update;
 if not found then raise exception 'output not found'; end if;
 if location is null or location !~ '^https://[a-zA-Z0-9.-]+[.]public[.]blob[.]vercel-storage[.]com/' or right(location,length(item.pathname)+1)<>'/'||item.pathname or digest is distinct from item.sha256 then raise exception 'output verification failed'; end if;
 if item.state='committed' then return item.url=location; end if;
 perform pg_advisory_xact_lock(hashtext('storage:'||target::text));
 if not exists(select 1 from storage_reservations where id=item.reservation_id and user_id=target and state='pending' and bytes=item.bytes for update) then raise exception 'storage confirmation failed'; end if;
 update storage_accounts set used_bytes=used_bytes+item.bytes where user_id=target;
 if not found then raise exception 'storage account missing'; end if;
 update storage_reservations set state='committed',url=location where id=item.reservation_id and user_id=target;
 update managed_output_journal set state='committed',url=location,updated_at=now() where submission_id=submission and user_id=target;
 return true;
end $$;
revoke all on function public.managed_output_claim(uuid,uuid,uuid,text,bigint,text,bigint,jsonb,text) from public;
revoke all on function public.managed_output_commit(uuid,uuid,text,text,text) from public;
grant execute on function public.managed_output_claim(uuid,uuid,uuid,text,bigint,text,bigint,jsonb,text) to anon,authenticated;
grant execute on function public.managed_output_commit(uuid,uuid,text,text,text) to anon,authenticated;
