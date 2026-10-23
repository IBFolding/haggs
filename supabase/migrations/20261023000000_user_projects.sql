-- Projects kept in a person's account, so they follow them across devices.
-- Only the owner can read or change their rows.
create table if not exists public.user_projects (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null,
  name text not null,
  data jsonb not null,
  sheets text,
  updated_at bigint not null,
  primary key (user_id, id)
);

alter table public.user_projects enable row level security;

drop policy if exists "own projects" on public.user_projects;
create policy "own projects" on public.user_projects
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists user_projects_by_person on public.user_projects (user_id, updated_at desc);
