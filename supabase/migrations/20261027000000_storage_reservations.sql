-- Additive quota ledger. No existing files or balances are modified.
create table if not exists public.storage_accounts (
 user_id uuid primary key references auth.users(id) on delete cascade,
 used_bytes bigint not null default 0 check(used_bytes>=0), initialized boolean not null default false
);
create table if not exists public.storage_reservations (
 id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
 bytes bigint not null check(bytes>0), state text not null check(state in ('pending','committed','released')),
 url text, created_at timestamptz not null default now()
);
alter table public.storage_accounts enable row level security;
alter table public.storage_reservations enable row level security;
create policy "read own storage" on public.storage_accounts for select using(auth.uid()=user_id);
create policy "read own reservations" on public.storage_reservations for select using(auth.uid()=user_id);
-- All writes require the existing server-only webhook secret. Quota and owner never come from client claims.
create or replace function public.storage_reserve(target uuid, reservation uuid, amount bigint, allowance bigint, existing_files jsonb, secret text)
returns boolean language plpgsql security definer set search_path=public as $$
declare used bigint; pending bigint; fresh boolean;
begin
 if secret is null or secret is distinct from (select value from app_secrets where key='webhook') then raise exception 'not allowed'; end if;
 if amount<=0 or allowance<=0 or jsonb_typeof(existing_files) is distinct from 'array' then return false; end if;
 perform pg_advisory_xact_lock(hashtext('storage:'||target::text));
 fresh := not exists(select 1 from storage_accounts where user_id=target);
 if fresh then
  insert into storage_accounts(user_id,used_bytes,initialized) values(target,0,true);
  insert into storage_reservations(id,user_id,bytes,state,url)
   select gen_random_uuid(),target,(v->>'size')::bigint,'committed',v->>'url' from jsonb_array_elements(existing_files) v where (v->>'size')::bigint>0;
  update storage_accounts set used_bytes=(select coalesce(sum(bytes),0) from storage_reservations where user_id=target and state='committed') where user_id=target;
 end if;
 if exists(select 1 from storage_reservations where id=reservation) then return false; end if;
 select used_bytes into used from storage_accounts where user_id=target;
 select coalesce(sum(bytes),0) into pending from storage_reservations where user_id=target and state='pending';
 if used+pending+amount>allowance then return false; end if;
 insert into storage_reservations values(reservation,target,amount,'pending',null,now());
 return true;
end $$;
create or replace function public.storage_finish(target uuid,reservation uuid,location text,secret text,actual_bytes bigint default null)
returns void language plpgsql security definer set search_path=public as $$
declare item storage_reservations;
begin
 if secret is null or secret is distinct from (select value from app_secrets where key='webhook') then raise exception 'not allowed'; end if;
 perform pg_advisory_xact_lock(hashtext('storage:'||target::text));
 select * into item from storage_reservations where id=reservation and user_id=target for update;
 if item.state is distinct from 'pending' then return; end if;
 if actual_bytes is not null and (actual_bytes<=0 or actual_bytes>item.bytes) then raise exception 'invalid final size'; end if;
 if location is null then update storage_reservations set state='released' where id=reservation;
 else
  update storage_accounts set used_bytes=used_bytes+coalesce(actual_bytes,item.bytes) where user_id=target;
  update storage_reservations set state='committed',url=location,bytes=coalesce(actual_bytes,item.bytes) where id=reservation;
 end if;
end $$;
-- User-requested deletion frees quota once, only after the Blob delete succeeded.
create or replace function public.storage_removed(target uuid,location text,secret text)
returns void language plpgsql security definer set search_path=public as $$
declare freed bigint;
begin
 if secret is null or secret is distinct from (select value from app_secrets where key='webhook') then raise exception 'not allowed'; end if;
 perform pg_advisory_xact_lock(hashtext('storage:'||target::text));
 select coalesce(sum(bytes),0) into freed from storage_reservations where user_id=target and url=location and state='committed';
 update storage_reservations set state='released' where user_id=target and url=location and state='committed';
 update storage_accounts set used_bytes=greatest(0,used_bytes-freed) where user_id=target;
end $$;
revoke all on function public.storage_reserve(uuid,uuid,bigint,bigint,jsonb,text) from public;
revoke all on function public.storage_finish(uuid,uuid,text,text,bigint) from public;
revoke all on function public.storage_removed(uuid,text,text) from public;
grant execute on function public.storage_reserve(uuid,uuid,bigint,bigint,jsonb,text) to anon,authenticated;
grant execute on function public.storage_finish(uuid,uuid,text,text,bigint) to anon,authenticated;
grant execute on function public.storage_removed(uuid,text,text) to anon,authenticated;
