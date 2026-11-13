-- Apply separately before enabling production RunPod submissions. No provider keys or input media are stored here.
create table if not exists public.runpod_jobs (
 id uuid not null,
 user_id uuid not null references auth.users(id) on delete cascade,
 intent jsonb not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 primary key (user_id,id)
);
alter table public.runpod_jobs enable row level security;
create policy "Read own RunPod intents" on public.runpod_jobs for select to authenticated using (user_id = (select auth.uid()));
create policy "Reserve own RunPod intents" on public.runpod_jobs for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Update own RunPod intents" on public.runpod_jobs for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
grant select,insert,update on public.runpod_jobs to authenticated;
