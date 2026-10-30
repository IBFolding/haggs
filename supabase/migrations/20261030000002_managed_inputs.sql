-- Draft only. No production migration: application-side upload and cleanup are not wired.
create table public.managed_inputs (
 submission_id uuid not null,
 user_id uuid not null references auth.users(id) on delete cascade,
 input_name text not null check (input_name in ('1/file','10001/file','10002/audio')),
 asset_id text not null check (asset_id ~ '^[a-zA-Z0-9_-]{1,128}$'),
 mime text not null check (mime in ('video/mp4','video/webm','audio/mpeg','audio/wav','audio/flac')),
 bytes bigint not null check (bytes > 0 and bytes <= 100000000),
 sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
 expires_at timestamptz not null,
 primary key (submission_id,input_name)
);
alter table public.managed_inputs enable row level security;
revoke all on public.managed_inputs from anon,authenticated;
grant select on public.managed_inputs to authenticated;
create policy "read own managed inputs" on public.managed_inputs for select to authenticated using (auth.uid()=user_id and expires_at>now());
-- A server must authenticate owner, validate file content and upload to that
-- owner's deployment before calling. This table does not itself prove those facts.
create or replace function public.managed_input_record(target uuid, submission uuid, input_name text, asset_id text, mime text, bytes bigint, digest text, secret text)
returns boolean language plpgsql security definer set search_path=public as $$
declare existing managed_inputs;
begin
 if secret is null or secret is distinct from (select value from app_secrets where key='webhook') then raise exception 'not allowed'; end if;
 if target is null or submission is null or input_name not in ('1/file','10001/file','10002/audio') or asset_id is null or asset_id !~ '^[a-zA-Z0-9_-]{1,128}$' or mime is null or bytes is null or bytes<=0 or bytes>100000000 or digest is null or digest !~ '^[0-9a-f]{64}$' then raise exception 'invalid input'; end if;
 if (input_name in ('1/file','10001/file') and mime not in ('video/mp4','video/webm')) or (input_name='10002/audio' and mime not in ('audio/mpeg','audio/wav','audio/flac')) then raise exception 'invalid input type'; end if;
 perform pg_advisory_xact_lock(hashtext('managed-input:'||submission::text));
 if exists(select 1 from managed_inputs where submission_id=submission and user_id<>target) or exists(select 1 from managed_job_journal where submission_id=submission and user_id<>target) then raise exception 'input owner mismatch'; end if;
 select * into existing from managed_inputs m where m.submission_id=submission and m.input_name=managed_input_record.input_name;
 if found then
  if existing.user_id<>target or existing.asset_id<>asset_id or existing.mime<>mime or existing.bytes<>bytes or existing.sha256<>digest or existing.expires_at<=now() then raise exception 'input conflict'; end if;
  return false;
 end if;
 insert into managed_inputs values(submission,target,input_name,asset_id,mime,bytes,digest,now()+interval '24 hours');
 return true;
end $$;
revoke all on function public.managed_input_record(uuid,uuid,text,text,text,bigint,text,text) from public;
grant execute on function public.managed_input_record(uuid,uuid,text,text,text,bigint,text,text) to anon,authenticated;
