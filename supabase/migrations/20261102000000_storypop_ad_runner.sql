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
