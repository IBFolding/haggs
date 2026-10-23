-- Credits: one cent of generation at Comfy's list price each. A plan's monthly
-- credits live in the "plan" bucket and are reset on renewal; top-up packs live
-- in the "topup" bucket and stay. Spending takes from plan first.
create table if not exists public.credit_ledger (
  id bigserial primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  bucket text not null check (bucket in ('plan', 'topup')),
  delta integer not null,
  kind text not null check (kind in ('renewal', 'topup', 'spend', 'refund')),
  memo text,
  ref text,
  created_at timestamptz not null default now()
);
create index if not exists credit_ledger_by_person on public.credit_ledger (user_id, created_at desc);
-- A reference can only land once per kind and bucket, so a repeated webhook or refund changes nothing.
create unique index if not exists credit_ledger_once on public.credit_ledger (user_id, kind, bucket, ref) where ref is not null;

alter table public.credit_ledger enable row level security;
drop policy if exists "read own credits" on public.credit_ledger;
create policy "read own credits" on public.credit_ledger for select using (auth.uid() = user_id);

-- The shared secret the payment webhook proves itself with. Nobody can read this table directly.
create table if not exists public.app_secrets (key text primary key, value text not null);
alter table public.app_secrets enable row level security;

create or replace function public.credits_balance()
returns table (plan integer, topup integer)
language sql security definer stable set search_path = public as $$
  select coalesce(sum(delta) filter (where bucket = 'plan'), 0)::integer,
         coalesce(sum(delta) filter (where bucket = 'topup'), 0)::integer
  from public.credit_ledger where user_id = auth.uid();
$$;

-- Spend credits for a run, atomically. False when there aren't enough.
create or replace function public.credits_spend(cents integer, memo text, ref text)
returns boolean
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); p integer; t integer; from_plan integer;
begin
  if uid is null or cents is null or cents <= 0 then return false; end if;
  perform pg_advisory_xact_lock(hashtext(uid::text));
  select coalesce(sum(delta) filter (where bucket = 'plan'), 0), coalesce(sum(delta) filter (where bucket = 'topup'), 0)
    into p, t from public.credit_ledger where user_id = uid;
  if p + t < cents then return false; end if;
  from_plan := least(greatest(p, 0), cents);
  if from_plan > 0 then insert into public.credit_ledger (user_id, bucket, delta, kind, memo, ref) values (uid, 'plan', -from_plan, 'spend', memo, ref); end if;
  if cents - from_plan > 0 then insert into public.credit_ledger (user_id, bucket, delta, kind, memo, ref) values (uid, 'topup', -(cents - from_plan), 'spend', memo, ref); end if;
  return true;
end $$;

-- Give back what a failed run spent. Only the person's own spend with that reference, once.
create or replace function public.credits_refund(ref text)
returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then return; end if;
  insert into public.credit_ledger (user_id, bucket, delta, kind, memo, ref)
    select user_id, bucket, -delta, 'refund', 'Run did not complete', credits_refund.ref
    from public.credit_ledger where user_id = uid and kind = 'spend' and credit_ledger.ref = credits_refund.ref
    on conflict do nothing;
end $$;

-- Called by the payment webhook with the shared secret: a top-up pack.
create or replace function public.credits_grant(target uuid, cents integer, ref text, secret text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if secret is null or secret <> (select value from public.app_secrets where key = 'webhook') then raise exception 'not allowed'; end if;
  insert into public.credit_ledger (user_id, bucket, delta, kind, ref) values (target, 'topup', cents, 'topup', ref) on conflict do nothing;
end $$;

-- Called by the payment webhook with the shared secret: set the monthly credits to what the plan includes. Leftovers do not roll over.
create or replace function public.credits_renew(target uuid, cents integer, ref text, secret text)
returns void
language plpgsql security definer set search_path = public as $$
declare p integer;
begin
  if secret is null or secret <> (select value from public.app_secrets where key = 'webhook') then raise exception 'not allowed'; end if;
  perform pg_advisory_xact_lock(hashtext(target::text));
  if exists (select 1 from public.credit_ledger where user_id = target and kind = 'renewal' and bucket = 'plan' and credit_ledger.ref = credits_renew.ref) then return; end if;
  select coalesce(sum(delta), 0) into p from public.credit_ledger where user_id = target and bucket = 'plan';
  insert into public.credit_ledger (user_id, bucket, delta, kind, ref) values (target, 'plan', cents - p, 'renewal', ref);
end $$;

grant execute on function public.credits_balance() to authenticated;
grant execute on function public.credits_spend(integer, text, text) to authenticated;
grant execute on function public.credits_refund(text) to authenticated;
grant execute on function public.credits_grant(uuid, integer, text, text) to anon, authenticated;
grant execute on function public.credits_renew(uuid, integer, text, text) to anon, authenticated;
