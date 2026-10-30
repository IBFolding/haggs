-- Draft only. A server-authenticated owner and server-controlled deployment are required.
create table public.room_sessions (
 id uuid primary key, owner uuid not null references auth.users(id) on delete cascade,
 deployment text not null check(deployment ~ '^https://[a-z0-9-]+[.]run[.]comfy[.]app$'),
 expires_at timestamptz not null, state text not null check(state in ('open','uploading','recorded')),
 recording_path text, recording_bytes bigint, recording_sha256 text,
 check((state='open' and recording_path is null and recording_bytes is null and recording_sha256 is null) or
       (state in ('uploading','recorded') and recording_path is not null and recording_bytes>0 and recording_bytes<=100000000 and recording_sha256 ~ '^[0-9a-f]{64}$'))
);
alter table public.room_sessions enable row level security;
revoke all on public.room_sessions from anon,authenticated;grant select on public.room_sessions to authenticated;
create policy "read own room sessions" on public.room_sessions for select to authenticated using(auth.uid()=owner);
create or replace function public.room_session_create(target uuid,session uuid,p_deployment text,secret text)
returns boolean language plpgsql security definer set search_path=public as $$
begin
 if secret is null or secret is distinct from (select value from app_secrets where key='webhook') then raise exception 'not allowed';end if;
 if target is null or session is null or p_deployment is null or p_deployment !~ '^https://[a-z0-9-]+[.]run[.]comfy[.]app$' then raise exception 'invalid session';end if;
 insert into room_sessions(id,owner,deployment,expires_at,state) values(session,target,p_deployment,now()+interval '24 hours','open') on conflict do nothing;return found;
end $$;
create or replace function public.room_session_claim(target uuid,session uuid,amount bigint,digest text,secret text)
returns boolean language plpgsql security definer set search_path=public as $$
begin
 if secret is null or secret is distinct from (select value from app_secrets where key='webhook') then raise exception 'not allowed';end if;
 if target is null or session is null or amount is null or amount<=0 or amount>100000000 or digest is null or digest !~ '^[0-9a-f]{64}$' then raise exception 'invalid recording';end if;
 update room_sessions set state='uploading',recording_path=format('rooms/u-%s/%s/recording.mp4',target,session),recording_bytes=amount,recording_sha256=digest where id=session and owner=target and state='open' and expires_at>now();return found;
end $$;
-- Caller must independently verify exact storage host, object path, size and digest first.
create or replace function public.room_session_commit(target uuid,session uuid,amount bigint,digest text,secret text)
returns boolean language plpgsql security definer set search_path=public as $$
begin
 if secret is null or secret is distinct from (select value from app_secrets where key='webhook') then raise exception 'not allowed';end if;
 update room_sessions set state='recorded' where id=session and owner=target and state='uploading' and expires_at>now() and recording_path=format('rooms/u-%s/%s/recording.mp4',target,session) and recording_bytes=amount and recording_sha256=digest;return found;
end $$;
revoke all on function public.room_session_create(uuid,uuid,text,text) from public;
revoke all on function public.room_session_claim(uuid,uuid,bigint,text,text) from public;
revoke all on function public.room_session_commit(uuid,uuid,bigint,text,text) from public;
grant execute on function public.room_session_create(uuid,uuid,text,text) to anon,authenticated;
grant execute on function public.room_session_claim(uuid,uuid,bigint,text,text) to anon,authenticated;
grant execute on function public.room_session_commit(uuid,uuid,bigint,text,text) to anon,authenticated;
