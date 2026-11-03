-- StoryPop partner link: which haggs accounts are connected to StoryPop, and the jobs StoryPop asks haggs to make.
-- Server-to-server calls prove themselves with the same shared webhook secret the payment webhook already uses.

create table if not exists public.storypop_links (
  user_id uuid primary key references auth.users (id) on delete cascade,
  linked_at timestamptz not null default now()
);
alter table public.storypop_links enable row level security;
drop policy if exists "read own link" on public.storypop_links;
create policy "read own link" on public.storypop_links for select using (auth.uid() = user_id);
drop policy if exists "link myself" on public.storypop_links;
create policy "link myself" on public.storypop_links for insert with check (auth.uid() = user_id);
drop policy if exists "unlink myself" on public.storypop_links;
create policy "unlink myself" on public.storypop_links for delete using (auth.uid() = user_id);

create table if not exists public.storypop_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  reference text not null,
  kind text not null check (kind in ('remix', 'template', 'project', 'pop', 'fix_audio', 'ad')),
  input jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued', 'running', 'completed', 'failed')),
  result_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, reference)
);
create index if not exists storypop_jobs_by_person on public.storypop_jobs (user_id, created_at desc);
alter table public.storypop_jobs enable row level security;
drop policy if exists "read own storypop jobs" on public.storypop_jobs;
create policy "read own storypop jobs" on public.storypop_jobs for select using (auth.uid() = user_id);

-- StoryPop (with the shared secret) asks for someone's balance.
create or replace function public.storypop_balance_for(target uuid, secret text)
returns table (plan integer, topup integer)
language plpgsql security definer stable set search_path = public as $$
begin
  if secret is null or secret <> (select value from public.app_secrets where key = 'webhook') then raise exception 'not allowed'; end if;
  return query select coalesce(sum(delta) filter (where bucket = 'plan'), 0)::integer,
                      coalesce(sum(delta) filter (where bucket = 'topup'), 0)::integer
               from public.credit_ledger where user_id = target;
end $$;

-- StoryPop (with the shared secret) hands haggs a job for a linked person. A repeated reference changes nothing.
create or replace function public.storypop_job_create(target uuid, reference text, kind text, input jsonb, secret text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare job uuid;
begin
  if secret is null or secret <> (select value from public.app_secrets where key = 'webhook') then raise exception 'not allowed'; end if;
  if not exists (select 1 from public.storypop_links where user_id = target) then raise exception 'not linked'; end if;
  insert into public.storypop_jobs (user_id, reference, kind, input) values (target, reference, kind, coalesce(input, '{}'::jsonb))
    on conflict (user_id, reference) do nothing;
  select id into job from public.storypop_jobs where user_id = target and storypop_jobs.reference = storypop_job_create.reference;
  return job;
end $$;

-- The person finishes (or fails) one of their own jobs. Returns the job id, or null when there is nothing to finish.
create or replace function public.storypop_job_finish(job_reference text, new_status text, url text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); job uuid;
begin
  if uid is null or new_status not in ('completed', 'failed') then return null; end if;
  update public.storypop_jobs set status = new_status, result_url = case when new_status = 'completed' then url else null end, updated_at = now()
    where user_id = uid and reference = job_reference and status in ('queued', 'running')
    returning id into job;
  return job;
end $$;
