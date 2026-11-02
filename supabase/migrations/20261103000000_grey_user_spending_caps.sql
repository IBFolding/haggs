-- Applied to production after user approval on 2026-11-02; see cap handoff.
-- Lifetime Grey Room budget. Existing reservations never expire automatically.
begin;
create table public.grey_spend_accounts (
 user_id uuid primary key references auth.users(id),
 cap_usd numeric not null default 0 check(cap_usd>=0 and cap_usd<=10000),
 charged_usd numeric not null default 0 check(charged_usd>=0),
 reserved_usd numeric not null default 0 check(reserved_usd>=0)
);
create table public.grey_spend_reservations (
 id uuid primary key,
 user_id uuid not null references public.grey_spend_accounts(user_id),
 maximum_usd numeric not null check(maximum_usd>0),
 actual_usd numeric check(actual_usd>=0),
 state text not null default 'reserved' check(state in ('reserved','uncertain','settled')),
 created_at timestamptz not null default now()
);
alter table public.grey_spend_accounts enable row level security;
alter table public.grey_spend_reservations enable row level security;
revoke all on public.grey_spend_accounts,public.grey_spend_reservations from public,anon,authenticated;
create function public.grey_spend_status() returns jsonb language sql security definer set search_path=public as $$
 select jsonb_build_object('capUsd',coalesce(a.cap_usd,0),'chargedUsd',coalesce(a.charged_usd,0),'reservedUsd',coalesce(a.reserved_usd,0))
 from (select auth.uid() as id) u left join public.grey_spend_accounts a on a.user_id=u.id where u.id is not null;
$$;
create function public.grey_spend_set_cap(cap numeric) returns boolean language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); begin
 if uid is null or cap is null or cap<0 or cap>10000 or cap<>round(cap,2) then return false; end if;
 insert into public.grey_spend_accounts(user_id) values(uid) on conflict do nothing;
 perform 1 from public.grey_spend_accounts where user_id=uid for update;
 update public.grey_spend_accounts set cap_usd=cap where user_id=uid and charged_usd+reserved_usd<=cap;
 return found;
end $$;
create function public.grey_spend_reserve(ref uuid,uid uuid,maximum numeric,secret text) returns boolean language plpgsql security definer set search_path=public as $$
begin
 if secret is null or secret is distinct from (select value from public.app_secrets where key='webhook') then raise exception 'not allowed'; end if;
 if maximum is null or maximum<=0 or maximum>10000 or ref is null or uid is null then return false; end if;
 perform 1 from public.grey_spend_accounts where user_id=uid for update;
 if not found or exists(select 1 from public.grey_spend_reservations where id=ref) then return false; end if;
 update public.grey_spend_accounts set reserved_usd=reserved_usd+maximum where user_id=uid and charged_usd+reserved_usd+maximum<=cap_usd;
 if not found then return false; end if;
 insert into public.grey_spend_reservations(id,user_id,maximum_usd) values(ref,uid,maximum);
 return true;
end $$;
create function public.grey_spend_finish(ref uuid,actual numeric,secret text) returns boolean language plpgsql security definer set search_path=public as $$
declare r public.grey_spend_reservations; begin
 if secret is null or secret is distinct from (select value from public.app_secrets where key='webhook') then raise exception 'not allowed'; end if;
 select * into r from public.grey_spend_reservations where id=ref;
 if not found then return false; end if;
 perform 1 from public.grey_spend_accounts where user_id=r.user_id for update;
 select * into r from public.grey_spend_reservations where id=ref for update;
 if r.state='settled' then return false; end if;
 if actual is null then update public.grey_spend_reservations set state='uncertain' where id=ref;return true;end if;
 if actual<0 or actual='NaN'::numeric then return false;end if;
 -- Record even an unexpected provider overcharge honestly; remaining budget then fails closed.
 update public.grey_spend_accounts set reserved_usd=reserved_usd-r.maximum_usd,charged_usd=charged_usd+actual where user_id=r.user_id;
 update public.grey_spend_reservations set state='settled',actual_usd=actual where id=ref;
 return true;
end $$;
revoke all on function public.grey_spend_status(),public.grey_spend_set_cap(numeric),public.grey_spend_reserve(uuid,uuid,numeric,text),public.grey_spend_finish(uuid,numeric,text) from public,anon;
grant execute on function public.grey_spend_status(),public.grey_spend_set_cap(numeric) to authenticated;
grant execute on function public.grey_spend_reserve(uuid,uuid,numeric,text),public.grey_spend_finish(uuid,numeric,text) to anon,authenticated;
commit;
