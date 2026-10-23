-- Community apps: workflows people publish for anyone to run, free or for a
-- creator fee of up to 12¢ a run (80% to the creator, the rest to haggs).
-- Runners pay the fee from prepaid haggs credits; what a run costs on Comfy
-- is still billed to their own Comfy key. Paste this into the Supabase SQL
-- editor, or run `supabase db push`.

create table if not exists public.community_apps (
  id uuid primary key default gen_random_uuid(),
  creator uuid not null references auth.users (id) on delete cascade,
  creator_name text not null default '',
  name text not null check (char_length(name) between 1 and 80),
  description text not null default '' check (char_length(description) <= 400),
  workflow text not null check (char_length(workflow) <= 5000000),
  recipe jsonb,
  cover_url text check (cover_url is null or cover_url ~ '^https://'),
  cover_kind text check (cover_kind in ('image', 'video')),
  fee_cents integer not null default 0 check (fee_cents between 0 and 12),
  runs integer not null default 0,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists community_apps_published on public.community_apps (published, runs desc);

alter table public.community_apps enable row level security;
create policy "anyone reads published apps" on public.community_apps for select using (published or creator = auth.uid());
create policy "creators add their apps" on public.community_apps for insert with check (creator = auth.uid());
create policy "creators change their apps" on public.community_apps for update using (creator = auth.uid()) with check (creator = auth.uid());
create policy "creators remove their apps" on public.community_apps for delete using (creator = auth.uid());

-- The run count only moves through charge_app_run, never by hand.
create or replace function public.community_apps_guard() returns trigger language plpgsql as $$
begin
  if current_setting('haggs.charging', true) is distinct from 'on' then
    new.runs := old.runs;
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists community_apps_guard on public.community_apps;
create trigger community_apps_guard before update on public.community_apps for each row execute function public.community_apps_guard();

-- Prepaid credits, in cents. Read your own; only the functions below and the
-- payment webhook (with the service key) change them.
create table if not exists public.credits (
  user_id uuid primary key references auth.users (id) on delete cascade,
  balance_cents integer not null default 0 check (balance_cents >= 0),
  updated_at timestamptz not null default now()
);
alter table public.credits enable row level security;
create policy "read your own credits" on public.credits for select using (user_id = auth.uid());

-- Every run of a community app: who ran it, what it cost them, what the creator earned.
create table if not exists public.app_runs (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references public.community_apps (id) on delete cascade,
  runner uuid not null references auth.users (id) on delete cascade,
  creator uuid not null references auth.users (id) on delete cascade,
  fee_cents integer not null,
  creator_cents integer not null,
  platform_cents integer not null,
  status text not null default 'charged' check (status in ('charged', 'refunded')),
  created_at timestamptz not null default now()
);
create index if not exists app_runs_creator on public.app_runs (creator, created_at desc);
alter table public.app_runs enable row level security;
create policy "runners and creators read their runs" on public.app_runs for select using (runner = auth.uid() or creator = auth.uid());

-- Charges a run before it starts: the fee comes off the runner's credits in
-- the same transaction that logs it. A creator running their own app pays nothing.
create or replace function public.charge_app_run(app uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  a public.community_apps;
  me uuid := auth.uid();
  fee integer;
  to_creator integer;
  run_id uuid;
begin
  if me is null then raise exception 'Sign in to run community apps.'; end if;
  select * into a from public.community_apps where id = app and published;
  if not found then raise exception 'That app isn''t published any more.'; end if;
  fee := case when a.creator = me then 0 else a.fee_cents end;
  to_creator := floor(fee * 0.8);
  if fee > 0 then
    update public.credits set balance_cents = balance_cents - fee, updated_at = now() where user_id = me and balance_cents >= fee;
    if not found then raise exception 'Not enough haggs credits for this app''s %¢ fee. Add credits on your account page.', fee; end if;
  end if;
  insert into public.app_runs (app_id, runner, creator, fee_cents, creator_cents, platform_cents) values (a.id, me, a.creator, fee, to_creator, fee - to_creator) returning id into run_id;
  perform set_config('haggs.charging', 'on', true);
  update public.community_apps set runs = runs + 1 where id = a.id;
  perform set_config('haggs.charging', 'off', true);
  return jsonb_build_object('run', run_id, 'fee_cents', fee);
end $$;

-- A run that failed gives the fee back, once, to the person who paid it, within a day.
create or replace function public.refund_app_run(run uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r public.app_runs;
begin
  update public.app_runs set status = 'refunded' where id = run and runner = auth.uid() and status = 'charged' and created_at > now() - interval '1 day' returning * into r;
  if not found then return; end if;
  if r.fee_cents > 0 then
    update public.credits set balance_cents = balance_cents + r.fee_cents, updated_at = now() where user_id = r.runner;
  end if;
  perform set_config('haggs.charging', 'on', true);
  update public.community_apps set runs = greatest(0, runs - 1) where id = r.app_id;
  perform set_config('haggs.charging', 'off', true);
end $$;

-- What a creator has earned, for their account page.
create or replace function public.my_earnings() returns jsonb
language sql security definer set search_path = public stable as $$
  select jsonb_build_object(
    'cents', coalesce(sum(creator_cents) filter (where status = 'charged'), 0),
    'runs', count(*) filter (where status = 'charged')
  ) from public.app_runs where creator = auth.uid();
$$;

revoke all on function public.charge_app_run(uuid) from public, anon;
revoke all on function public.refund_app_run(uuid) from public, anon;
revoke all on function public.my_earnings() from public, anon;
grant execute on function public.charge_app_run(uuid) to authenticated;
grant execute on function public.refund_app_run(uuid) to authenticated;
grant execute on function public.my_earnings() to authenticated;

-- Covers live in a public bucket, one folder per creator.
insert into storage.buckets (id, name, public) values ('app-covers', 'app-covers', true) on conflict (id) do nothing;
create policy "anyone sees covers" on storage.objects for select using (bucket_id = 'app-covers');
create policy "creators upload their covers" on storage.objects for insert to authenticated with check (bucket_id = 'app-covers' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "creators replace their covers" on storage.objects for update to authenticated using (bucket_id = 'app-covers' and (storage.foldername(name))[1] = auth.uid()::text);
