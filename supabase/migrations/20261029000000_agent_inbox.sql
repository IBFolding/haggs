-- The agent inbox: Claude, over MCP on the person's own computer, reads their synced projects and sends proposals to
-- the live site, where the person applies or dismisses them. Claude signs in with an agent token the person made on
-- the Account page. Only the token's hash is kept, and a token can read projects and send proposals, nothing else.

create table if not exists public.agent_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null default 'Claude' check (char_length(name) between 1 and 60),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
alter table public.agent_tokens enable row level security;
drop policy if exists "people see their own agent tokens" on public.agent_tokens;
create policy "people see their own agent tokens" on public.agent_tokens for select using (auth.uid() = user_id);
drop policy if exists "people make their own agent tokens" on public.agent_tokens;
create policy "people make their own agent tokens" on public.agent_tokens for insert
  with check (auth.uid() = user_id and (select count(*) from public.agent_tokens t where t.user_id = auth.uid()) < 10);
drop policy if exists "people revoke their own agent tokens" on public.agent_tokens;
create policy "people revoke their own agent tokens" on public.agent_tokens for delete using (auth.uid() = user_id);
create index if not exists agent_tokens_by_person on public.agent_tokens (user_id);

create table if not exists public.agent_inbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  project text not null check (project ~ '^[A-Za-z0-9_-]{1,80}$'),
  board text check (board is null or char_length(board) <= 80),
  kind text not null check (kind in ('draft', 'breakdown', 'fill', 'edits', 'board', 'takes', 'voices', 'canvas', 'series', 'game')),
  summary text not null default '' check (char_length(summary) <= 300),
  payload jsonb not null check (octet_length(payload::text) <= 2000000),
  format_id text check (format_id is null or char_length(format_id) <= 40),
  created_at timestamptz not null default now()
);
alter table public.agent_inbox enable row level security;
drop policy if exists "people read their own inbox" on public.agent_inbox;
create policy "people read their own inbox" on public.agent_inbox for select using (auth.uid() = user_id);
drop policy if exists "people clear their own inbox" on public.agent_inbox;
create policy "people clear their own inbox" on public.agent_inbox for delete using (auth.uid() = user_id);
create index if not exists agent_inbox_by_project on public.agent_inbox (user_id, project, created_at);

-- Whose token this is, or null. Internal: not callable from outside.
create or replace function public.agent_owner(token text) returns uuid
  language sql stable security definer set search_path = public as $$
  select user_id from public.agent_tokens where token_hash = encode(sha256(convert_to(token, 'UTF8')), 'hex')
$$;
revoke all on function public.agent_owner(text) from public, anon, authenticated;

create or replace function public.agent_projects(token text)
  returns table (project_id text, project_name text, updated_at bigint, has_sheets boolean)
  language plpgsql security definer set search_path = public as $$
declare owner uuid := public.agent_owner(token);
begin
  if owner is null then raise exception 'That agent token is not valid. Make a new one on the Account page.' using errcode = '28000'; end if;
  update public.agent_tokens t set last_used_at = now() where t.token_hash = encode(sha256(convert_to(token, 'UTF8')), 'hex');
  return query select p.id, p.name, p.updated_at, p.sheets is not null from public.user_projects p where p.user_id = owner order by p.updated_at desc;
end $$;

create or replace function public.agent_project(token text, project text)
  returns table (data jsonb, sheets text)
  language plpgsql security definer set search_path = public as $$
declare owner uuid := public.agent_owner(token);
begin
  if owner is null then raise exception 'That agent token is not valid. Make a new one on the Account page.' using errcode = '28000'; end if;
  return query select p.data, p.sheets from public.user_projects p where p.user_id = owner and p.id = project;
end $$;

create or replace function public.agent_propose(token text, project text, board text, kind text, summary text, payload jsonb, format_id text)
  returns uuid
  language plpgsql security definer set search_path = public as $$
declare owner uuid := public.agent_owner(token);
declare made uuid;
begin
  if owner is null then raise exception 'That agent token is not valid. Make a new one on the Account page.' using errcode = '28000'; end if;
  if not exists (select 1 from public.user_projects p where p.user_id = owner and p.id = project) then
    raise exception 'That project is not in your account. Open it on haggsfield.studio while signed in so it syncs.';
  end if;
  if (select count(*) from public.agent_inbox i where i.user_id = owner) >= 200 then
    raise exception 'Your inbox has 200 proposals waiting. Apply or dismiss some first.';
  end if;
  insert into public.agent_inbox (user_id, project, board, kind, summary, payload, format_id)
    values (owner, project, board, kind, coalesce(summary, ''), payload, format_id) returning id into made;
  return made;
end $$;

revoke all on function public.agent_projects(text) from public;
revoke all on function public.agent_project(text, text) from public;
revoke all on function public.agent_propose(text, text, text, text, text, jsonb, text) from public;
grant execute on function public.agent_projects(text) to anon, authenticated;
grant execute on function public.agent_project(text, text) to anon, authenticated;
grant execute on function public.agent_propose(text, text, text, text, text, jsonb, text) to anon, authenticated;
