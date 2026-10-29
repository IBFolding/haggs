-- Explore: public creator profiles, and the pictures and clips people choose to share.
-- A profile and its posts are public to read. Only the owner can create, change or remove them.
-- Shared media must already be in haggs's own file store, so a post can never point anywhere else.

create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  handle text not null unique check (handle ~ '^[a-z0-9._]{2,30}$'),
  name text not null default '' check (char_length(name) <= 60),
  picture text check (picture is null or picture ~ '^https://[a-z0-9-]+\.public\.blob\.vercel-storage\.com/'),
  bio text not null default '' check (char_length(bio) <= 200),
  links jsonb not null default '{}'::jsonb check (jsonb_typeof(links) = 'object'),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
drop policy if exists "anyone reads profiles" on public.profiles;
create policy "anyone reads profiles" on public.profiles for select using (true);
drop policy if exists "people add their own profile" on public.profiles;
create policy "people add their own profile" on public.profiles for insert with check (auth.uid() = user_id);
drop policy if exists "people change their own profile" on public.profiles;
create policy "people change their own profile" on public.profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "people remove their own profile" on public.profiles;
create policy "people remove their own profile" on public.profiles for delete using (auth.uid() = user_id);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  kind text not null check (kind in ('image', 'video')),
  url text not null check (url ~ '^https://[a-z0-9-]+\.public\.blob\.vercel-storage\.com/'),
  prompt text not null default '' check (char_length(prompt) <= 2000),
  model text not null default '' check (char_length(model) <= 80),
  credits integer check (credits is null or credits >= 0),
  created_at timestamptz not null default now()
);
create index if not exists posts_newest on public.posts (created_at desc);
create index if not exists posts_by_person on public.posts (user_id, created_at desc);
-- One post per file per person, so sharing twice does nothing.
create unique index if not exists posts_once on public.posts (user_id, url);

alter table public.posts enable row level security;
drop policy if exists "anyone reads posts" on public.posts;
create policy "anyone reads posts" on public.posts for select using (true);
drop policy if exists "people share their own posts" on public.posts;
create policy "people share their own posts" on public.posts for insert with check (auth.uid() = user_id);
drop policy if exists "people remove their own posts" on public.posts;
create policy "people remove their own posts" on public.posts for delete using (auth.uid() = user_id);
