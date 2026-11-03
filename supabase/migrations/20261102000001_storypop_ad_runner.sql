-- StoryPop ad builds: the server-side runner claims queued ad jobs and settles them.
-- Both calls prove themselves with the same shared secret as the other StoryPop calls.

-- Takes up to max_jobs queued ad jobs (and any that have been "running" for over 15 minutes, which means a run died).
create or replace function public.storypop_ad_claim(max_jobs integer, secret text)
returns table (job_id uuid, owner_id uuid, job_reference text, job_input jsonb)
language plpgsql security definer set search_path = public as $$
begin
  if secret is null or secret <> (select value from public.app_secrets where key = 'webhook') then raise exception 'not allowed'; end if;
  return query
    with taken as (
      update public.storypop_jobs j set status = 'running', updated_at = now()
      where j.id in (
        select s.id from public.storypop_jobs s
        where s.kind = 'ad' and (s.status = 'queued' or (s.status = 'running' and s.updated_at < now() - interval '15 minutes'))
        order by s.created_at
        limit least(greatest(max_jobs, 1), 10)
        for update skip locked
      )
      returning j.id, j.user_id, j.reference, j.input
    )
    select taken.id, taken.user_id, taken.reference, taken.input from taken;
end $$;

-- Marks one job finished. Returns false when it was already settled.
create or replace function public.storypop_job_settle(job uuid, new_status text, url text, secret text)
returns boolean
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if secret is null or secret <> (select value from public.app_secrets where key = 'webhook') then raise exception 'not allowed'; end if;
  if new_status not in ('completed', 'failed') then return false; end if;
  update public.storypop_jobs set status = new_status, result_url = case when new_status = 'completed' then url else null end, updated_at = now()
    where id = job and status in ('queued', 'running');
  get diagnostics n = row_count;
  return n > 0;
end $$;

-- Ad builds are paid for from the StoryPop ad account's credits. Same rules as credits_spend / credits_refund,
-- but called by the server with the shared secret instead of by a signed-in person.
create or replace function public.storypop_credits_spend(target uuid, cents integer, memo text, ref text, secret text)
returns boolean
language plpgsql security definer set search_path = public as $$
declare p integer; t integer; from_plan integer;
begin
  if secret is null or secret <> (select value from public.app_secrets where key = 'webhook') then raise exception 'not allowed'; end if;
  if target is null or cents is null or cents <= 0 then return false; end if;
  if not exists (select 1 from public.storypop_links where user_id = target) then raise exception 'not linked'; end if;
  perform pg_advisory_xact_lock(hashtext(target::text));
  select coalesce(sum(delta) filter (where bucket = 'plan'), 0), coalesce(sum(delta) filter (where bucket = 'topup'), 0)
    into p, t from public.credit_ledger where user_id = target;
  if p + t < cents then return false; end if;
  from_plan := least(greatest(p, 0), cents);
  if from_plan > 0 then insert into public.credit_ledger (user_id, bucket, delta, kind, memo, ref) values (target, 'plan', -from_plan, 'spend', memo, ref) on conflict do nothing; end if;
  if cents - from_plan > 0 then insert into public.credit_ledger (user_id, bucket, delta, kind, memo, ref) values (target, 'topup', -(cents - from_plan), 'spend', memo, ref) on conflict do nothing; end if;
  return true;
end $$;

create or replace function public.storypop_credits_refund(target uuid, ref text, secret text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if secret is null or secret <> (select value from public.app_secrets where key = 'webhook') then raise exception 'not allowed'; end if;
  insert into public.credit_ledger (user_id, bucket, delta, kind, memo, ref)
    select user_id, bucket, -delta, 'refund', 'Ad build did not complete', storypop_credits_refund.ref
    from public.credit_ledger where user_id = target and kind = 'spend' and credit_ledger.ref = storypop_credits_refund.ref
    on conflict do nothing;
end $$;
