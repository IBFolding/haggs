-- Server-owned journal for Comfy API submissions. No provider credentials,
-- workflow inputs or signed URLs are stored. This migration is not deployed.
create table if not exists public.managed_job_journal (
  submission_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  deployment text not null,
  output_node text not null,
  state text not null check (state in ('dispatching', 'accepted')),
  provider_job_id text,
  provider_job_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((state = 'dispatching' and provider_job_id is null and provider_job_url is null) or
         (state = 'accepted' and provider_job_id is not null and provider_job_url is not null))
);
alter table public.managed_job_journal enable row level security;
revoke all on public.managed_job_journal from anon, authenticated;
grant select on public.managed_job_journal to authenticated;
create policy "read own managed jobs" on public.managed_job_journal for select to authenticated using (auth.uid() = user_id);

-- Existing server-only application secret protects writes; caller identities
-- and deployment allowlists must be verified by the server before invoking.
create or replace function public.managed_job_begin(target uuid, submission uuid, p_deployment text, p_output_node text, secret text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if secret is null or secret is distinct from (select value from app_secrets where key='webhook') then raise exception 'not allowed'; end if;
  if target is null or submission is null or p_deployment is null or p_output_node is null or p_deployment !~ '^https://[a-z0-9-]+[.]run[.]comfy[.]app$' or p_output_node !~ '^[a-zA-Z0-9_-]{1,128}$' then raise exception 'invalid managed job'; end if;
  insert into managed_job_journal(submission_id,user_id,deployment,output_node,state)
  values(submission,target,p_deployment,p_output_node,'dispatching') on conflict do nothing;
  return found;
end $$;
create or replace function public.managed_job_accept(target uuid, submission uuid, provider_id text, provider_url text, secret text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if secret is null or secret is distinct from (select value from app_secrets where key='webhook') then raise exception 'not allowed'; end if;
  if provider_id is null or provider_url is null or provider_id !~ '^[a-zA-Z0-9_-]{1,128}$' or provider_url !~ '^(/[a-zA-Z0-9_-]+)*/api/v2/jobs/[a-zA-Z0-9_-]{1,128}$' or split_part(provider_url, '/', array_length(string_to_array(provider_url, '/'), 1)) <> provider_id then raise exception 'invalid provider job'; end if;
  update managed_job_journal set state='accepted', provider_job_id=provider_id, provider_job_url=provider_url, updated_at=now()
    where submission_id=submission and user_id=target and state='dispatching';
  return found;
end $$;
revoke all on function public.managed_job_begin(uuid,uuid,text,text,text) from public;
revoke all on function public.managed_job_accept(uuid,uuid,text,text,text) from public;
grant execute on function public.managed_job_begin(uuid,uuid,text,text,text) to anon,authenticated;
grant execute on function public.managed_job_accept(uuid,uuid,text,text,text) to anon,authenticated;
