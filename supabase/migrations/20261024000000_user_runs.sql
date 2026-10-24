-- Everything a person generates, kept in their account so every device and the live site show the same Gallery.
-- Only the owner can read or change their rows. A deleted run stays as a marker so other devices drop it too.
create table if not exists public.user_runs (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null,
  data jsonb not null,
  rev bigint not null,
  deleted boolean not null default false,
  primary key (user_id, id)
);

alter table public.user_runs enable row level security;

drop policy if exists "own runs" on public.user_runs;
create policy "own runs" on public.user_runs
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists user_runs_by_person on public.user_runs (user_id, rev desc);
