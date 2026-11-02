-- Additive quote ledger: no provider keys, prompts, images or project rows are stored here.
create table if not exists public.grey_proposal_quotes (
 id uuid primary key,
 context_hash text not null check(context_hash ~ '^[0-9a-f]{64}$'),
 credential_hash text not null check(credential_hash ~ '^[0-9a-f]{64}$'),
 policy_hash text not null check(policy_hash ~ '^[0-9a-f]{64}$'),
 expires_at timestamptz not null,
 estimate_usd numeric not null check(estimate_usd>0),
 claimed_at timestamptz
);
create index if not exists grey_proposal_quotes_expiry on public.grey_proposal_quotes(expires_at);
alter table public.grey_proposal_quotes enable row level security;
revoke all on public.grey_proposal_quotes from public,anon,authenticated;

create or replace function public.grey_quote_create(quote_id uuid,context_hash text,credential_hash text,policy_hash text,expires_ms bigint,estimate_usd numeric,secret text)
returns boolean language plpgsql security definer set search_path=public as $$
begin
 if secret is null or secret is distinct from (select value from public.app_secrets where key='webhook') then raise exception 'not allowed'; end if;
 if context_hash is null or context_hash !~ '^[0-9a-f]{64}$' or credential_hash is null or credential_hash !~ '^[0-9a-f]{64}$' or policy_hash is null or policy_hash !~ '^[0-9a-f]{64}$' or estimate_usd is null or estimate_usd<=0 or expires_ms is null then return false; end if;
 if to_timestamp(expires_ms/1000.0)<=clock_timestamp() or to_timestamp(expires_ms/1000.0)>clock_timestamp()+interval '6 minutes' then return false; end if;
 perform pg_advisory_xact_lock(hashtext('haggs:grey-proposal-quotes'));
 delete from public.grey_proposal_quotes q where q.expires_at<=clock_timestamp();
 if (select count(*) from public.grey_proposal_quotes)>=5000 or (select count(*) from public.grey_proposal_quotes q where q.credential_hash=grey_quote_create.credential_hash and q.claimed_at is null)>=200 then return false; end if;
 insert into public.grey_proposal_quotes(id,context_hash,credential_hash,policy_hash,expires_at,estimate_usd)
 values(quote_id,context_hash,credential_hash,policy_hash,to_timestamp(expires_ms/1000.0),estimate_usd) on conflict(id) do nothing;
 return found;
end $$;

create or replace function public.grey_quote_read(quote_id uuid,secret text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb;
begin
 if secret is null or secret is distinct from (select value from public.app_secrets where key='webhook') then raise exception 'not allowed'; end if;
 select jsonb_build_object('contextHash',q.context_hash,'credentialHash',q.credential_hash,'policyHash',q.policy_hash,'expiresAt',(extract(epoch from q.expires_at)*1000)::bigint,'estimateUsd',q.estimate_usd)
 into result from public.grey_proposal_quotes q where q.id=quote_id and q.claimed_at is null and q.expires_at>clock_timestamp();
 return result;
end $$;

create or replace function public.grey_quote_claim(quote_id uuid,context_hash text,credential_hash text,policy_hash text,expires_ms bigint,estimate_usd numeric,secret text)
returns boolean language plpgsql security definer set search_path=public as $$
begin
 if secret is null or secret is distinct from (select value from public.app_secrets where key='webhook') then raise exception 'not allowed'; end if;
 update public.grey_proposal_quotes q set claimed_at=clock_timestamp()
 where q.id=quote_id and q.claimed_at is null and q.expires_at>clock_timestamp()
 and q.context_hash=grey_quote_claim.context_hash and q.credential_hash=grey_quote_claim.credential_hash and q.policy_hash=grey_quote_claim.policy_hash
 and q.expires_at=to_timestamp(expires_ms/1000.0) and q.estimate_usd=grey_quote_claim.estimate_usd;
 return found;
end $$;
revoke all on function public.grey_quote_create(uuid,text,text,text,bigint,numeric,text) from public;
revoke all on function public.grey_quote_read(uuid,text) from public;
revoke all on function public.grey_quote_claim(uuid,text,text,text,bigint,numeric,text) from public;
grant execute on function public.grey_quote_create(uuid,text,text,text,bigint,numeric,text) to anon,authenticated;
grant execute on function public.grey_quote_read(uuid,text) to anon,authenticated;
grant execute on function public.grey_quote_claim(uuid,text,text,text,bigint,numeric,text) to anon,authenticated;
